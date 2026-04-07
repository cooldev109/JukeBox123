import React, { useState, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@jukebox/ui';
import { api } from '../lib/api';

interface MediaCaptureProps {
  type: 'audio' | 'photo';
  maxDuration?: number; // seconds, for audio
  onCapture: (url: string, duration?: number) => void;
  onCancel: () => void;
}

export const MediaCapture: React.FC<MediaCaptureProps> = ({
  type,
  maxDuration = 15,
  onCapture,
  onCancel,
}) => {
  const [status, setStatus] = useState<'idle' | 'recording' | 'preview' | 'uploading'>('idle');
  const [error, setError] = useState('');
  const [recordingTime, setRecordingTime] = useState(0);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [capturedBlob, setCapturedBlob] = useState<Blob | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval>>();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // === AUDIO RECORDING ===
  const startRecording = async () => {
    setError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];

      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        setCapturedBlob(blob);
        setPreviewUrl(URL.createObjectURL(blob));
        setStatus('preview');
        stream.getTracks().forEach(t => t.stop());
      };

      mediaRecorder.start();
      setStatus('recording');
      setRecordingTime(0);

      timerRef.current = setInterval(() => {
        setRecordingTime(prev => {
          if (prev >= maxDuration - 1) {
            stopRecording();
            return maxDuration;
          }
          return prev + 1;
        });
      }, 1000);
    } catch {
      setError('Microphone access denied. Please allow microphone permission.');
    }
  };

  const stopRecording = useCallback(() => {
    clearInterval(timerRef.current);
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
  }, []);

  // === PHOTO CAPTURE ===
  const startCamera = async () => {
    setError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: 640, height: 480 },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
      setStatus('recording');
    } catch {
      setError('Camera access denied. Please allow camera permission.');
    }
  };

  const takePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const video = videoRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);

    canvas.toBlob((blob) => {
      if (blob) {
        setCapturedBlob(blob);
        setPreviewUrl(canvas.toDataURL('image/jpeg', 0.8));
        setStatus('preview');
        streamRef.current?.getTracks().forEach(t => t.stop());
      }
    }, 'image/jpeg', 0.8);
  };

  // === UPLOAD ===
  const handleUpload = async () => {
    if (!capturedBlob) return;
    setStatus('uploading');
    setError('');

    try {
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve) => {
        reader.onloadend = () => {
          const base64 = (reader.result as string).split(',')[1];
          resolve(base64);
        };
      });
      reader.readAsDataURL(capturedBlob);
      const base64 = await base64Promise;

      const { data } = await api.post('/events/upload', {
        file: base64,
        type: type === 'audio' ? 'audio' : 'image',
      });

      onCapture(data.data.url, type === 'audio' ? recordingTime : undefined);
    } catch {
      setError('Upload failed. Please try again.');
      setStatus('preview');
    }
  };

  // === RETAKE ===
  const handleRetake = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setCapturedBlob(null);
    setRecordingTime(0);
    setStatus('idle');
  };

  // === CLEANUP ===
  const handleCancel = () => {
    clearInterval(timerRef.current);
    streamRef.current?.getTracks().forEach(t => t.stop());
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    onCancel();
  };

  return (
    <div className="space-y-4">
      {/* === AUDIO === */}
      {type === 'audio' && (
        <>
          {status === 'idle' && (
            <div className="text-center space-y-4 py-4">
              <div className="w-20 h-20 mx-auto bg-cyan-500/20 rounded-full flex items-center justify-center">
                <svg className="w-10 h-10 text-cyan-400" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" />
                  <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
                </svg>
              </div>
              <p className="text-jb-text-primary font-medium">Record a voice message</p>
              <p className="text-jb-text-secondary text-sm">Max {maxDuration} seconds</p>
              <Button variant="primary" onClick={startRecording}>
                Start Recording
              </Button>
            </div>
          )}

          {status === 'recording' && (
            <div className="text-center space-y-4 py-4">
              <motion.div
                animate={{ scale: [1, 1.1, 1] }}
                transition={{ repeat: Infinity, duration: 1 }}
                className="w-20 h-20 mx-auto bg-red-500/30 rounded-full flex items-center justify-center"
              >
                <div className="w-12 h-12 bg-red-500 rounded-full flex items-center justify-center">
                  <div className="w-4 h-4 bg-white rounded-sm" />
                </div>
              </motion.div>
              <p className="text-red-400 font-bold text-lg">Recording...</p>
              <p className="text-jb-text-primary text-2xl font-mono">
                {recordingTime}s / {maxDuration}s
              </p>
              <div className="w-full bg-white/10 rounded-full h-2">
                <div
                  className="bg-red-500 h-2 rounded-full transition-all"
                  style={{ width: `${(recordingTime / maxDuration) * 100}%` }}
                />
              </div>
              <Button variant="danger" onClick={stopRecording}>
                Stop Recording
              </Button>
            </div>
          )}

          {status === 'preview' && previewUrl && (
            <div className="text-center space-y-4 py-4">
              <p className="text-jb-text-primary font-medium">Preview ({recordingTime}s)</p>
              <audio controls src={previewUrl} className="mx-auto" />
              <div className="flex gap-3">
                <Button variant="ghost" fullWidth onClick={handleRetake}>
                  Retake
                </Button>
                <Button variant="primary" fullWidth onClick={handleUpload}>
                  Send
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      {/* === PHOTO === */}
      {type === 'photo' && (
        <>
          {status === 'idle' && (
            <div className="text-center space-y-4 py-4">
              <div className="w-20 h-20 mx-auto bg-amber-500/20 rounded-full flex items-center justify-center">
                <svg className="w-10 h-10 text-amber-400" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 15.2l-3.2-3.2L7.6 13.2l4.4 4.4 4.4-4.4-1.2-1.2z" />
                  <circle cx="12" cy="10" r="3" />
                  <path d="M20 4h-3.17L15 2H9L7.17 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 14H4V6h4.05l1.83-2h4.24l1.83 2H20v12z" />
                </svg>
              </div>
              <p className="text-jb-text-primary font-medium">Take a photo for the TV</p>
              <p className="text-jb-text-secondary text-sm">Your photo will be displayed on the bar's TV screen</p>
              <Button variant="primary" onClick={startCamera}>
                Open Camera
              </Button>
            </div>
          )}

          {status === 'recording' && (
            <div className="text-center space-y-4">
              <div className="relative rounded-xl overflow-hidden bg-black mx-auto" style={{ maxWidth: 320 }}>
                <video ref={videoRef} autoPlay playsInline muted className="w-full" style={{ transform: 'scaleX(-1)' }} />
              </div>
              <Button variant="primary" onClick={takePhoto}>
                Take Photo
              </Button>
            </div>
          )}

          {status === 'preview' && previewUrl && (
            <div className="text-center space-y-4">
              <div className="rounded-xl overflow-hidden mx-auto border-2 border-jb-accent-green" style={{ maxWidth: 320 }}>
                <img src={previewUrl} alt="Preview" className="w-full" />
              </div>
              <div className="flex gap-3">
                <Button variant="ghost" fullWidth onClick={handleRetake}>
                  Retake
                </Button>
                <Button variant="primary" fullWidth onClick={handleUpload}>
                  Send
                </Button>
              </div>
            </div>
          )}

          <canvas ref={canvasRef} className="hidden" />
        </>
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
        <Button variant="ghost" fullWidth onClick={handleCancel}>
          Cancel
        </Button>
      )}
    </div>
  );
};
