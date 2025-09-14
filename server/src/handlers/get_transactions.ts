import { db } from '../db';
import { transactionsTable } from '../db/schema';
import { type GetTransactionsQuery, type Transaction } from '../schema';
import { eq, gte, lte, and, desc } from 'drizzle-orm';

export async function getTransactions(query: GetTransactionsQuery = {}): Promise<Transaction[]> {
  try {
    const conditions = [];

    // Filter by transaction type
    if (query.type) {
      conditions.push(eq(transactionsTable.type, query.type));
    }

    // Filter by account ID
    if (query.account_id) {
      conditions.push(eq(transactionsTable.account_id, query.account_id));
    }

    // Filter by date range
    if (query.date_from) {
      const fromDate = new Date(query.date_from);
      conditions.push(gte(transactionsTable.created_at, fromDate));
    }

    if (query.date_to) {
      const toDate = new Date(query.date_to);
      conditions.push(lte(transactionsTable.created_at, toDate));
    }

    // Build query with conditions
    const whereClause = conditions.length === 0 
      ? undefined 
      : conditions.length === 1 
        ? conditions[0] 
        : and(...conditions);

    let queryBuilder;

    if (whereClause) {
      queryBuilder = db.select()
        .from(transactionsTable)
        .where(whereClause);
    } else {
      queryBuilder = db.select()
        .from(transactionsTable);
    }

    // Execute query with ordering and pagination
    const results = await queryBuilder
      .orderBy(desc(transactionsTable.created_at))
      .limit(query.limit || 50)
      .offset(query.offset || 0)
      .execute();

    // Convert numeric fields back to numbers and return
    return results.map(transaction => ({
      ...transaction,
      amount: parseFloat(transaction.amount)
    }));

  } catch (error) {
    console.error('Get transactions failed:', error);
    throw error;
  }
}