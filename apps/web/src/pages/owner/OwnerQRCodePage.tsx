import React, { useEffect, useState, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import { QRCodeCanvas } from 'qrcode.react';
import { Card, Button } from '@jukebox/ui';
import { useBarOwnerStore } from '../../stores/barOwnerStore';

export const OwnerQRCodePage: React.FC = () => {
  const { venue, fetchVenue, isLoading } = useBarOwnerStore();
  const [baseUrl, setBaseUrl] = useState('');
  const qrRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchVenue();
    setBaseUrl(window.location.origin);
  }, []);

  const qrUrl = venue?.code
    ? `${baseUrl}/?venue=${encodeURIComponent(venue.code)}`
    : '';

  const handleDownload = useCallback(() => {
    const canvas = qrRef.current?.querySelector('canvas');
    if (!canvas) return;
    const url = canvas.toDataURL('image/png');
    const link = document.createElement('a');
    link.download = `jukebox-qr-${venue?.code || 'venue'}.png`;
    link.href = url;
    link.click();
  }, [venue?.code]);

  const handlePrint = useCallback(() => {
    const canvas = qrRef.current?.querySelector('canvas');
    if (!canvas) return;
    const dataUrl = canvas.toDataURL('image/png');
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    printWindow.document.write(`
      <html>
        <head><title>JukeBox QR - ${venue?.name || ''}</title></head>
        <body style="display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;margin:0;font-family:sans-serif;">
          <h1 style="margin-bottom:4px;">JukeBox</h1>
          <h2 style="margin-top:0;color:#555;">${venue?.name || ''}</h2>
          <img src="${dataUrl}" style="width:400px;height:400px;" />
          <p style="font-size:24px;font-weight:bold;margin-top:20px;">Code: ${venue?.code || ''}</p>
          <p style="color:#666;">Scan this QR code to play music!</p>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.onload = () => {
      printWindow.print();
      printWindow.close();
    };
  }, [venue]);

  if (isLoading || !venue) {
    return (
      <div className="text-center py-20">
        <p className="text-jb-text-secondary">Loading venue data...</p>
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-2xl font-bold text-jb-text-primary mb-6">QR Code</h2>

      <div className="max-w-lg mx-auto space-y-6">
        {/* Venue Info */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <Card glowColor="green" className="p-6 text-center">
            <h3 className="text-xl font-bold text-jb-text-primary mb-1">{venue.name}</h3>
            <p className="text-jb-accent-green text-lg font-mono font-bold tracking-wider">
              {venue.code}
            </p>
            <p className="text-jb-text-secondary text-sm mt-2">
              Customers scan this code to start playing music
            </p>
          </Card>
        </motion.div>

        {/* QR Code Display */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1 }}
        >
          <Card hoverable={false} className="p-8 flex flex-col items-center">
            <div ref={qrRef} className="bg-white p-4 rounded-xl">
              <QRCodeCanvas
                value={qrUrl}
                size={280}
                level="H"
                marginSize={2}
              />
            </div>
            <p className="text-jb-text-secondary text-xs mt-4 text-center break-all max-w-xs">
              {qrUrl}
            </p>
          </Card>
        </motion.div>

        {/* Action Buttons */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="grid grid-cols-2 gap-4"
        >
          <Button variant="primary" fullWidth onClick={handleDownload}>
            Download PNG
          </Button>
          <Button variant="secondary" fullWidth onClick={handlePrint}>
            Print
          </Button>
        </motion.div>

        {/* Instructions */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
        >
          <Card hoverable={false} className="p-5">
            <h4 className="text-sm font-bold text-jb-accent-purple mb-3">
              How to use
            </h4>
            <ul className="space-y-2 text-jb-text-secondary text-sm">
              <li className="flex items-start gap-2">
                <span className="text-jb-accent-green mt-0.5">1.</span>
                <span>Download or print the QR code above</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-jb-accent-green mt-0.5">2.</span>
                <span>Place it on tables, walls, or near the bar counter</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-jb-accent-green mt-0.5">3.</span>
                <span>Customers scan with their phone camera to open the jukebox</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-jb-accent-green mt-0.5">4.</span>
                <span>They can browse songs and start playing immediately</span>
              </li>
            </ul>
          </Card>
        </motion.div>
      </div>
    </div>
  );
};
