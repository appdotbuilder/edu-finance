import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { 
  studentsTable, 
  paymentConfigsTable, 
  studentPaymentsTable, 
  accountsTable,
  transactionsTable 
} from '../db/schema';
import { type ProcessPaymentInput } from '../schema';
import { processPayment } from '../handlers/process_payment';
import { eq } from 'drizzle-orm';

describe('processPayment', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  // Test data setup helper
  const setupTestData = async () => {
    // Create student
    const studentResult = await db.insert(studentsTable)
      .values({
        nis: '12345',
        name: 'Test Student',
        grade: 'SMA',
        class_name: 'XII-A',
        status: 'ACTIVE'
      })
      .returning()
      .execute();
    const studentId = studentResult[0].id;

    // Create payment config
    const paymentConfigResult = await db.insert(paymentConfigsTable)
      .values({
        payment_type: 'SPP',
        name: 'SPP Bulanan',
        amount: '500000',
        grade: 'SMA',
        class_name: 'XII-A',
        is_active: true,
        can_installment: true
      })
      .returning()
      .execute();
    const paymentConfigId = paymentConfigResult[0].id;

    // Create student payment
    const studentPaymentResult = await db.insert(studentPaymentsTable)
      .values({
        student_id: studentId,
        payment_config_id: paymentConfigId,
        amount_due: '500000',
        amount_paid: '0',
        amount_remaining: '500000',
        status: 'PENDING'
      })
      .returning()
      .execute();
    const studentPaymentId = studentPaymentResult[0].id;

    // Create account
    const accountResult = await db.insert(accountsTable)
      .values({
        name: 'Test Cash Account',
        type: 'CASH',
        balance: '1000000',
        is_active: true
      })
      .returning()
      .execute();
    const accountId = accountResult[0].id;

    return {
      studentId,
      paymentConfigId,
      studentPaymentId,
      accountId
    };
  };

  it('should process full payment successfully', async () => {
    const { studentPaymentId, accountId } = await setupTestData();

    const testInput: ProcessPaymentInput = {
      student_payment_id: studentPaymentId,
      amount: 500000,
      account_id: accountId,
      created_by: 'test_user',
      reference_number: 'REF001'
    };

    const result = await processPayment(testInput);

    // Verify transaction record
    expect(result.type).toEqual('INCOME');
    expect(result.amount).toEqual(500000);
    expect(result.description).toEqual(`Payment for student payment ID: ${studentPaymentId}`);
    expect(result.reference_number).toEqual('REF001');
    expect(result.account_id).toEqual(accountId);
    expect(result.student_payment_id).toEqual(studentPaymentId);
    expect(result.created_by).toEqual('test_user');
    expect(result.id).toBeDefined();
    expect(result.created_at).toBeInstanceOf(Date);

    // Verify student payment was updated
    const updatedStudentPayments = await db.select()
      .from(studentPaymentsTable)
      .where(eq(studentPaymentsTable.id, studentPaymentId))
      .execute();

    const updatedPayment = updatedStudentPayments[0];
    expect(parseFloat(updatedPayment.amount_paid)).toEqual(500000);
    expect(parseFloat(updatedPayment.amount_remaining)).toEqual(0);
    expect(updatedPayment.status).toEqual('PAID');

    // Verify account balance was updated
    const updatedAccounts = await db.select()
      .from(accountsTable)
      .where(eq(accountsTable.id, accountId))
      .execute();

    const updatedAccount = updatedAccounts[0];
    expect(parseFloat(updatedAccount.balance)).toEqual(1500000); // 1000000 + 500000
  });

  it('should process partial payment successfully', async () => {
    const { studentPaymentId, accountId } = await setupTestData();

    const testInput: ProcessPaymentInput = {
      student_payment_id: studentPaymentId,
      amount: 200000,
      account_id: accountId,
      created_by: 'test_user'
    };

    const result = await processPayment(testInput);

    // Verify transaction record
    expect(result.amount).toEqual(200000);
    expect(result.reference_number).toBeNull();

    // Verify student payment was updated to partial
    const updatedStudentPayments = await db.select()
      .from(studentPaymentsTable)
      .where(eq(studentPaymentsTable.id, studentPaymentId))
      .execute();

    const updatedPayment = updatedStudentPayments[0];
    expect(parseFloat(updatedPayment.amount_paid)).toEqual(200000);
    expect(parseFloat(updatedPayment.amount_remaining)).toEqual(300000);
    expect(updatedPayment.status).toEqual('PARTIAL');

    // Verify account balance was updated
    const updatedAccounts = await db.select()
      .from(accountsTable)
      .where(eq(accountsTable.id, accountId))
      .execute();

    const updatedAccount = updatedAccounts[0];
    expect(parseFloat(updatedAccount.balance)).toEqual(1200000); // 1000000 + 200000
  });

  it('should handle multiple partial payments correctly', async () => {
    const { studentPaymentId, accountId } = await setupTestData();

    // First payment
    await processPayment({
      student_payment_id: studentPaymentId,
      amount: 150000,
      account_id: accountId,
      created_by: 'test_user'
    });

    // Second payment
    const result = await processPayment({
      student_payment_id: studentPaymentId,
      amount: 100000,
      account_id: accountId,
      created_by: 'test_user'
    });

    expect(result.amount).toEqual(100000);

    // Verify cumulative payment amounts
    const updatedStudentPayments = await db.select()
      .from(studentPaymentsTable)
      .where(eq(studentPaymentsTable.id, studentPaymentId))
      .execute();

    const updatedPayment = updatedStudentPayments[0];
    expect(parseFloat(updatedPayment.amount_paid)).toEqual(250000); // 150000 + 100000
    expect(parseFloat(updatedPayment.amount_remaining)).toEqual(250000); // 500000 - 250000
    expect(updatedPayment.status).toEqual('PARTIAL');

    // Verify account balance reflects both payments
    const updatedAccounts = await db.select()
      .from(accountsTable)
      .where(eq(accountsTable.id, accountId))
      .execute();

    const updatedAccount = updatedAccounts[0];
    expect(parseFloat(updatedAccount.balance)).toEqual(1250000); // 1000000 + 150000 + 100000
  });

  it('should save transaction to database', async () => {
    const { studentPaymentId, accountId } = await setupTestData();

    const testInput: ProcessPaymentInput = {
      student_payment_id: studentPaymentId,
      amount: 300000,
      account_id: accountId,
      created_by: 'test_user',
      reference_number: 'REF123'
    };

    const result = await processPayment(testInput);

    // Query transaction from database
    const transactions = await db.select()
      .from(transactionsTable)
      .where(eq(transactionsTable.id, result.id))
      .execute();

    expect(transactions).toHaveLength(1);
    const savedTransaction = transactions[0];
    expect(savedTransaction.type).toEqual('INCOME');
    expect(parseFloat(savedTransaction.amount)).toEqual(300000);
    expect(savedTransaction.description).toEqual(`Payment for student payment ID: ${studentPaymentId}`);
    expect(savedTransaction.reference_number).toEqual('REF123');
    expect(savedTransaction.account_id).toEqual(accountId);
    expect(savedTransaction.student_payment_id).toEqual(studentPaymentId);
    expect(savedTransaction.created_by).toEqual('test_user');
    expect(savedTransaction.created_at).toBeInstanceOf(Date);
  });

  it('should throw error when student payment not found', async () => {
    const { accountId } = await setupTestData();

    const testInput: ProcessPaymentInput = {
      student_payment_id: 99999, // Non-existent ID
      amount: 100000,
      account_id: accountId,
      created_by: 'test_user'
    };

    expect(processPayment(testInput)).rejects.toThrow(/Student payment with ID 99999 not found/i);
  });

  it('should throw error when account not found', async () => {
    const { studentPaymentId } = await setupTestData();

    const testInput: ProcessPaymentInput = {
      student_payment_id: studentPaymentId,
      amount: 100000,
      account_id: 99999, // Non-existent ID
      created_by: 'test_user'
    };

    expect(processPayment(testInput)).rejects.toThrow(/Account with ID 99999 not found/i);
  });

  it('should throw error when payment amount exceeds remaining amount', async () => {
    const { studentPaymentId, accountId } = await setupTestData();

    const testInput: ProcessPaymentInput = {
      student_payment_id: studentPaymentId,
      amount: 600000, // More than the 500000 remaining
      account_id: accountId,
      created_by: 'test_user'
    };

    expect(processPayment(testInput)).rejects.toThrow(/Payment amount 600000 exceeds remaining amount 500000/i);
  });

  it('should handle payments with existing partial amount', async () => {
    const { studentPaymentId, accountId } = await setupTestData();

    // Update student payment to have some amount already paid
    await db.update(studentPaymentsTable)
      .set({
        amount_paid: '100000',
        amount_remaining: '400000',
        status: 'PARTIAL'
      })
      .where(eq(studentPaymentsTable.id, studentPaymentId))
      .execute();

    const testInput: ProcessPaymentInput = {
      student_payment_id: studentPaymentId,
      amount: 400000, // Complete the remaining payment
      account_id: accountId,
      created_by: 'test_user'
    };

    const result = await processPayment(testInput);

    expect(result.amount).toEqual(400000);

    // Verify final payment status
    const updatedStudentPayments = await db.select()
      .from(studentPaymentsTable)
      .where(eq(studentPaymentsTable.id, studentPaymentId))
      .execute();

    const updatedPayment = updatedStudentPayments[0];
    expect(parseFloat(updatedPayment.amount_paid)).toEqual(500000); // 100000 + 400000
    expect(parseFloat(updatedPayment.amount_remaining)).toEqual(0);
    expect(updatedPayment.status).toEqual('PAID');
  });

  it('should verify numeric field conversions', async () => {
    const { studentPaymentId, accountId } = await setupTestData();

    const testInput: ProcessPaymentInput = {
      student_payment_id: studentPaymentId,
      amount: 250000,
      account_id: accountId,
      created_by: 'test_user'
    };

    const result = await processPayment(testInput);

    // Verify returned amount is a number, not string
    expect(typeof result.amount).toBe('number');
    expect(result.amount).toEqual(250000);
  });
});