import React, { useState, useEffect } from 'react';
import { Card, Button } from '@jukebox/ui';
import { useAffiliateStore } from '../../stores/affiliateStore';

export const AffiliateQRCodePage: React.FC = () => {
  const { qrData, isLoading, fetchQRData } = useAffiliateStore();
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetchQRData();
  }, []);

  const handleCopy = async () => {
    if (!qrData?.shareUrl) return;
    try {
      await navigator.clipboard.writeText(qrData.shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers
      const textarea = document.createElement('textarea');
      textarea.value = qrData.shareUrl;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (isLoading) {
    return (
      <div>
        <h2 className="text-2xl font-bold text-jb-text-primary mb-6">
          QR Code & Referral Link
        </h2>
        <Card className="p-8 text-center">
          <p className="text-jb-text-secondary">Loading...</p>
        </Card>
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-2xl font-bold text-jb-text-primary mb-6">
        QR Code & Referral Link
      </h2>

      <div className="max-w-lg mx-auto space-y-6">
        {/* Referral Code */}
        <Card glowColor="pink" className="p-6 text-center">
          <p className="text-jb-text-secondary text-xs uppercase tracking-wider mb-2">
            Your Referral Code
          </p>
          <p className="text-4xl font-mono font-bold text-jb-highlight-pink tracking-widest">
            {qrData?.referralCode || '---'}
          </p>
        </Card>

        {/* Share URL */}
        <Card className="p-6">
          <p className="text-jb-text-secondary text-xs uppercase tracking-wider mb-3">
            Share URL
          </p>
          <div className="flex items-center gap-3">
            <div className="flex-1 bg-white/5 border border-white/10 rounded-lg px-4 py-3 overflow-hidden">
              <p className="text-jb-text-primary text-sm font-mono truncate">
                {qrData?.shareUrl || 'No URL available'}
              </p>
            </div>
            <Button
              variant="primary"
              onClick={handleCopy}
              disabled={!qrData?.shareUrl}
            >
              {copied ? 'Copied!' : 'Copy'}
            </Button>
          </div>
        </Card>

        {/* Instructions */}
        <Card className="p-6">
          <h3 className="text-lg font-bold text-jb-text-primary mb-4">
            How to Use
          </h3>
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <span className="text-jb-highlight-pink font-bold text-lg leading-none mt-0.5">1</span>
              <p className="text-jb-text-secondary text-sm">
                Share your referral link with bar and nightclub owners who might be interested in JukeBox.
              </p>
            </div>
            <div className="flex items-start gap-3">
              <span className="text-jb-highlight-pink font-bold text-lg leading-none mt-0.5">2</span>
              <p className="text-jb-text-secondary text-sm">
                When they sign up using your link, they are automatically linked to your affiliate account.
              </p>
            </div>
            <div className="flex items-start gap-3">
              <span className="text-jb-highlight-pink font-bold text-lg leading-none mt-0.5">3</span>
              <p className="text-jb-text-secondary text-sm">
                You earn commissions on every sale made at venues you referred. Track your earnings in the Dashboard and Commissions pages.
              </p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};
