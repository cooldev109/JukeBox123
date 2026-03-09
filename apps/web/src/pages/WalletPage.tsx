import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { CreditBadge, Button, Input, Card } from '@jukebox/ui';
import { useWalletStore } from '../stores/walletStore';

const TOPUP_OPTIONS = [5, 10, 20, 50]; // reais

export const WalletPage: React.FC = () => {
  const { balance, transactions, isLoading, pixQrCode, fetchWallet, fetchTransactions, generatePixQr, clearPix } = useWalletStore();
  const [customAmount, setCustomAmount] = useState('');
  const [showTopUp, setShowTopUp] = useState(false);

  useEffect(() => {
    fetchWallet();
    fetchTransactions();
  }, []);

  const handleTopUp = (amount: number) => {
    generatePixQr(amount);
  };

  const handleCustomTopUp = () => {
    const amount = parseFloat(customAmount);
    if (amount >= 1) {
      generatePixQr(amount);
    }
  };

  const transactionIcon = (type: string) => {
    switch (type) {
      case 'CREDIT': return '💰';
      case 'DEBIT': return '🎵';
      case 'TOPUP': return '➕';
      default: return '📋';
    }
  };

  return (
    <div className="min-h-screen bg-jb-bg-primary pb-24 px-4 pt-6">
      <div className="max-w-lg mx-auto">
        {/* Balance Card */}
        <Card glowColor="green" className="p-6 mb-6 text-center">
          <p className="text-jb-text-secondary text-sm mb-2">Your Balance</p>
          <CreditBadge balance={balance} size="lg" />
          <p className="text-jb-text-secondary text-xs mt-3">
            Credits work at any JukeBox in the network
          </p>
          <Button
            variant="primary"
            className="mt-4"
            onClick={() => { setShowTopUp(true); clearPix(); }}
          >
            Top Up Credits
          </Button>
        </Card>

        {/* Top Up Section */}
        {showTopUp && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="mb-6"
          >
            <Card className="p-6">
              <h3 className="text-lg font-bold text-jb-text-primary mb-4">Add Credits via Pix</h3>

              {pixQrCode ? (
                <div className="text-center space-y-4">
                  <div className="bg-white/10 p-4 rounded-xl">
                    <p className="text-jb-accent-green font-bold text-lg mb-2">Pix Payment Created</p>
                    <p className="text-jb-text-secondary text-xs font-mono break-all">{pixQrCode}</p>
                  </div>
                  <p className="text-jb-text-secondary text-sm">
                    Copy this Pix code to your banking app
                  </p>
                  <p className="text-jb-accent-green text-xs">
                    Payment will be confirmed automatically
                  </p>
                  <Button variant="ghost" onClick={() => { clearPix(); setShowTopUp(false); }}>
                    Cancel
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    {TOPUP_OPTIONS.map((amount) => (
                      <Button
                        key={amount}
                        variant="ghost"
                        fullWidth
                        loading={isLoading}
                        onClick={() => handleTopUp(amount)}
                      >
                        R$ {amount.toFixed(2)}
                      </Button>
                    ))}
                  </div>

                  <div className="flex items-center gap-3 my-2">
                    <div className="flex-1 h-px bg-white/10" />
                    <span className="text-jb-text-secondary text-xs">or custom amount</span>
                    <div className="flex-1 h-px bg-white/10" />
                  </div>

                  <div className="flex gap-2">
                    <Input
                      placeholder="R$ 0.00"
                      type="number"
                      value={customAmount}
                      onChange={(e) => setCustomAmount(e.target.value)}
                    />
                    <Button variant="primary" loading={isLoading} onClick={handleCustomTopUp}>
                      Go
                    </Button>
                  </div>

                  <Button variant="ghost" fullWidth onClick={() => setShowTopUp(false)}>
                    Cancel
                  </Button>
                </div>
              )}
            </Card>
          </motion.div>
        )}

        {/* Transaction History */}
        <div>
          <h3 className="text-lg font-bold text-jb-text-primary mb-3">Transaction History</h3>

          {transactions.length === 0 ? (
            <div className="text-center py-8 text-jb-text-secondary">
              <p>No transactions yet</p>
            </div>
          ) : (
            <div className="space-y-2">
              {transactions.map((tx) => (
                <div
                  key={tx.id}
                  className="flex items-center gap-3 p-3 rounded-lg bg-jb-bg-secondary/50 border border-white/5"
                >
                  <span className="text-xl">{transactionIcon(tx.type)}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-jb-text-primary text-sm font-medium truncate">
                      {tx.description || tx.type}
                    </p>
                    <p className="text-jb-text-secondary text-xs">
                      {new Date(tx.createdAt).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                  <span className={`font-bold text-sm ${tx.type === 'DEBIT' ? 'text-jb-highlight-pink' : 'text-jb-accent-green'}`}>
                    {tx.type === 'DEBIT' ? '-' : '+'}R$ {Math.abs(tx.amount).toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
