import React, { useEffect, useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CreditBadge, Button, Input, Card } from '@jukebox/ui';
import { useWalletStore } from '../stores/walletStore';
import { StripeCardForm } from '../components/StripeCardForm';
import { useI18n } from '../lib/i18n';

const TOPUP_OPTIONS = [5, 10, 20, 50];

export const WalletPage: React.FC = () => {
  const { t } = useI18n();
  const {
    balance, transactions, isLoading, pixPayment, pixStatus, cardClientSecret, cardTransactionId, isSandbox,
    fetchWallet, fetchTransactions, generatePixTopUp, pollPixStatus, simulatePixPayment,
    topUpWithCard, checkProvider, clearPix, clearCard,
  } = useWalletStore();

  const [customAmount, setCustomAmount] = useState('');
  const [showTopUp, setShowTopUp] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'pix' | 'card'>('pix');
  const [copied, setCopied] = useState(false);
  const [pollError, setPollError] = useState('');
  const [cardAmount, setCardAmount] = useState(0);
  const pollRef = useRef<ReturnType<typeof setInterval>>();

  useEffect(() => {
    fetchWallet();
    fetchTransactions();
    checkProvider();
  }, []);

  // Auto-poll when Pix payment is pending
  useEffect(() => {
    if (pixStatus === 'pending' && pixPayment?.transactionId) {
      pollRef.current = setInterval(async () => {
        try {
          const status = await pollPixStatus(pixPayment.transactionId);
          if (status === 'COMPLETED' || status === 'FAILED') {
            clearInterval(pollRef.current);
            if (status === 'COMPLETED') {
              fetchTransactions();
            }
          }
        } catch {
          setPollError('Error checking payment status');
        }
      }, 3000);

      return () => clearInterval(pollRef.current);
    }
  }, [pixStatus, pixPayment?.transactionId]);

  // Clean up polling on unmount
  useEffect(() => {
    return () => clearInterval(pollRef.current);
  }, []);

  const handleTopUp = (amount: number) => {
    setPollError('');
    if (paymentMethod === 'card') {
      setCardAmount(amount);
      topUpWithCard(amount);
    } else {
      generatePixTopUp(amount);
    }
  };

  const handleCustomTopUp = () => {
    const amount = parseFloat(customAmount);
    if (amount >= 1) {
      handleTopUp(amount);
    }
  };

  const handleCopyPix = useCallback(async () => {
    if (!pixPayment?.pixCopiaECola) return;
    try {
      await navigator.clipboard.writeText(pixPayment.pixCopiaECola);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback: select text
      const textarea = document.createElement('textarea');
      textarea.value = pixPayment.pixCopiaECola;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [pixPayment?.pixCopiaECola]);

  const handleSimulate = async () => {
    if (!pixPayment?.transactionId) return;
    try {
      await simulatePixPayment(pixPayment.transactionId);
      fetchTransactions();
    } catch {
      setPollError('Simulation failed');
    }
  };

  const handleCancelPix = () => {
    clearInterval(pollRef.current);
    clearPix();
    setShowTopUp(false);
    setPollError('');
  };

  const transactionLabel = (tx: typeof transactions[0]) => {
    switch (tx.type) {
      case 'CREDIT_PURCHASE': return t('top_up');
      case 'SONG_PAYMENT': return t('song');
      case 'SKIP_QUEUE': return t('vip_song');
      case 'SILENCE': return t('silence');
      case 'VOICE_MSG': return t('voice_message');
      case 'REACTION': return t('reaction');
      case 'PHOTO': return t('photo');
      case 'BIRTHDAY_PACK': return t('birthday_pack');
      default: return tx.type;
    }
  };

  const transactionIcon = (type: string) => {
    switch (type) {
      case 'CREDIT_PURCHASE': return '+';
      case 'SONG_PAYMENT': case 'SKIP_QUEUE': return '-';
      default: return '-';
    }
  };

  const isCredit = (type: string) => type === 'CREDIT_PURCHASE';

  return (
    <div className="min-h-screen bg-jb-bg-primary pb-24 px-4 pt-6">
      <div className="max-w-lg mx-auto">
        {/* Balance Card */}
        <Card glowColor="green" className="p-6 mb-6 text-center">
          <p className="text-jb-text-secondary text-sm mb-2">{t('your_balance')}</p>
          <CreditBadge balance={balance} size="lg" />
          <p className="text-jb-text-secondary text-xs mt-3">
            {t('credits_network')}
          </p>
          <Button
            variant="primary"
            className="mt-4"
            onClick={() => { setShowTopUp(true); clearPix(); clearCard(); setPollError(''); }}
          >
            {t('top_up_credits')}
          </Button>
        </Card>

        {/* Top Up Section */}
        <AnimatePresence>
          {showTopUp && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mb-6"
            >
              <Card className="p-6">
                <h3 className="text-lg font-bold text-jb-text-primary mb-4">{t('add_credits')}</h3>

                {/* Payment Method Toggle */}
                {!pixPayment && !cardClientSecret && (
                  <div className="flex gap-2 mb-4">
                    <button
                      onClick={() => setPaymentMethod('pix')}
                      className={`flex-1 min-h-[44px] py-2 px-3 rounded-lg text-sm font-medium transition-all ${
                        paymentMethod === 'pix'
                          ? 'bg-jb-accent-green text-jb-bg-primary'
                          : 'bg-white/5 text-jb-text-secondary hover:bg-white/10'
                      }`}
                    >
                      {t('pix')}
                    </button>
                    <button
                      onClick={() => setPaymentMethod('card')}
                      className={`flex-1 min-h-[44px] py-2 px-3 rounded-lg text-sm font-medium transition-all ${
                        paymentMethod === 'card'
                          ? 'bg-jb-accent-purple text-white'
                          : 'bg-white/5 text-jb-text-secondary hover:bg-white/10'
                      }`}
                    >
                      {t('card')}
                    </button>
                  </div>
                )}

                {/* === PIX PAYMENT FLOW === */}
                {pixPayment && pixStatus === 'pending' ? (
                  <div className="space-y-4">
                    {/* QR Code Image */}
                    <div className="flex justify-center">
                      <div className="bg-white p-3 rounded-xl">
                        <img
                          src={pixPayment.qrCodeBase64}
                          alt="Pix QR Code"
                          className="w-full max-w-[200px] h-auto"
                        />
                      </div>
                    </div>

                    {/* Amount */}
                    <div className="text-center">
                      <p className="text-jb-accent-green font-bold text-xl">
                        R$ {pixPayment.amount.toFixed(2)}
                      </p>
                      <div className="flex items-center justify-center gap-2 mt-1">
                        <span className="w-2 h-2 bg-yellow-400 rounded-full animate-pulse" />
                        <p className="text-yellow-400 text-sm font-medium">
                          {t('waiting_payment')}
                        </p>
                      </div>
                    </div>

                    {/* Copia e Cola */}
                    <div className="bg-white/5 border border-white/10 rounded-lg p-3">
                      <p className="text-jb-text-secondary text-xs mb-2">{t('pix_copy_paste')}</p>
                      <p className="text-jb-text-primary text-xs font-mono break-all leading-relaxed">
                        {pixPayment.pixCopiaECola.length > 100
                          ? pixPayment.pixCopiaECola.slice(0, 100) + '...'
                          : pixPayment.pixCopiaECola}
                      </p>
                    </div>

                    {/* Copy Button */}
                    <Button variant="primary" fullWidth onClick={handleCopyPix}>
                      {copied ? t('copied') : t('copy_pix_code')}
                    </Button>

                    {/* Sandbox simulate button */}
                    {isSandbox && (
                      <Button
                        variant="ghost"
                        fullWidth
                        onClick={handleSimulate}
                        className="border border-yellow-500/30 text-yellow-400"
                      >
                        {t('sandbox_simulate')}
                      </Button>
                    )}

                    <p className="text-jb-text-secondary text-xs text-center">
                      {t('open_banking_app')}
                    </p>

                    {pollError && (
                      <p className="text-jb-highlight-pink text-xs text-center">{pollError}</p>
                    )}

                    <Button variant="ghost" fullWidth onClick={handleCancelPix}>
                      {t('cancel')}
                    </Button>
                  </div>
                ) : pixStatus === 'completed' ? (
                  <div className="text-center space-y-4 py-4">
                    <div className="w-16 h-16 mx-auto bg-jb-accent-green/20 rounded-full flex items-center justify-center">
                      <svg className="w-8 h-8 text-jb-accent-green" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <p className="text-jb-accent-green font-bold text-lg">{t('payment_success')}</p>
                    <p className="text-jb-text-secondary text-sm">
                      R$ {pixPayment?.amount.toFixed(2)} added to your balance
                    </p>
                    <Button
                      variant="primary"
                      onClick={() => { clearPix(); setShowTopUp(false); }}
                    >
                      {t('done')}
                    </Button>
                  </div>
                ) : pixStatus === 'failed' ? (
                  <div className="text-center space-y-4 py-4">
                    <div className="w-16 h-16 mx-auto bg-jb-highlight-pink/20 rounded-full flex items-center justify-center">
                      <svg className="w-8 h-8 text-jb-highlight-pink" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </div>
                    <p className="text-jb-highlight-pink font-bold text-lg">{t('payment_failed')}</p>
                    <p className="text-jb-text-secondary text-sm">
                      {t('payment_expired')}
                    </p>
                    <Button variant="primary" onClick={() => clearPix()}>
                      {t('try_again')}
                    </Button>
                  </div>
                ) : cardClientSecret ? (
                  <StripeCardForm
                    clientSecret={cardClientSecret}
                    amount={cardAmount}
                    transactionId={cardTransactionId || undefined}
                    onSuccess={() => {
                      clearCard();
                      fetchWallet();
                      fetchTransactions();
                      setShowTopUp(false);
                    }}
                    onCancel={() => { clearCard(); }}
                  />
                ) : (
                  /* Amount Selection */
                  <div className="space-y-4">
                    <div className="grid grid-cols-4 sm:grid-cols-4 gap-2 sm:gap-3">
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
                      <span className="text-jb-text-secondary text-xs">{t('custom_amount')}</span>
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
                        {t('add')}
                      </Button>
                    </div>

                    <Button variant="ghost" fullWidth onClick={() => setShowTopUp(false)}>
                      {t('cancel')}
                    </Button>
                  </div>
                )}
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Transaction History */}
        <div>
          <h3 className="text-lg font-bold text-jb-text-primary mb-3">{t('transaction_history')}</h3>

          {transactions.length === 0 ? (
            <div className="text-center py-8 text-jb-text-secondary">
              <p>{t('no_transactions')}</p>
            </div>
          ) : (
            <div className="space-y-2">
              {transactions.map((tx) => (
                <div
                  key={tx.id}
                  className="flex items-center gap-3 p-3 rounded-lg bg-jb-bg-secondary/50 border border-white/5"
                >
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                    isCredit(tx.type)
                      ? 'bg-jb-accent-green/20 text-jb-accent-green'
                      : 'bg-jb-highlight-pink/20 text-jb-highlight-pink'
                  }`}>
                    {transactionIcon(tx.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-jb-text-primary text-sm font-medium truncate">
                      {transactionLabel(tx)}
                    </p>
                    <p className="text-jb-text-secondary text-xs truncate">
                      {tx.paymentMethod === 'PIX' ? t('pix') : tx.paymentMethod === 'WALLET' ? 'Wallet' : t('card')}
                      {' · '}
                      {new Date(tx.createdAt).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <span className={`font-bold text-sm whitespace-nowrap ${isCredit(tx.type) ? 'text-jb-accent-green' : 'text-jb-highlight-pink'}`}>
                      {isCredit(tx.type) ? '+' : '-'}R$ {Math.abs(tx.amount).toFixed(2)}
                    </span>
                    <p className={`text-xs ${
                      tx.status === 'COMPLETED' ? 'text-jb-accent-green/60'
                        : tx.status === 'PENDING' ? 'text-yellow-400/60'
                        : 'text-jb-highlight-pink/60'
                    }`}>
                      {tx.status === 'COMPLETED' ? 'Confirmed' : tx.status === 'PENDING' ? 'Pending' : 'Failed'}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
