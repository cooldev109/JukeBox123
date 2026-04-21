import React, { useState, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Button, Card } from '@jukebox/ui';
import { api } from '../../lib/api';

type FileStatus = 'pending' | 'uploading' | 'success' | 'failed' | 'skipped';

interface FileItem {
  file: File;
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

export const BulkUploadPage: React.FC = () => {
  const [items, setItems] = useState<FileItem[]>([]);
  const [running, setRunning] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cancelRef = useRef(false);

  const addFiles = useCallback((files: ArrayLike<File>) => {
    const arr = Array.from(files);
    const mp3s = arr.filter(
      (f) => f.type === 'audio/mpeg' || f.name.toLowerCase().endsWith('.mp3')
    );
    if (mp3s.length === 0) return;
    setItems((prev) => {
      const existingNames = new Set(prev.map((p) => p.file.name + '_' + p.file.size));
      const newOnes: FileItem[] = mp3s
        .filter((f) => !existingNames.has(f.name + '_' + f.size))
        .map((f) => ({ file: f, status: 'pending' as FileStatus }));
      return [...prev, ...newOnes];
    });
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) addFiles(e.target.files);
    if (fileInputRef.current) fileInputRef.current.value = '';
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
        });

        const song = data?.data?.song;
        updateItem(i, {
          status: 'success',
          message: song ? `${song.title} - ${song.artist}` : 'Uploaded',
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

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex items-center gap-3 mb-4">
        <Link to="/admin/songs" className="text-jb-text-secondary text-sm hover:text-jb-accent-green">
          ← Music Catalog
        </Link>
      </div>

      <h2 className="text-2xl font-bold text-jb-text-primary mb-2">Bulk Upload Songs</h2>
      <p className="text-jb-text-secondary text-sm mb-6">
        Drag and drop MP3 files (or click to choose) to import many songs at once. Title, artist, album,
        and genre are read automatically from each file's ID3 tags. Max 50MB per file.
      </p>

      {/* Drop zone */}
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => !running && fileInputRef.current?.click()}
        className={`border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-all ${
          dragOver
            ? 'border-jb-accent-green bg-jb-accent-green/10'
            : 'border-white/20 bg-jb-bg-secondary/30 hover:border-jb-accent-purple'
        } ${running ? 'opacity-50 cursor-not-allowed' : ''}`}
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
        <div className="text-5xl mb-3">{'\uD83C\uDFB5'}</div>
        <p className="text-jb-text-primary font-medium mb-1">
          {dragOver ? 'Drop files here' : 'Drop MP3 files here, or click to choose'}
        </p>
        <p className="text-jb-text-secondary text-sm">
          You can select multiple files at once
        </p>
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
                  <th className="text-left px-4 py-2 text-jb-text-secondary font-normal">Size</th>
                  <th className="text-left px-4 py-2 text-jb-text-secondary font-normal">Status</th>
                  <th className="text-left px-4 py-2 text-jb-text-secondary font-normal">Details</th>
                  <th className="px-4 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, idx) => (
                  <tr key={idx} className="border-t border-white/5 hover:bg-white/5">
                    <td className="px-4 py-2 text-jb-text-secondary">{idx + 1}</td>
                    <td className="px-4 py-2 text-jb-text-primary truncate max-w-xs" title={item.file.name}>
                      {item.file.name}
                    </td>
                    <td className="px-4 py-2 text-jb-text-secondary whitespace-nowrap">
                      {(item.file.size / (1024 * 1024)).toFixed(1)} MB
                    </td>
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
