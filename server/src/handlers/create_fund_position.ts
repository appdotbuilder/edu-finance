import { db } from '../db';
import { fundPositionsTable } from '../db/schema';
import { type CreateFundPositionInput, type FundPosition } from '../schema';

export const createFundPosition = async (input: CreateFundPositionInput): Promise<FundPosition> => {
  try {
    // Insert fund position record
    const result = await db.insert(fundPositionsTable)
      .values({
        name: input.name,
        description: input.description || null,
        balance: input.balance ? input.balance.toString() : '0' // Convert number to string for numeric column
      })
      .returning()
      .execute();

    // Convert numeric fields back to numbers before returning
    const fundPosition = result[0];
    return {
      ...fundPosition,
      balance: parseFloat(fundPosition.balance) // Convert string back to number
    };
  } catch (error) {
    console.error('Fund position creation failed:', error);
    throw error;
  }
};