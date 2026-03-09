// MVP transaction types. Stage 2 adds SILENCE, VOICE_MSG, REACTION, PHOTO, BIRTHDAY_PACK.
export enum TransactionType {
  CREDIT_PURCHASE = 'CREDIT_PURCHASE',
  SONG_PAYMENT = 'SONG_PAYMENT',
  SKIP_QUEUE = 'SKIP_QUEUE',
}

export enum PaymentMethod {
  PIX = 'PIX',
  WALLET = 'WALLET',
  // Stage 2: CREDIT_CARD, DEBIT_CARD
}

export enum TransactionStatus {
  PENDING = 'PENDING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  REFUNDED = 'REFUNDED',
}

export interface Transaction {
  id: string;
  userId: string;
  machineId: string | null;
  type: TransactionType;
  amount: number;
  currency: string;
  paymentMethod: PaymentMethod;
  status: TransactionStatus;
  pixTransactionId: string | null;
  createdAt: string;
}
