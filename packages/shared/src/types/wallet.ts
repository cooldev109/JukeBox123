export interface Wallet {
  id: string;
  userId: string;
  balance: number;
  currency: string;
  lastTopUp: string | null;
  updatedAt: string;
}

export interface WalletTopUpInput {
  amount: number;
  paymentMethod: 'PIX';
}

export interface WalletSpendInput {
  amount: number;
  description: string;
  machineId?: string;
}
