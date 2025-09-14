import { db } from '../db';
import { fundPositionsTable } from '../db/schema';
import { type FundPosition } from '../schema';
import { desc } from 'drizzle-orm';

export async function getFundPositions(): Promise<FundPosition[]> {
  try {
    const results = await db.select()
      .from(fundPositionsTable)
      .orderBy(desc(fundPositionsTable.created_at))
      .execute();

    // Convert numeric fields back to numbers before returning
    return results.map(fundPosition => ({
      ...fundPosition,
      balance: parseFloat(fundPosition.balance)
    }));
  } catch (error) {
    console.error('Failed to fetch fund positions:', error);
    throw error;
  }
}