import crypto from 'crypto';

// ============================================
// Pix Gateway — Supports Mercado Pago, EFÍ, and Sandbox
// ============================================

export type PixProvider = 'mercadopago' | 'efi' | 'sandbox';

export interface PixChargeRequest {
  /** Amount in BRL (e.g. 5.00) */
  amount: number;
  /** Description shown to customer in banking app */
  description: string;
  /** Unique external reference for idempotency */
  externalReference: string;
  /** Expiration in seconds (default 300 = 5 minutes) */
  expirationSeconds?: number;
  /** Payer info (optional, for Mercado Pago) */
  payer?: {
    email?: string;
    name?: string;
    cpf?: string;
  };
}

export interface PixChargeResult {
  /** Provider's charge/transaction ID */
  providerChargeId: string;
  /** Pix "copia-e-cola" string (customer copies into bank app) */
  pixCopiaECola: string;
  /** QR code as base64 PNG image data (data:image/png;base64,...) */
  qrCodeBase64: string;
  /** Payment status */
  status: 'PENDING' | 'COMPLETED' | 'FAILED' | 'EXPIRED';
  /** Expiration timestamp */
  expiresAt: string;
}

export interface PixChargeStatus {
  providerChargeId: string;
  status: 'PENDING' | 'COMPLETED' | 'FAILED' | 'EXPIRED';
  paidAt?: string;
  paidAmount?: number;
}

export interface PixRefundResult {
  refundId: string;
  status: string;
}

export interface PixWebhookPayload {
  /** The external reference we sent when creating the charge */
  externalReference: string;
  /** Provider's charge ID */
  providerChargeId: string;
  /** Payment status */
  status: 'COMPLETED' | 'FAILED' | 'EXPIRED';
  /** Amount paid */
  amount: number;
  /** When the payment was made */
  paidAt?: string;
}

// ============================================
// Provider interface
// ============================================
interface PixGateway {
  createCharge(req: PixChargeRequest): Promise<PixChargeResult>;
  getChargeStatus(providerChargeId: string): Promise<PixChargeStatus>;
  refund(providerChargeId: string, amount?: number): Promise<PixRefundResult>;
  verifyWebhook(body: string | Buffer, signature: string): PixWebhookPayload;
}

// ============================================
// SANDBOX PROVIDER — Works without any API keys
// ============================================
class SandboxPixGateway implements PixGateway {
  // In-memory store for sandbox charges
  private charges = new Map<string, {
    id: string;
    externalReference: string;
    amount: number;
    status: 'PENDING' | 'COMPLETED' | 'FAILED' | 'EXPIRED';
    createdAt: Date;
    expiresAt: Date;
    paidAt?: Date;
  }>();

  async createCharge(req: PixChargeRequest): Promise<PixChargeResult> {
    const chargeId = `SANDBOX_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    const expiresAt = new Date(Date.now() + (req.expirationSeconds || 300) * 1000);

    this.charges.set(chargeId, {
      id: chargeId,
      externalReference: req.externalReference,
      amount: req.amount,
      status: 'PENDING',
      createdAt: new Date(),
      expiresAt,
    });

    // Generate a realistic-looking Pix copia-e-cola
    const pixPayload = this.generatePixPayload(chargeId, req.amount, req.description);

    // Generate a simple QR code as base64 SVG (no external dependency needed)
    const qrCodeBase64 = this.generateQrCodeSvgBase64(pixPayload);

    return {
      providerChargeId: chargeId,
      pixCopiaECola: pixPayload,
      qrCodeBase64,
      status: 'PENDING',
      expiresAt: expiresAt.toISOString(),
    };
  }

  async getChargeStatus(providerChargeId: string): Promise<PixChargeStatus> {
    const charge = this.charges.get(providerChargeId);
    if (!charge) {
      return { providerChargeId, status: 'FAILED' };
    }

    // Auto-expire if past expiration
    if (charge.status === 'PENDING' && new Date() > charge.expiresAt) {
      charge.status = 'EXPIRED';
    }

    return {
      providerChargeId,
      status: charge.status,
      paidAt: charge.paidAt?.toISOString(),
      paidAmount: charge.status === 'COMPLETED' ? charge.amount : undefined,
    };
  }

  async refund(providerChargeId: string): Promise<PixRefundResult> {
    const charge = this.charges.get(providerChargeId);
    if (charge) {
      charge.status = 'FAILED'; // Sandbox refund just sets to failed
    }
    return {
      refundId: `REFUND_${crypto.randomBytes(4).toString('hex')}`,
      status: 'completed',
    };
  }

  verifyWebhook(body: string | Buffer, _signature: string): PixWebhookPayload {
    // Sandbox accepts all webhooks (no signature verification)
    const data = typeof body === 'string' ? JSON.parse(body) : JSON.parse(body.toString());
    return {
      externalReference: data.externalReference || data.external_reference,
      providerChargeId: data.providerChargeId || data.id,
      status: data.status || 'COMPLETED',
      amount: data.amount || 0,
      paidAt: data.paidAt || new Date().toISOString(),
    };
  }

  /**
   * SANDBOX ONLY: Simulate a payment confirmation.
   * Call this from a test endpoint to trigger payment completion.
   */
  simulatePayment(providerChargeId: string): PixWebhookPayload | null {
    const charge = this.charges.get(providerChargeId);
    if (!charge || charge.status !== 'PENDING') return null;

    charge.status = 'COMPLETED';
    charge.paidAt = new Date();

    return {
      externalReference: charge.externalReference,
      providerChargeId: charge.id,
      status: 'COMPLETED',
      amount: charge.amount,
      paidAt: charge.paidAt.toISOString(),
    };
  }

  private generatePixPayload(chargeId: string, amount: number, description: string): string {
    // EMV QR Code format (simplified but realistic-looking)
    const merchant = 'JUKEBOX SANDBOX';
    const city = 'SAO PAULO';
    return [
      '00020126',
      `580014br.gov.bcb.pix`,
      `0136${chargeId}`,
      `52040000`,
      `5303986`,
      `5404${amount.toFixed(2)}`,
      `5802BR`,
      `5913${merchant}`,
      `6009${city}`,
      `62070503***`,
      `6304`,
    ].join('');
  }

  private generateQrCodeSvgBase64(data: string): string {
    // Generate a simple visual QR-like SVG for sandbox mode.
    // In production, the real provider returns the actual QR code image.
    const hash = crypto.createHash('md5').update(data).digest('hex');
    const size = 200;
    const cellSize = size / 25;
    let rects = '';

    // Generate deterministic pattern from the hash (looks like a QR code)
    for (let row = 0; row < 25; row++) {
      for (let col = 0; col < 25; col++) {
        // Position detection patterns (the 3 big squares in corners)
        const isFinderPattern =
          (row < 7 && col < 7) ||
          (row < 7 && col > 17) ||
          (row > 17 && col < 7);

        const isFinderBorder =
          isFinderPattern && (
            row === 0 || row === 6 || col === 0 || col === 6 ||
            (row >= 0 && row <= 6 && (col === 0 || col === 6)) ||
            (col >= 0 && col <= 6 && (row === 0 || row === 6)) ||
            (row >= 18 && row <= 24 && (col === 0 || col === 6)) ||
            (col >= 18 && col <= 24 && (row === 0 || row === 6))
          );

        const isFinderCenter =
          isFinderPattern && row >= 2 && row <= 4 && col >= 2 && col <= 4;

        const idx = (row * 25 + col) % 32;
        const bit = parseInt(hash[Math.floor(idx / 4)], 16) & (1 << (idx % 4));

        if (isFinderBorder || isFinderCenter || (!isFinderPattern && bit)) {
          rects += `<rect x="${col * cellSize}" y="${row * cellSize}" width="${cellSize}" height="${cellSize}" fill="#000"/>`;
        }
      }
    }

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
      <rect width="${size}" height="${size}" fill="#fff"/>
      ${rects}
    </svg>`;

    const base64 = Buffer.from(svg).toString('base64');
    return `data:image/svg+xml;base64,${base64}`;
  }
}

// ============================================
// MERCADO PAGO PROVIDER
// ============================================
class MercadoPagoPixGateway implements PixGateway {
  private accessToken: string;
  private baseUrl: string;
  private webhookSecret: string;

  constructor() {
    this.accessToken = process.env.PIX_ACCESS_TOKEN || '';
    this.baseUrl = process.env.PIX_GATEWAY_URL || 'https://api.mercadopago.com';
    this.webhookSecret = process.env.PIX_WEBHOOK_SECRET || '';
  }

  async createCharge(req: PixChargeRequest): Promise<PixChargeResult> {
    const expirationDate = new Date(Date.now() + (req.expirationSeconds || 300) * 1000);

    const body = {
      transaction_amount: req.amount,
      description: req.description,
      payment_method_id: 'pix',
      payer: {
        email: req.payer?.email || 'customer@jukebox.app',
        first_name: req.payer?.name?.split(' ')[0] || 'Customer',
        last_name: req.payer?.name?.split(' ').slice(1).join(' ') || '',
        identification: req.payer?.cpf ? {
          type: 'CPF',
          number: req.payer.cpf,
        } : undefined,
      },
      date_of_expiration: expirationDate.toISOString(),
      external_reference: req.externalReference,
    };

    const response = await fetch(`${this.baseUrl}/v1/payments`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
        'X-Idempotency-Key': req.externalReference,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Mercado Pago error: ${response.status} — ${error}`);
    }

    const data = await response.json();
    const pixData = data.point_of_interaction?.transaction_data;

    return {
      providerChargeId: String(data.id),
      pixCopiaECola: pixData?.qr_code || '',
      qrCodeBase64: pixData?.qr_code_base64
        ? `data:image/png;base64,${pixData.qr_code_base64}`
        : '',
      status: this.mapStatus(data.status),
      expiresAt: expirationDate.toISOString(),
    };
  }

  async getChargeStatus(providerChargeId: string): Promise<PixChargeStatus> {
    const response = await fetch(`${this.baseUrl}/v1/payments/${providerChargeId}`, {
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Mercado Pago status check failed: ${response.status}`);
    }

    const data = await response.json();

    return {
      providerChargeId: String(data.id),
      status: this.mapStatus(data.status),
      paidAt: data.date_approved || undefined,
      paidAmount: data.transaction_amount,
    };
  }

  async refund(providerChargeId: string, amount?: number): Promise<PixRefundResult> {
    const body = amount ? { amount } : {};

    const response = await fetch(`${this.baseUrl}/v1/payments/${providerChargeId}/refunds`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new Error(`Mercado Pago refund failed: ${response.status}`);
    }

    const data = await response.json();
    return {
      refundId: String(data.id),
      status: data.status,
    };
  }

  verifyWebhook(body: string | Buffer, signature: string): PixWebhookPayload {
    // Mercado Pago webhook signature verification
    // Format: ts=<timestamp>,v1=<hash>
    if (this.webhookSecret) {
      const parts = signature.split(',');
      const ts = parts.find(p => p.startsWith('ts='))?.slice(3);
      const v1 = parts.find(p => p.startsWith('v1='))?.slice(3);

      if (ts && v1) {
        const manifest = `id:;request-id:;ts:${ts};`;
        const expectedHmac = crypto
          .createHmac('sha256', this.webhookSecret)
          .update(manifest)
          .digest('hex');

        if (expectedHmac !== v1) {
          throw new Error('Invalid Mercado Pago webhook signature');
        }
      }
    }

    const data = typeof body === 'string' ? JSON.parse(body) : JSON.parse(body.toString());

    // Mercado Pago sends notification with action and data.id
    // We need to fetch the payment details to get full info
    return {
      externalReference: data.external_reference || '',
      providerChargeId: String(data.data?.id || data.id || ''),
      status: this.mapWebhookStatus(data.action === 'payment.updated' ? 'approved' : data.status),
      amount: data.transaction_amount || 0,
      paidAt: data.date_approved || new Date().toISOString(),
    };
  }

  private mapWebhookStatus(mpStatus: string): 'COMPLETED' | 'FAILED' | 'EXPIRED' {
    switch (mpStatus) {
      case 'approved': return 'COMPLETED';
      case 'expired': return 'EXPIRED';
      default: return 'FAILED';
    }
  }

  private mapStatus(mpStatus: string): 'PENDING' | 'COMPLETED' | 'FAILED' | 'EXPIRED' {
    switch (mpStatus) {
      case 'approved': return 'COMPLETED';
      case 'pending':
      case 'in_process':
      case 'authorized': return 'PENDING';
      case 'expired': return 'EXPIRED';
      default: return 'FAILED';
    }
  }
}

// ============================================
// EFÍ (Gerencianet) PROVIDER
// ============================================
class EfiPixGateway implements PixGateway {
  private clientId: string;
  private clientSecret: string;
  private baseUrl: string;
  private webhookSecret: string;
  private certificate: string;
  private accessToken: string | null = null;
  private tokenExpiresAt: number = 0;

  constructor() {
    this.clientId = process.env.EFI_CLIENT_ID || '';
    this.clientSecret = process.env.EFI_CLIENT_SECRET || '';
    this.baseUrl = process.env.EFI_BASE_URL || 'https://pix.api.efipay.com.br';
    this.webhookSecret = process.env.PIX_WEBHOOK_SECRET || '';
    this.certificate = process.env.EFI_CERTIFICATE_PATH || '';
  }

  private async authenticate(): Promise<string> {
    if (this.accessToken && Date.now() < this.tokenExpiresAt) {
      return this.accessToken;
    }

    const credentials = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64');

    const response = await fetch(`${this.baseUrl}/oauth/token`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ grant_type: 'client_credentials' }),
    });

    if (!response.ok) {
      throw new Error(`EFÍ authentication failed: ${response.status}`);
    }

    const data = await response.json();
    this.accessToken = data.access_token;
    this.tokenExpiresAt = Date.now() + (data.expires_in - 60) * 1000;
    return this.accessToken!;
  }

  async createCharge(req: PixChargeRequest): Promise<PixChargeResult> {
    const token = await this.authenticate();
    const expSeconds = req.expirationSeconds || 300;
    const expiresAt = new Date(Date.now() + expSeconds * 1000);

    // Step 1: Create the charge (cobrança)
    const txId = req.externalReference.replace(/[^a-zA-Z0-9]/g, '').slice(0, 35);

    const chargeBody = {
      calendario: { expiracao: expSeconds },
      valor: { original: req.amount.toFixed(2) },
      chave: process.env.EFI_PIX_KEY || '', // Your registered Pix key
      infoAdicionais: [
        { nome: 'JukeBox', valor: req.description },
      ],
    };

    const chargeResponse = await fetch(`${this.baseUrl}/v2/cob/${txId}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(chargeBody),
    });

    if (!chargeResponse.ok) {
      const error = await chargeResponse.text();
      throw new Error(`EFÍ charge creation failed: ${chargeResponse.status} — ${error}`);
    }

    const chargeData = await chargeResponse.json();

    // Step 2: Get the QR code for this charge
    const qrResponse = await fetch(`${this.baseUrl}/v2/loc/${chargeData.loc.id}/qrcode`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });

    if (!qrResponse.ok) {
      throw new Error(`EFÍ QR code generation failed: ${qrResponse.status}`);
    }

    const qrData = await qrResponse.json();

    return {
      providerChargeId: txId,
      pixCopiaECola: qrData.qrcode || chargeData.pixCopiaECola || '',
      qrCodeBase64: qrData.imagemQrcode
        ? (qrData.imagemQrcode.startsWith('data:') ? qrData.imagemQrcode : `data:image/png;base64,${qrData.imagemQrcode}`)
        : '',
      status: 'PENDING',
      expiresAt: expiresAt.toISOString(),
    };
  }

  async getChargeStatus(providerChargeId: string): Promise<PixChargeStatus> {
    const token = await this.authenticate();

    const response = await fetch(`${this.baseUrl}/v2/cob/${providerChargeId}`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });

    if (!response.ok) {
      throw new Error(`EFÍ status check failed: ${response.status}`);
    }

    const data = await response.json();

    return {
      providerChargeId,
      status: this.mapStatus(data.status),
      paidAt: data.pix?.[0]?.horario,
      paidAmount: data.pix?.[0]?.valor ? parseFloat(data.pix[0].valor) : undefined,
    };
  }

  async refund(providerChargeId: string, amount?: number): Promise<PixRefundResult> {
    const token = await this.authenticate();

    // Get the e2eid from the charge
    const statusResp = await fetch(`${this.baseUrl}/v2/cob/${providerChargeId}`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });
    const statusData = await statusResp.json();
    const e2eid = statusData.pix?.[0]?.endToEndId;
    if (!e2eid) throw new Error('No e2eid found for refund');

    const refundId = crypto.randomBytes(8).toString('hex');
    const body = amount ? { valor: amount.toFixed(2) } : { valor: statusData.valor.original };

    const response = await fetch(`${this.baseUrl}/v2/pix/${e2eid}/devolucao/${refundId}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new Error(`EFÍ refund failed: ${response.status}`);
    }

    const data = await response.json();
    return {
      refundId: data.rtrId || refundId,
      status: data.status,
    };
  }

  verifyWebhook(body: string | Buffer, signature: string): PixWebhookPayload {
    // EFÍ uses mTLS for webhook authentication, but also supports HMAC
    if (this.webhookSecret && signature) {
      const expectedHmac = crypto
        .createHmac('sha256', this.webhookSecret)
        .update(typeof body === 'string' ? body : body.toString())
        .digest('hex');

      if (expectedHmac !== signature) {
        throw new Error('Invalid EFÍ webhook signature');
      }
    }

    const data = typeof body === 'string' ? JSON.parse(body) : JSON.parse(body.toString());
    const pixEvent = data.pix?.[0];

    return {
      externalReference: pixEvent?.txid || data.txid || '',
      providerChargeId: pixEvent?.txid || data.txid || '',
      status: 'COMPLETED', // EFÍ only sends webhook on successful payment
      amount: pixEvent?.valor ? parseFloat(pixEvent.valor) : 0,
      paidAt: pixEvent?.horario || new Date().toISOString(),
    };
  }

  private mapStatus(efiStatus: string): 'PENDING' | 'COMPLETED' | 'FAILED' | 'EXPIRED' {
    switch (efiStatus) {
      case 'CONCLUIDA': return 'COMPLETED';
      case 'ATIVA': return 'PENDING';
      case 'REMOVIDA_PELO_USUARIO_RECEBEDOR':
      case 'REMOVIDA_PELO_PSP': return 'EXPIRED';
      default: return 'FAILED';
    }
  }
}

// ============================================
// Factory — creates the right provider based on env
// ============================================
function getPixProvider(): PixProvider {
  const provider = (process.env.PIX_PROVIDER || 'sandbox').toLowerCase() as PixProvider;
  if (['mercadopago', 'efi', 'sandbox'].includes(provider)) {
    return provider;
  }
  return 'sandbox';
}

let gatewayInstance: PixGateway | null = null;
let sandboxInstance: SandboxPixGateway | null = null;

export function getPixGateway(): PixGateway {
  if (!gatewayInstance) {
    const provider = getPixProvider();
    switch (provider) {
      case 'mercadopago':
        gatewayInstance = new MercadoPagoPixGateway();
        break;
      case 'efi':
        gatewayInstance = new EfiPixGateway();
        break;
      case 'sandbox':
      default:
        sandboxInstance = new SandboxPixGateway();
        gatewayInstance = sandboxInstance;
        break;
    }
    console.log(`[Pix] Using provider: ${provider}`);
  }
  return gatewayInstance;
}

/**
 * SANDBOX ONLY: Simulate a customer paying a Pix charge.
 * Returns null if not in sandbox mode or charge not found.
 */
export function simulatePixPayment(providerChargeId: string): PixWebhookPayload | null {
  if (!sandboxInstance) return null;
  return sandboxInstance.simulatePayment(providerChargeId);
}

/**
 * Get the current Pix provider name.
 */
export function getPixProviderName(): PixProvider {
  return getPixProvider();
}
