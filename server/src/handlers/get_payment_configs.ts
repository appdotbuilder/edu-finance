import { db } from '../db';
import { paymentConfigsTable } from '../db/schema';
import { type PaymentConfig } from '../schema';
import { eq } from 'drizzle-orm';

export const getPaymentConfigs = async (): Promise<PaymentConfig[]> => {
  try {
    // Query all active payment configurations
    const results = await db.select()
      .from(paymentConfigsTable)
      .where(eq(paymentConfigsTable.is_active, true))
      .execute();

    // Convert numeric fields back to numbers before returning
    return results.map(config => ({
      ...config,
      amount: parseFloat(config.amount) // Convert string back to number
    }));
  } catch (error) {
    console.error('Failed to fetch payment configurations:', error);
    throw error;
  }
};