import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { 
  transactionsTable, 
  accountsTable, 
  fundPositionsTable, 
  studentsTable,
  paymentConfigsTable,
  studentPaymentsTable 
} from '../db/schema';
import { type CreateTransactionInput } from '../schema';
import { createTransaction } from '../handlers/create_transaction';
import { eq } from 'drizzle-orm';

describe('createTransaction', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should create an income transaction', async () => {
    // Create prerequisite account
    const accountResult = await db.insert(accountsTable)
      .values({
        name: 'Test Cash Account',
        type: 'CASH',
        balance: '1000.00'
      })
      .returning()
      .execute();
    
    const account = accountResult[0];

    const testInput: CreateTransactionInput = {
      type: 'INCOME',
      amount: 500.00,
      description: 'Test income transaction',
      account_id: account.id,
      created_by: 'test_user'
    };

    const result = await createTransaction(testInput);

    // Basic field validation
    expect(result.type).toEqual('INCOME');
    expect(result.amount).toEqual(500.00);
    expect(typeof result.amount).toBe('number');
    expect(result.description).toEqual('Test income transaction');
    expect(result.account_id).toEqual(account.id);
    expect(result.created_by).toEqual('test_user');
    expect(result.id).toBeDefined();
    expect(result.created_at).toBeInstanceOf(Date);
    expect(result.reference_number).toBeNull();
    expect(result.fund_position_id).toBeNull();
    expect(result.student_payment_id).toBeNull();
  });

  it('should create an expense transaction', async () => {
    // Create prerequisite account
    const accountResult = await db.insert(accountsTable)
      .values({
        name: 'Test Bank Account',
        type: 'BANK',
        bank_name: 'Test Bank',
        account_number: '123456789',
        balance: '2000.00'
      })
      .returning()
      .execute();
    
    const account = accountResult[0];

    const testInput: CreateTransactionInput = {
      type: 'EXPENSE',
      amount: 300.50,
      description: 'Test expense transaction',
      reference_number: 'EXP-001',
      account_id: account.id,
      created_by: 'admin_user'
    };

    const result = await createTransaction(testInput);

    // Basic field validation
    expect(result.type).toEqual('EXPENSE');
    expect(result.amount).toEqual(300.50);
    expect(typeof result.amount).toBe('number');
    expect(result.description).toEqual('Test expense transaction');
    expect(result.reference_number).toEqual('EXP-001');
    expect(result.account_id).toEqual(account.id);
    expect(result.created_by).toEqual('admin_user');
    expect(result.id).toBeDefined();
    expect(result.created_at).toBeInstanceOf(Date);
  });

  it('should create a transfer transaction with fund position', async () => {
    // Create prerequisite account and fund position
    const accountResult = await db.insert(accountsTable)
      .values({
        name: 'Transfer Account',
        type: 'BANK',
        balance: '5000.00'
      })
      .returning()
      .execute();

    const fundPositionResult = await db.insert(fundPositionsTable)
      .values({
        name: 'Education Fund',
        description: 'Fund for educational expenses',
        balance: '10000.00'
      })
      .returning()
      .execute();
    
    const account = accountResult[0];
    const fundPosition = fundPositionResult[0];

    const testInput: CreateTransactionInput = {
      type: 'TRANSFER',
      amount: 1500.75,
      description: 'Transfer to education fund',
      account_id: account.id,
      fund_position_id: fundPosition.id,
      created_by: 'finance_admin'
    };

    const result = await createTransaction(testInput);

    // Validate transaction fields
    expect(result.type).toEqual('TRANSFER');
    expect(result.amount).toEqual(1500.75);
    expect(result.fund_position_id).toEqual(fundPosition.id);
    expect(result.description).toEqual('Transfer to education fund');
    expect(result.created_by).toEqual('finance_admin');
  });

  it('should create transaction with student payment reference', async () => {
    // Create prerequisite data: student, account, payment config, and student payment
    const studentResult = await db.insert(studentsTable)
      .values({
        nis: 'STU001',
        name: 'Test Student',
        grade: 'SMA',
        class_name: '10A'
      })
      .returning()
      .execute();

    const accountResult = await db.insert(accountsTable)
      .values({
        name: 'Payment Account',
        type: 'CASH',
        balance: '0.00'
      })
      .returning()
      .execute();

    const paymentConfigResult = await db.insert(paymentConfigsTable)
      .values({
        payment_type: 'SPP',
        name: 'Monthly SPP',
        amount: '500000.00',
        grade: 'SMA'
      })
      .returning()
      .execute();

    const studentPaymentResult = await db.insert(studentPaymentsTable)
      .values({
        student_id: studentResult[0].id,
        payment_config_id: paymentConfigResult[0].id,
        amount_due: '500000.00',
        amount_remaining: '500000.00'
      })
      .returning()
      .execute();

    const testInput: CreateTransactionInput = {
      type: 'INCOME',
      amount: 500000.00,
      description: 'SPP payment from student',
      account_id: accountResult[0].id,
      student_payment_id: studentPaymentResult[0].id,
      created_by: 'cashier'
    };

    const result = await createTransaction(testInput);

    // Validate transaction with student payment reference
    expect(result.student_payment_id).toEqual(studentPaymentResult[0].id);
    expect(result.amount).toEqual(500000.00);
    expect(result.type).toEqual('INCOME');
  });

  it('should save transaction to database', async () => {
    // Create prerequisite account
    const accountResult = await db.insert(accountsTable)
      .values({
        name: 'Database Test Account',
        type: 'CASH',
        balance: '1000.00'
      })
      .returning()
      .execute();

    const testInput: CreateTransactionInput = {
      type: 'INCOME',
      amount: 250.00,
      description: 'Database test transaction',
      account_id: accountResult[0].id,
      created_by: 'test_user'
    };

    const result = await createTransaction(testInput);

    // Query database to verify transaction was saved
    const transactions = await db.select()
      .from(transactionsTable)
      .where(eq(transactionsTable.id, result.id))
      .execute();

    expect(transactions).toHaveLength(1);
    expect(transactions[0].type).toEqual('INCOME');
    expect(parseFloat(transactions[0].amount)).toEqual(250.00);
    expect(transactions[0].description).toEqual('Database test transaction');
    expect(transactions[0].created_at).toBeInstanceOf(Date);
  });

  it('should update account balance for income transaction', async () => {
    // Create account with initial balance
    const accountResult = await db.insert(accountsTable)
      .values({
        name: 'Balance Test Account',
        type: 'CASH',
        balance: '1000.00'
      })
      .returning()
      .execute();

    const testInput: CreateTransactionInput = {
      type: 'INCOME',
      amount: 500.00,
      description: 'Income to increase balance',
      account_id: accountResult[0].id,
      created_by: 'test_user'
    };

    await createTransaction(testInput);

    // Check updated account balance
    const updatedAccount = await db.select()
      .from(accountsTable)
      .where(eq(accountsTable.id, accountResult[0].id))
      .execute();

    expect(parseFloat(updatedAccount[0].balance)).toEqual(1500.00); // 1000 + 500
  });

  it('should update account balance for expense transaction', async () => {
    // Create account with initial balance
    const accountResult = await db.insert(accountsTable)
      .values({
        name: 'Expense Test Account',
        type: 'BANK',
        balance: '2000.00'
      })
      .returning()
      .execute();

    const testInput: CreateTransactionInput = {
      type: 'EXPENSE',
      amount: 750.00,
      description: 'Expense to decrease balance',
      account_id: accountResult[0].id,
      created_by: 'admin'
    };

    await createTransaction(testInput);

    // Check updated account balance
    const updatedAccount = await db.select()
      .from(accountsTable)
      .where(eq(accountsTable.id, accountResult[0].id))
      .execute();

    expect(parseFloat(updatedAccount[0].balance)).toEqual(1250.00); // 2000 - 750
  });

  it('should update fund position balance when specified', async () => {
    // Create account and fund position
    const accountResult = await db.insert(accountsTable)
      .values({
        name: 'Fund Test Account',
        type: 'CASH',
        balance: '3000.00'
      })
      .returning()
      .execute();

    const fundPositionResult = await db.insert(fundPositionsTable)
      .values({
        name: 'Test Fund Position',
        balance: '5000.00'
      })
      .returning()
      .execute();

    const testInput: CreateTransactionInput = {
      type: 'INCOME',
      amount: 800.00,
      description: 'Income affecting fund position',
      account_id: accountResult[0].id,
      fund_position_id: fundPositionResult[0].id,
      created_by: 'fund_manager'
    };

    await createTransaction(testInput);

    // Check updated fund position balance
    const updatedFundPosition = await db.select()
      .from(fundPositionsTable)
      .where(eq(fundPositionsTable.id, fundPositionResult[0].id))
      .execute();

    expect(parseFloat(updatedFundPosition[0].balance)).toEqual(5800.00); // 5000 + 800
  });

  it('should decrease fund position balance for expense', async () => {
    // Create account and fund position
    const accountResult = await db.insert(accountsTable)
      .values({
        name: 'Fund Expense Account',
        type: 'BANK',
        balance: '4000.00'
      })
      .returning()
      .execute();

    const fundPositionResult = await db.insert(fundPositionsTable)
      .values({
        name: 'Expense Fund Position',
        balance: '8000.00'
      })
      .returning()
      .execute();

    const testInput: CreateTransactionInput = {
      type: 'EXPENSE',
      amount: 1200.00,
      description: 'Expense from fund position',
      account_id: accountResult[0].id,
      fund_position_id: fundPositionResult[0].id,
      created_by: 'budget_admin'
    };

    await createTransaction(testInput);

    // Check updated fund position balance
    const updatedFundPosition = await db.select()
      .from(fundPositionsTable)
      .where(eq(fundPositionsTable.id, fundPositionResult[0].id))
      .execute();

    expect(parseFloat(updatedFundPosition[0].balance)).toEqual(6800.00); // 8000 - 1200
  });

  it('should throw error for non-existent account', async () => {
    const testInput: CreateTransactionInput = {
      type: 'INCOME',
      amount: 100.00,
      description: 'Transaction with invalid account',
      account_id: 999999, // Non-existent account ID
      created_by: 'test_user'
    };

    expect(createTransaction(testInput)).rejects.toThrow(/Account with ID 999999 not found/i);
  });

  it('should throw error for non-existent fund position', async () => {
    // Create valid account
    const accountResult = await db.insert(accountsTable)
      .values({
        name: 'Valid Account',
        type: 'CASH',
        balance: '1000.00'
      })
      .returning()
      .execute();

    const testInput: CreateTransactionInput = {
      type: 'TRANSFER',
      amount: 100.00,
      description: 'Transaction with invalid fund position',
      account_id: accountResult[0].id,
      fund_position_id: 888888, // Non-existent fund position ID
      created_by: 'test_user'
    };

    expect(createTransaction(testInput)).rejects.toThrow(/Fund position with ID 888888 not found/i);
  });

  it('should throw error for non-existent student payment', async () => {
    // Create valid account
    const accountResult = await db.insert(accountsTable)
      .values({
        name: 'Payment Account',
        type: 'CASH',
        balance: '1000.00'
      })
      .returning()
      .execute();

    const testInput: CreateTransactionInput = {
      type: 'INCOME',
      amount: 100.00,
      description: 'Transaction with invalid student payment',
      account_id: accountResult[0].id,
      student_payment_id: 777777, // Non-existent student payment ID
      created_by: 'cashier'
    };

    expect(createTransaction(testInput)).rejects.toThrow(/Student payment with ID 777777 not found/i);
  });
});