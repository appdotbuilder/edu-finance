import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { studentsTable, savingsTable, savingsTransactionsTable } from '../db/schema';
import { type CreateSavingsTransactionInput } from '../schema';
import { createSavingsTransaction } from '../handlers/create_savings_transaction';
import { eq } from 'drizzle-orm';

// Test data
const testStudent = {
  nis: 'TEST001',
  name: 'Test Student',
  grade: 'SD' as const,
  class_name: '1A',
  phone: '081234567890',
  parent_phone: '081234567891',
  address: 'Test Address',
  status: 'ACTIVE' as const
};

const testDepositInput: CreateSavingsTransactionInput = {
  student_id: 0, // Will be set after creating student
  type: 'DEPOSIT',
  amount: 50000,
  description: 'Initial deposit',
  created_by: 'test_user'
};

const testWithdrawalInput: CreateSavingsTransactionInput = {
  student_id: 0, // Will be set after creating student
  type: 'WITHDRAWAL',
  amount: 20000,
  description: 'Book purchase',
  created_by: 'test_user'
};

describe('createSavingsTransaction', () => {
  let studentId: number;

  beforeEach(async () => {
    await createDB();
    
    // Create a test student
    const studentResult = await db.insert(studentsTable)
      .values(testStudent)
      .returning()
      .execute();
    
    studentId = studentResult[0].id;
    testDepositInput.student_id = studentId;
    testWithdrawalInput.student_id = studentId;
  });

  afterEach(resetDB);

  it('should create a deposit transaction and new savings account', async () => {
    const result = await createSavingsTransaction(testDepositInput);

    // Verify transaction properties
    expect(result.type).toEqual('DEPOSIT');
    expect(result.amount).toEqual(50000);
    expect(typeof result.amount).toEqual('number');
    expect(result.description).toEqual('Initial deposit');
    expect(result.created_by).toEqual('test_user');
    expect(result.id).toBeDefined();
    expect(result.savings_id).toBeDefined();
    expect(result.created_at).toBeInstanceOf(Date);
  });

  it('should create savings account if it does not exist', async () => {
    await createSavingsTransaction(testDepositInput);

    // Check if savings account was created
    const savingsAccounts = await db.select()
      .from(savingsTable)
      .where(eq(savingsTable.student_id, studentId))
      .execute();

    expect(savingsAccounts).toHaveLength(1);
    expect(savingsAccounts[0].student_id).toEqual(studentId);
    expect(parseFloat(savingsAccounts[0].balance)).toEqual(50000);
  });

  it('should save transaction to database correctly', async () => {
    const result = await createSavingsTransaction(testDepositInput);

    // Query the transaction from database
    const transactions = await db.select()
      .from(savingsTransactionsTable)
      .where(eq(savingsTransactionsTable.id, result.id))
      .execute();

    expect(transactions).toHaveLength(1);
    expect(transactions[0].type).toEqual('DEPOSIT');
    expect(parseFloat(transactions[0].amount)).toEqual(50000);
    expect(transactions[0].description).toEqual('Initial deposit');
    expect(transactions[0].created_by).toEqual('test_user');
    expect(transactions[0].created_at).toBeInstanceOf(Date);
  });

  it('should update existing savings account balance on deposit', async () => {
    // Create initial deposit
    await createSavingsTransaction(testDepositInput);

    // Create second deposit
    const secondDeposit: CreateSavingsTransactionInput = {
      student_id: studentId,
      type: 'DEPOSIT',
      amount: 30000,
      description: 'Second deposit',
      created_by: 'test_user'
    };

    await createSavingsTransaction(secondDeposit);

    // Check final balance
    const savingsAccounts = await db.select()
      .from(savingsTable)
      .where(eq(savingsTable.student_id, studentId))
      .execute();

    expect(savingsAccounts).toHaveLength(1);
    expect(parseFloat(savingsAccounts[0].balance)).toEqual(80000); // 50000 + 30000
  });

  it('should process withdrawal from existing balance', async () => {
    // Create initial deposit
    await createSavingsTransaction(testDepositInput);

    // Process withdrawal
    const result = await createSavingsTransaction(testWithdrawalInput);

    // Verify withdrawal transaction
    expect(result.type).toEqual('WITHDRAWAL');
    expect(result.amount).toEqual(20000);
    expect(result.description).toEqual('Book purchase');

    // Check updated balance
    const savingsAccounts = await db.select()
      .from(savingsTable)
      .where(eq(savingsTable.student_id, studentId))
      .execute();

    expect(parseFloat(savingsAccounts[0].balance)).toEqual(30000); // 50000 - 20000
  });

  it('should handle transaction without description', async () => {
    const inputWithoutDescription: CreateSavingsTransactionInput = {
      student_id: studentId,
      type: 'DEPOSIT',
      amount: 25000,
      created_by: 'test_user'
    };

    const result = await createSavingsTransaction(inputWithoutDescription);

    expect(result.description).toBeNull();
    expect(result.amount).toEqual(25000);
    expect(result.type).toEqual('DEPOSIT');
  });

  it('should throw error for non-existent student', async () => {
    const invalidInput: CreateSavingsTransactionInput = {
      student_id: 99999,
      type: 'DEPOSIT',
      amount: 10000,
      created_by: 'test_user'
    };

    expect(createSavingsTransaction(invalidInput)).rejects.toThrow(/Student with ID 99999 not found/i);
  });

  it('should throw error for insufficient balance on withdrawal', async () => {
    // Create small initial deposit
    const smallDeposit: CreateSavingsTransactionInput = {
      student_id: studentId,
      type: 'DEPOSIT',
      amount: 10000,
      created_by: 'test_user'
    };

    await createSavingsTransaction(smallDeposit);

    // Attempt withdrawal larger than balance
    const largeWithdrawal: CreateSavingsTransactionInput = {
      student_id: studentId,
      type: 'WITHDRAWAL',
      amount: 15000,
      created_by: 'test_user'
    };

    expect(createSavingsTransaction(largeWithdrawal)).rejects.toThrow(/Insufficient balance for withdrawal/i);
  });

  it('should maintain balance consistency across multiple transactions', async () => {
    const transactions = [
      { type: 'DEPOSIT' as const, amount: 100000 },
      { type: 'WITHDRAWAL' as const, amount: 30000 },
      { type: 'DEPOSIT' as const, amount: 50000 },
      { type: 'WITHDRAWAL' as const, amount: 25000 }
    ];

    let expectedBalance = 0;

    for (const transaction of transactions) {
      const input: CreateSavingsTransactionInput = {
        student_id: studentId,
        type: transaction.type,
        amount: transaction.amount,
        created_by: 'test_user'
      };

      await createSavingsTransaction(input);

      if (transaction.type === 'DEPOSIT') {
        expectedBalance += transaction.amount;
      } else {
        expectedBalance -= transaction.amount;
      }
    }

    // Verify final balance
    const savingsAccounts = await db.select()
      .from(savingsTable)
      .where(eq(savingsTable.student_id, studentId))
      .execute();

    expect(parseFloat(savingsAccounts[0].balance)).toEqual(expectedBalance); // 100000 - 30000 + 50000 - 25000 = 95000

    // Verify all transactions were recorded
    const allTransactions = await db.select()
      .from(savingsTransactionsTable)
      .where(eq(savingsTransactionsTable.savings_id, savingsAccounts[0].id))
      .execute();

    expect(allTransactions).toHaveLength(4);
  });
});