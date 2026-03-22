import { prisma } from '../lib/prisma.js';

/**
 * Get the effective price for a product at a given venue.
 * Venue override > base price.
 */
export async function getPrice(productCode: string, venueId?: string): Promise<{ price: number; product: { id: string; code: string; name: string; category: string; metadata: unknown } }> {
  const product = await prisma.product.findUnique({ where: { code: productCode } });
  if (!product) throw new Error(`Product not found: ${productCode}`);
  if (!product.isActive) throw new Error(`Product is not active: ${productCode}`);

  let price = product.basePrice;

  if (venueId) {
    const venuePrice = await prisma.venueProductPrice.findUnique({
      where: { venueId_productId: { venueId, productId: product.id } },
    });
    if (venuePrice && venuePrice.isActive) {
      price = venuePrice.price;
    }
  }

  return { price, product: { id: product.id, code: product.code, name: product.name, category: product.category, metadata: product.metadata } };
}

/**
 * Get all products included in a combo.
 */
export async function getComboContents(comboProductId: string) {
  const items = await prisma.comboItem.findMany({
    where: { comboId: comboProductId },
    include: { product: true },
  });
  return items;
}

/**
 * Validate that all products in a combo exist and are active.
 */
export async function validateCombo(comboProductId: string): Promise<boolean> {
  const combo = await prisma.product.findUnique({ where: { id: comboProductId } });
  if (!combo || combo.category !== 'COMBO') return false;

  const items = await prisma.comboItem.findMany({
    where: { comboId: comboProductId },
    include: { product: true },
  });

  return items.length > 0 && items.every(item => item.product.isActive);
}
