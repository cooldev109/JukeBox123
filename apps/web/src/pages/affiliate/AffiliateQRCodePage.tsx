import React, { useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Card, Button, Skeleton } from '@jukebox/ui';
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
        <div className="max-w-lg mx-auto space-y-6">
          <Card className="p-6 text-center">
            <Skeleton className="h-4 w-32 mx-auto mb-3" />
            <Skeleton className="h-10 w-48 mx-auto" />
          </Card>
          <Card className="p-6 text-center">
            <Skeleton className="h-48 w-48 mx-auto mb-4" />
            <Skeleton className="h-4 w-64 mx-auto" />
          </Card>
        </div>
      </div>
    );
  }

  if (!qrData) {
    return (
      <div>
        <h2 className="text-2xl font-bold text-jb-text-primary mb-6">
          QR Code & Referral Link
        </h2>
        <Card className="p-8 text-center">
          <p className="text-jb-text-secondary">
            Unable to load referral data. Please try again later.
          </p>
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
            {qrData.referralCode}
          </p>
        </Card>

        {/* QR Code */}
        <Card glowColor="purple" className="p-6 text-center">
          <p className="text-jb-text-secondary text-xs uppercase tracking-wider mb-4">
            Scan to Register with Your Referral
          </p>
          <div className="inline-block p-4 bg-white rounded-xl">
            <QRCodeSVG
              value={qrData.shareUrl}
              size={200}
              level="H"
              includeMargin={false}
              bgColor="#ffffff"
              fgColor="#0F0F0F"
            />
          </div>
          <p className="text-jb-text-secondary/60 text-xs mt-3">
            Venue owners can scan this code to sign up with your referral
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
                {qrData.shareUrl}
              </p>
            </div>
            <Button
              variant="primary"
              onClick={handleCopy}
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
              <span className="text-jb-highlight-pink font-bold text-lg leading-none mt-0.5">
                1
              </span>
              <p className="text-jb-text-secondary text-sm">
                Share your referral link or QR code with bar and nightclub
                owners who might be interested in JukeBox.
              </p>
            </div>
            <div className="flex items-start gap-3">
              <span className="text-jb-highlight-pink font-bold text-lg leading-none mt-0.5">
                2
              </span>
              <p className="text-jb-text-secondary text-sm">
                When they sign up using your link, they are automatically linked
                to your affiliate account.
              </p>
            </div>
            <div className="flex items-start gap-3">
              <span className="text-jb-highlight-pink font-bold text-lg leading-none mt-0.5">
                3
              </span>
              <p className="text-jb-text-secondary text-sm">
                You earn commissions on every sale made at venues you referred.
                Track your earnings in the Dashboard and Commissions pages.
              </p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};
