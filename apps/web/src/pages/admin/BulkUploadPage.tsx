import React, { useState, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Button, Card } from '@jukebox/ui';
import { api } from '../../lib/api';

type FileStatus = 'pending' | 'uploading' | 'success' | 'failed' | 'skipped';

interface Placement {
  genre?: string;
  artist?: string;
  album?: string;
}

interface FileItem {
  file: File;
  relPath?: string;
  placement: Placement;
  status: FileStatus;
  message?: string;
  progress?: number;
}

const STATUS_COLORS: Record<FileStatus, string> = {
  pending: 'text-jb-text-secondary',
  uploading: 'text-jb-accent-purple',
  success: 'text-jb-accent-green',
  failed: 'text-jb-highlight-pink',
  skipped: 'text-jb-text-secondary',
};

const STATUS_LABEL: Record<FileStatus, string> = {
  pending: 'Waiting',
  uploading: 'Uploading...',
  success: 'Uploaded',
  failed: 'Failed',
  skipped: 'Skipped',
};

const MAX_FILE_SIZE = 50 * 1024 * 1024;

/**
 * Derive where a song should be filed from its folder path.
 * Uses the LAST up to 3 folders as Genre / Artist / Album (left → right),
 * so an organised tree like  Genero/Artista/Album/musica.mp3  lands correctly
 * even if wrapped in extra parent folders.
 */
function derivePlacement(relPath?: string): Placement {
  if (!relPath) return {};
  const parts = relPath.split('/').filter(Boolean);
  const folders = parts.slice(0, -1); // drop the filename
  const chain = folders.slice(-3); // last up to 3 folders
  if (chain.length >= 3) return { genre: chain[0], artist: chain[1], album: chain[2] };
  if (chain.length === 2) return { genre: chain[0], artist: chain[1] };
  if (chain.length === 1) return { genre: chain[0] };
  return {};
}

const placementLabel = (p: Placement): string => {
  const parts = [p.genre, p.artist, p.album].filter(Boolean);
  return parts.length ? parts.join(' › ') : '—';
};

export const BulkUploadPage: React.FC = () => {
  const [items, setItems] = useState<FileItem[]>([]);
  const [running, setRunning] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const cancelRef = useRef(false);

  const addFiles = useCallback((files: ArrayLike<File>) => {
    const arr = Array.from(files);
    const mp3s = arr.filter(
      (f) => f.type === 'audio/mpeg' || f.name.toLowerCase().endsWith('.mp3')
    );
    if (mp3s.length === 0) return;
    setItems((prev) => {
      const key = (f: File) =>
        ((f as unknown as { webkitRelativePath?: string }).webkitRelativePath || f.name) +
        '_' +
        f.size;
      const existingNames = new Set(prev.map((p) => key(p.file)));
      const newOnes: FileItem[] = mp3s
        .filter((f) => !existingNames.has(key(f)))
        .map((f) => {
          const relPath = (f as unknown as { webkitRelativePath?: string }).webkitRelativePath || undefined;
          return {
            file: f,
            relPath,
            placement: derivePlacement(relPath),
            status: 'pending' as FileStatus,
          };
        });
      return [...prev, ...newOnes];
    });
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) addFiles(e.target.files);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleFolderSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) addFiles(e.target.files);
    if (folderInputRef.current) folderInputRef.current.value = '';
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files) addFiles(e.dataTransfer.files);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = () => setDragOver(false);

  const removeItem = (idx: number) => {
    if (running) return;
    setItems((prev) => prev.filter((_, i) => i !== idx));
  };

  const clearCompleted = () => {
    if (running) return;
    setItems((prev) => prev.filter((p) => p.status === 'pending' || p.status === 'failed'));
  };

  const clearAll = () => {
    if (running) return;
    setItems([]);
  };

  const fileToBase64 = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new window.FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        resolve(result.split(',')[1]);
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsDataURL(file);
    });

  const updateItem = (idx: number, patch: Partial<FileItem>) => {
    setItems((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], ...patch };
      return next;
    });
  };

  const startUpload = async () => {
    if (running) return;
    cancelRef.current = false;
    setRunning(true);

    for (let i = 0; i < items.length; i++) {
      if (cancelRef.current) break;
      const item = items[i];
      if (item.status !== 'pending' && item.status !== 'failed') continue;

      if (item.file.size > MAX_FILE_SIZE) {
        updateItem(i, { status: 'failed', message: 'File too large (max 50MB)' });
        continue;
      }

      updateItem(i, { status: 'uploading', message: 'Reading file...' });

      try {
        const base64 = await fileToBase64(item.file);
        updateItem(i, { message: 'Uploading...' });

        const { data } = await api.post('/songs/upload', {
          file: base64,
          filename: item.file.name,
          // Folder-derived placement (undefined for loose files → ID3 tags win)
          genre: item.placement.genre,
          artist: item.placement.artist,
          album: item.placement.album,
        });

        const song = data?.data?.song;
        updateItem(i, {
          status: 'success',
          message: song ? `${song.title} — ${song.artist}` : 'Uploaded',
        });
      } catch (err: any) {
        const msg = err.response?.data?.error || err.message || 'Upload failed';
        const isDuplicate = /duplicate|already exists/i.test(msg);
        updateItem(i, {
          status: isDuplicate ? 'skipped' : 'failed',
          message: msg,
        });
      }
    }

    setRunning(false);
  };

  const stopUpload = () => {
    cancelRef.current = true;
  };

  const stats = items.reduce(
    (acc, it) => {
      acc[it.status] = (acc[it.status] || 0) + 1;
      return acc;
    },
    {} as Record<FileStatus, number>
  );
  const pendingCount = (stats.pending || 0) + (stats.failed || 0);
  const hasFolders = items.some((it) => it.relPath);

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex items-center gap-3 mb-4">
        <Link to="/admin/songs" className="text-jb-text-secondary text-sm hover:text-jb-accent-green">
          ← Music Catalog
        </Link>
      </div>

      <h2 className="text-2xl font-bold text-jb-text-primary mb-2">Bulk Upload Songs</h2>
      <p className="text-jb-text-secondary text-sm mb-6">
        Drop individual MP3 files, or choose a whole folder organised as{' '}
        <span className="text-jb-text-primary">Genre / Artist / Album</span> and each song is filed
        into the right place automatically. Title, artist, album, cover art and duration are read
        from each file. Max 50MB per file.
      </p>

      {/* Drop zone */}
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={`border-2 border-dashed rounded-2xl p-10 text-center transition-all ${
          dragOver
            ? 'border-jb-accent-green bg-jb-accent-green/10'
            : 'border-white/20 bg-jb-bg-secondary/30'
        } ${running ? 'opacity-50 pointer-events-none' : ''}`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="audio/mpeg,audio/mp3,.mp3"
          multiple
          onChange={handleFileSelect}
          className="hidden"
          disabled={running}
        />
        <input
          ref={folderInputRef}
          type="file"
          multiple
          onChange={handleFolderSelect}
          className="hidden"
          disabled={running}
          {...({ webkitdirectory: '', directory: '' } as any)}
        />
        <div className="text-5xl mb-3">{'🎵'}</div>
        <p className="text-jb-text-primary font-medium mb-1">
          {dragOver ? 'Drop files here' : 'Drop MP3 files here'}
        </p>
        <p className="text-jb-text-secondary text-sm mb-4">or choose files / a folder to upload</p>
        <div className="flex gap-2 justify-center flex-wrap">
          <Button variant="secondary" size="sm" onClick={() => fileInputRef.current?.click()} disabled={running}>
            Choose files
          </Button>
          <Button variant="primary" size="sm" onClick={() => folderInputRef.current?.click()} disabled={running}>
            {'📁'} Choose folder
          </Button>
        </div>
      </div>

      {/* Stats summary */}
      {items.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mt-6">
          <Card className="p-3 text-center">
            <p className="text-jb-text-secondary text-xs">Total</p>
            <p className="text-jb-text-primary text-2xl font-bold">{items.length}</p>
          </Card>
          <Card className="p-3 text-center">
            <p className="text-jb-text-secondary text-xs">Waiting</p>
            <p className="text-jb-text-secondary text-2xl font-bold">{stats.pending || 0}</p>
          </Card>
          <Card className="p-3 text-center">
            <p className="text-jb-text-secondary text-xs">Uploaded</p>
            <p className="text-jb-accent-green text-2xl font-bold">{stats.success || 0}</p>
          </Card>
          <Card className="p-3 text-center">
            <p className="text-jb-text-secondary text-xs">Skipped</p>
            <p className="text-jb-text-secondary text-2xl font-bold">{stats.skipped || 0}</p>
          </Card>
          <Card className="p-3 text-center">
            <p className="text-jb-text-secondary text-xs">Failed</p>
            <p className="text-jb-highlight-pink text-2xl font-bold">{stats.failed || 0}</p>
          </Card>
        </div>
      )}

      {/* Action buttons */}
      {items.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-6">
          {!running ? (
            <Button variant="primary" onClick={startUpload} disabled={pendingCount === 0}>
              Start Upload ({pendingCount} pending)
            </Button>
          ) : (
            <Button variant="secondary" onClick={stopUpload}>
              Stop after current
            </Button>
          )}
          <Button variant="ghost" onClick={clearCompleted} disabled={running}>
            Clear completed
          </Button>
          <Button variant="ghost" onClick={clearAll} disabled={running}>
            Clear all
          </Button>
        </div>
      )}

      {/* File list */}
      {items.length > 0 && (
        <Card className="mt-6 p-0 overflow-hidden">
          <div className="max-h-[60vh] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="bg-jb-bg-secondary/60 sticky top-0">
                <tr>
                  <th className="text-left px-4 py-2 text-jb-text-secondary font-normal">#</th>
                  <th className="text-left px-4 py-2 text-jb-text-secondary font-normal">File</th>
                  {hasFolders && (
                    <th className="text-left px-4 py-2 text-jb-text-secondary font-normal">
                      Filed under
                    </th>
                  )}
                  <th className="text-left px-4 py-2 text-jb-text-secondary font-normal">Status</th>
                  <th className="text-left px-4 py-2 text-jb-text-secondary font-normal">Details</th>
                  <th className="px-4 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, idx) => (
                  <tr key={idx} className="border-t border-white/5 hover:bg-white/5">
                    <td className="px-4 py-2 text-jb-text-secondary">{idx + 1}</td>
                    <td className="px-4 py-2 text-jb-text-primary truncate max-w-xs" title={item.relPath || item.file.name}>
                      {item.file.name}
                    </td>
                    {hasFolders && (
                      <td className="px-4 py-2 text-jb-accent-purple text-xs truncate max-w-xs" title={placementLabel(item.placement)}>
                        {placementLabel(item.placement)}
                      </td>
                    )}
                    <td className={`px-4 py-2 ${STATUS_COLORS[item.status]} whitespace-nowrap`}>
                      {item.status === 'uploading' && (
                        <span className="inline-block w-3 h-3 mr-2 border-2 border-jb-accent-purple border-t-transparent rounded-full animate-spin" />
                      )}
                      {STATUS_LABEL[item.status]}
                    </td>
                    <td className="px-4 py-2 text-jb-text-secondary text-xs truncate max-w-md" title={item.message}>
                      {item.message || '-'}
                    </td>
                    <td className="px-4 py-2">
                      {!running && item.status !== 'uploading' && (
                        <button
                          onClick={() => removeItem(idx)}
                          className="text-jb-text-secondary hover:text-jb-highlight-pink text-xs"
                        >
                          Remove
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
};
