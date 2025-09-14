import { db } from '../db';
import { accountsTable } from '../db/schema';
import { type Account } from '../schema';
import { desc } from 'drizzle-orm';

export async function getAccounts(): Promise<Account[]> {
  try {
    const results = await db.select()
      .from(accountsTable)
      .orderBy(desc(accountsTable.created_at))
      .execute();

    // Convert numeric fields back to numbers before returning
    return results.map(account => ({
      ...account,
      balance: parseFloat(account.balance) // Convert string back to number
    }));
  } catch (error) {
    console.error('Failed to fetch accounts:', error);
    throw error;
  }
}