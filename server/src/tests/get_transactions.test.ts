import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { transactionsTable, accountsTable, fundPositionsTable } from '../db/schema';
import { type GetTransactionsQuery } from '../schema';
import { getTransactions } from '../handlers/get_transactions';

describe('getTransactions', () => {
  let testAccountId: number;
  let testFundPositionId: number;

  beforeEach(async () => {
    await createDB();
    
    // Create test account
    const [account] = await db.insert(accountsTable).values({
      name: 'Test Cash Account',
      type: 'CASH',
      balance: '1000.00'
    }).returning().execute();
    testAccountId = account.id;

    // Create test fund position
    const [fundPosition] = await db.insert(fundPositionsTable).values({
      name: 'Test Fund',
      balance: '500.00'
    }).returning().execute();
    testFundPositionId = fundPosition.id;
  });

  afterEach(resetDB);

  it('should return all transactions when no filters provided', async () => {
    // Create test transactions
    await db.insert(transactionsTable).values([
      {
        type: 'INCOME',
        amount: '100.50',
        description: 'Income transaction',
        account_id: testAccountId,
        created_by: 'test_user'
      },
      {
        type: 'EXPENSE',
        amount: '50.25',
        description: 'Expense transaction',
        account_id: testAccountId,
        created_by: 'test_user'
      }
    ]).execute();

    const result = await getTransactions();

    expect(result).toHaveLength(2);
    expect(result[0].amount).toEqual(50.25); // Most recent first due to ordering
    expect(result[0].type).toEqual('EXPENSE');
    expect(result[1].amount).toEqual(100.50);
    expect(result[1].type).toEqual('INCOME');
    expect(typeof result[0].amount).toBe('number');
  });

  it('should filter by transaction type', async () => {
    // Create transactions of different types
    await db.insert(transactionsTable).values([
      {
        type: 'INCOME',
        amount: '100.00',
        description: 'Income',
        account_id: testAccountId,
        created_by: 'test_user'
      },
      {
        type: 'EXPENSE',
        amount: '50.00',
        description: 'Expense',
        account_id: testAccountId,
        created_by: 'test_user'
      },
      {
        type: 'TRANSFER',
        amount: '25.00',
        description: 'Transfer',
        account_id: testAccountId,
        fund_position_id: testFundPositionId,
        created_by: 'test_user'
      }
    ]).execute();

    const query: GetTransactionsQuery = { type: 'INCOME' };
    const result = await getTransactions(query);

    expect(result).toHaveLength(1);
    expect(result[0].type).toEqual('INCOME');
    expect(result[0].amount).toEqual(100.00);
  });

  it('should filter by account ID', async () => {
    // Create second account
    const [secondAccount] = await db.insert(accountsTable).values({
      name: 'Second Account',
      type: 'BANK',
      balance: '2000.00'
    }).returning().execute();

    // Create transactions for different accounts
    await db.insert(transactionsTable).values([
      {
        type: 'INCOME',
        amount: '100.00',
        description: 'First account transaction',
        account_id: testAccountId,
        created_by: 'test_user'
      },
      {
        type: 'INCOME',
        amount: '200.00',
        description: 'Second account transaction',
        account_id: secondAccount.id,
        created_by: 'test_user'
      }
    ]).execute();

    const query: GetTransactionsQuery = { account_id: testAccountId };
    const result = await getTransactions(query);

    expect(result).toHaveLength(1);
    expect(result[0].account_id).toEqual(testAccountId);
    expect(result[0].amount).toEqual(100.00);
  });

  it('should filter by date range', async () => {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Create transactions at different times
    await db.insert(transactionsTable).values([
      {
        type: 'INCOME',
        amount: '100.00',
        description: 'Yesterday transaction',
        account_id: testAccountId,
        created_by: 'test_user',
        created_at: yesterday
      },
      {
        type: 'INCOME',
        amount: '200.00',
        description: 'Today transaction',
        account_id: testAccountId,
        created_by: 'test_user',
        created_at: today
      }
    ]).execute();

    // Filter from today onwards
    const query: GetTransactionsQuery = {
      date_from: today.toISOString()
    };
    const result = await getTransactions(query);

    expect(result).toHaveLength(1);
    expect(result[0].description).toEqual('Today transaction');
    expect(result[0].created_at >= today).toBe(true);
  });

  it('should filter by complete date range', async () => {
    const startDate = new Date('2024-01-01');
    const endDate = new Date('2024-01-31');
    const outsideDate = new Date('2024-02-15');

    await db.insert(transactionsTable).values([
      {
        type: 'INCOME',
        amount: '100.00',
        description: 'Inside range',
        account_id: testAccountId,
        created_by: 'test_user',
        created_at: new Date('2024-01-15')
      },
      {
        type: 'INCOME',
        amount: '200.00',
        description: 'Outside range',
        account_id: testAccountId,
        created_by: 'test_user',
        created_at: outsideDate
      }
    ]).execute();

    const query: GetTransactionsQuery = {
      date_from: startDate.toISOString(),
      date_to: endDate.toISOString()
    };
    const result = await getTransactions(query);

    expect(result).toHaveLength(1);
    expect(result[0].description).toEqual('Inside range');
  });

  it('should apply pagination correctly', async () => {
    // Create multiple transactions
    const transactions = Array.from({ length: 10 }, (_, i) => ({
      type: 'INCOME' as const,
      amount: `${i + 1}.00`,
      description: `Transaction ${i + 1}`,
      account_id: testAccountId,
      created_by: 'test_user'
    }));

    await db.insert(transactionsTable).values(transactions).execute();

    // Test first page
    const firstPageQuery: GetTransactionsQuery = { limit: 3, offset: 0 };
    const firstPage = await getTransactions(firstPageQuery);

    expect(firstPage).toHaveLength(3);
    // Should be ordered by created_at desc, so newest first
    expect(firstPage[0].description).toEqual('Transaction 10');

    // Test second page
    const secondPageQuery: GetTransactionsQuery = { limit: 3, offset: 3 };
    const secondPage = await getTransactions(secondPageQuery);

    expect(secondPage).toHaveLength(3);
    expect(secondPage[0].description).toEqual('Transaction 7');
  });

  it('should combine multiple filters correctly', async () => {
    const testDate = new Date('2024-01-15');

    await db.insert(transactionsTable).values([
      {
        type: 'INCOME',
        amount: '100.00',
        description: 'Matching all filters',
        account_id: testAccountId,
        created_by: 'test_user',
        created_at: testDate
      },
      {
        type: 'EXPENSE',
        amount: '50.00',
        description: 'Wrong type',
        account_id: testAccountId,
        created_by: 'test_user',
        created_at: testDate
      },
      {
        type: 'INCOME',
        amount: '75.00',
        description: 'Wrong date',
        account_id: testAccountId,
        created_by: 'test_user',
        created_at: new Date('2024-02-15')
      }
    ]).execute();

    const query: GetTransactionsQuery = {
      type: 'INCOME',
      account_id: testAccountId,
      date_from: new Date('2024-01-01').toISOString(),
      date_to: new Date('2024-01-31').toISOString()
    };

    const result = await getTransactions(query);

    expect(result).toHaveLength(1);
    expect(result[0].description).toEqual('Matching all filters');
    expect(result[0].type).toEqual('INCOME');
    expect(result[0].account_id).toEqual(testAccountId);
  });

  it('should return empty array when no transactions match filters', async () => {
    await db.insert(transactionsTable).values({
      type: 'INCOME',
      amount: '100.00',
      description: 'Test transaction',
      account_id: testAccountId,
      created_by: 'test_user'
    }).execute();

    const query: GetTransactionsQuery = { type: 'TRANSFER' };
    const result = await getTransactions(query);

    expect(result).toHaveLength(0);
  });

  it('should apply default pagination when not specified', async () => {
    // Create more than default limit (50) transactions
    const transactions = Array.from({ length: 60 }, (_, i) => ({
      type: 'INCOME' as const,
      amount: `${i + 1}.00`,
      description: `Transaction ${i + 1}`,
      account_id: testAccountId,
      created_by: 'test_user'
    }));

    await db.insert(transactionsTable).values(transactions).execute();

    const result = await getTransactions();

    expect(result).toHaveLength(50); // Default limit should be applied
  });

  it('should handle transactions with all optional fields', async () => {
    await db.insert(transactionsTable).values({
      type: 'TRANSFER',
      amount: '150.75',
      description: 'Complete transaction',
      reference_number: 'REF123',
      account_id: testAccountId,
      fund_position_id: testFundPositionId,
      created_by: 'test_user'
    }).execute();

    const result = await getTransactions();

    expect(result).toHaveLength(1);
    expect(result[0].amount).toEqual(150.75);
    expect(result[0].reference_number).toEqual('REF123');
    expect(result[0].fund_position_id).toEqual(testFundPositionId);
    expect(typeof result[0].amount).toBe('number');
  });
});