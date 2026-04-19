import React, { useState, useRef } from 'react';
import { Button } from '@jukebox/ui';
import { api } from '../lib/api';

interface MediaCaptureProps {
  type: 'audio' | 'photo' | 'video';
  maxDuration?: number; // seconds, for audio/video display
  onCapture: (url: string, duration?: number) => void;
  onCancel: () => void;
}

const ACCEPT_MAP = {
  audio: 'audio/*',
  photo: 'image/*',
  video: 'video/*',
};

const ICON_MAP = {
  audio: { emoji: '\uD83C\uDF99\uFE0F', label: 'Voice Message', color: 'cyan' },
  photo: { emoji: '\uD83D\uDCF8', label: 'Photo / Selfie', color: 'amber' },
  video: { emoji: '\uD83C\uDFA5', label: 'Video', color: 'purple' },
};

const MAX_FILE_SIZE = {
  audio: 5 * 1024 * 1024,  // 5MB
  photo: 10 * 1024 * 1024, // 10MB
  video: 20 * 1024 * 1024, // 20MB
};

export const MediaCapture: React.FC<MediaCaptureProps> = ({
  type,
  maxDuration,
  onCapture,
  onCancel,
}) => {
  const [status, setStatus] = useState<'idle' | 'preview' | 'uploading'>('idle');
  const [error, setError] = useState('');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [mediaDuration, setMediaDuration] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const icon = ICON_MAP[type];

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError('');

    // Check file size
    if (file.size > MAX_FILE_SIZE[type]) {
      const maxMB = MAX_FILE_SIZE[type] / (1024 * 1024);
      setError(`File too large. Maximum ${maxMB}MB.`);
      return;
    }

    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
    setStatus('preview');

    // Get duration for audio/video
    if (type === 'audio' || type === 'video') {
      const media = document.createElement(type === 'audio' ? 'audio' : 'video');
      media.src = URL.createObjectURL(file);
      media.onloadedmetadata = () => {
        setMediaDuration(Math.ceil(media.duration));
        URL.revokeObjectURL(media.src);
      };
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) return;
    setStatus('uploading');
    setError('');

    try {
      const reader = new window.FileReader();
      const base64Promise = new Promise<string>((resolve, reject) => {
        reader.onloadend = () => {
          const base64 = (reader.result as string).split(',')[1];
          resolve(base64);
        };
        reader.onerror = () => reject(new Error('Failed to read file'));
      });
      reader.readAsDataURL(selectedFile);
      const base64 = await base64Promise;

      const uploadType = type === 'video' ? 'image' : type; // backend accepts 'audio' or 'image'
      const { data } = await api.post('/events/upload', {
        file: base64,
        type: uploadType,
      });

      onCapture(data.data.url, type !== 'photo' ? mediaDuration : undefined);
    } catch (err: any) {
      const msg = err.response?.data?.error || err.message || 'Upload failed. Please try again.';
      setError(msg);
      setStatus('preview');
    }
  };

  const handleRetake = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setSelectedFile(null);
    setMediaDuration(0);
    setStatus('idle');
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (cameraInputRef.current) cameraInputRef.current.value = '';
  };

  return (
    <div className="space-y-4">
      {/* Hidden file input — Gallery only (no capture attribute) */}
      <input
        ref={fileInputRef}
        type="file"
        accept={ACCEPT_MAP[type]}
        onChange={handleFileSelect}
        className="hidden"
      />
      {/* Hidden camera input — only for photo */}
      {type === 'photo' && (
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleFileSelect}
          className="hidden"
        />
      )}

      {/* === IDLE — Choose file === */}
      {status === 'idle' && (
        <div className="text-center space-y-4 py-4">
          <div className={`w-20 h-20 mx-auto bg-${icon.color}-500/20 rounded-full flex items-center justify-center`}>
            <span className="text-4xl">{icon.emoji}</span>
          </div>
          <p className="text-jb-text-primary font-medium">Send {icon.label}</p>
          <p className="text-jb-text-secondary text-sm">
            {type === 'photo' && 'Your photo will be displayed on the TV screen for 3 minutes'}
            {type === 'audio' && `Send a voice message (max ${maxDuration || 20}s)`}
            {type === 'video' && `Send a short video (max ${maxDuration || 20}s)`}
          </p>
          <div className="flex gap-3">
            <Button
              variant="primary"
              fullWidth
              onClick={() => fileInputRef.current?.click()}
            >
              Choose from Gallery
            </Button>
          </div>
          {type === 'photo' && (
            <Button
              variant="secondary"
              fullWidth
              onClick={() => cameraInputRef.current?.click()}
            >
              Take Photo
            </Button>
          )}
        </div>
      )}

      {/* === PREVIEW === */}
      {status === 'preview' && previewUrl && (
        <div className="text-center space-y-4">
          {type === 'photo' && (
            <div className="rounded-xl overflow-hidden mx-auto border-2 border-jb-accent-green" style={{ maxWidth: 320 }}>
              <img src={previewUrl} alt="Preview" className="w-full" />
            </div>
          )}
          {type === 'audio' && (
            <div className="py-4">
              <audio controls src={previewUrl} className="mx-auto w-full max-w-xs" />
              {mediaDuration > 0 && (
                <p className="text-jb-text-secondary text-sm mt-2">Duration: {mediaDuration}s</p>
              )}
            </div>
          )}
          {type === 'video' && (
            <div className="rounded-xl overflow-hidden mx-auto border-2 border-jb-accent-purple" style={{ maxWidth: 320 }}>
              <video controls src={previewUrl} className="w-full" />
              {mediaDuration > 0 && (
                <p className="text-jb-text-secondary text-sm mt-2">Duration: {mediaDuration}s</p>
              )}
            </div>
          )}
          <p className="text-jb-text-secondary text-xs">
            {selectedFile?.name} ({(selectedFile?.size ? selectedFile.size / 1024 : 0).toFixed(0)} KB)
          </p>
          <div className="flex gap-3">
            <Button variant="ghost" fullWidth onClick={handleRetake}>
              Change
            </Button>
            <Button variant="primary" fullWidth onClick={handleUpload}>
              Send
            </Button>
          </div>
        </div>
      )}

      {/* === UPLOADING === */}
      {status === 'uploading' && (
        <div className="text-center space-y-4 py-8">
          <div className="w-10 h-10 border-2 border-jb-accent-green border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-jb-text-secondary">Uploading...</p>
        </div>
      )}

      {/* === ERROR === */}
      {error && (
        <p className="text-jb-highlight-pink text-sm text-center">{error}</p>
      )}

      {/* === CANCEL === */}
      {status !== 'uploading' && (
        <Button variant="ghost" fullWidth onClick={onCancel}>
          Cancel
        </Button>
      )}
    </div>
  );
};
