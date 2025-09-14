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
import { 
  generateReceipt, 
  printReceipt, 
  generateAndPrintReceipt,
  type ReceiptData 
} from '../handlers/print_receipt';
import type { 
  CreateStudentInput, 
  CreatePaymentConfigInput, 
  CreateAccountInput,
  CreateTransactionInput 
} from '../schema';

describe('print_receipt', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  let studentId: number;
  let paymentConfigId: number;
  let studentPaymentId: number;
  let accountId: number;
  let transactionId: number;

  beforeEach(async () => {
    // Create test student
    const studentInput: CreateStudentInput = {
      nis: 'TEST001',
      name: 'Test Student',
      grade: 'SMA',
      class_name: 'XII-A',
      phone: '081234567890',
      parent_phone: '081234567891',
      address: 'Test Address'
    };

    const studentResult = await db.insert(studentsTable)
      .values({
        ...studentInput,
        status: 'ACTIVE'
      })
      .returning()
      .execute();

    studentId = studentResult[0].id;

    // Create test payment config
    const paymentConfigInput: CreatePaymentConfigInput = {
      payment_type: 'SPP',
      name: 'SPP Bulan Januari 2024',
      description: 'Pembayaran SPP untuk bulan Januari 2024',
      amount: 500000,
      grade: 'SMA',
      class_name: 'XII-A',
      can_installment: false
    };

    const paymentConfigResult = await db.insert(paymentConfigsTable)
      .values({
        ...paymentConfigInput,
        amount: paymentConfigInput.amount.toString(),
        is_active: true
      })
      .returning()
      .execute();

    paymentConfigId = paymentConfigResult[0].id;

    // Create test account
    const accountInput: CreateAccountInput = {
      name: 'Kas Utama',
      type: 'CASH',
      balance: 1000000
    };

    const accountResult = await db.insert(accountsTable)
      .values({
        ...accountInput,
        balance: accountInput.balance?.toString() || '0',
        is_active: true
      })
      .returning()
      .execute();

    accountId = accountResult[0].id;

    // Create test student payment
    const studentPaymentResult = await db.insert(studentPaymentsTable)
      .values({
        student_id: studentId,
        payment_config_id: paymentConfigId,
        amount_due: '500000',
        amount_paid: '500000',
        amount_remaining: '0',
        status: 'PAID'
      })
      .returning()
      .execute();

    studentPaymentId = studentPaymentResult[0].id;

    // Create test transaction
    const transactionInput: CreateTransactionInput = {
      type: 'INCOME',
      amount: 500000,
      description: 'Pembayaran SPP Test Student',
      account_id: accountId,
      student_payment_id: studentPaymentId,
      created_by: 'test_user',
      reference_number: 'REF001'
    };

    const transactionResult = await db.insert(transactionsTable)
      .values({
        ...transactionInput,
        amount: transactionInput.amount.toString()
      })
      .returning()
      .execute();

    transactionId = transactionResult[0].id;
  });

  describe('generateReceipt', () => {
    it('should generate receipt for student payment transaction', async () => {
      const receipt = await generateReceipt(transactionId);

      // Verify receipt structure
      expect(receipt.id).toBe(transactionId);
      expect(receipt.receipt_number).toMatch(/^RCP\d{6}-\d{6}$/);
      expect(receipt.student_name).toBe('Test Student');
      expect(receipt.nis).toBe('TEST001');
      expect(receipt.payment_items).toHaveLength(1);
      expect(receipt.payment_items[0].description).toBe('SPP Bulan Januari 2024');
      expect(receipt.payment_items[0].amount).toBe(500000);
      expect(receipt.total_amount).toBe(500000);
      expect(receipt.payment_method).toBe('CASH');
      expect(receipt.received_by).toBe('test_user');
      expect(receipt.transaction_date).toBeInstanceOf(Date);
      expect(receipt.notes).toBe('Ref: REF001');
    });

    it('should generate receipt for non-student payment transaction', async () => {
      // Create a transaction without student payment
      const nonStudentTransactionResult = await db.insert(transactionsTable)
        .values({
          type: 'EXPENSE',
          amount: '250000',
          description: 'Office Supplies',
          account_id: accountId,
          created_by: 'admin_user'
        })
        .returning()
        .execute();

      const nonStudentTransactionId = nonStudentTransactionResult[0].id;
      const receipt = await generateReceipt(nonStudentTransactionId);

      expect(receipt.id).toBe(nonStudentTransactionId);
      expect(receipt.student_name).toBe('N/A');
      expect(receipt.nis).toBe('N/A');
      expect(receipt.payment_items[0].description).toBe('Office Supplies');
      expect(receipt.payment_items[0].amount).toBe(250000);
      expect(receipt.total_amount).toBe(250000);
      expect(receipt.payment_method).toBe('CASH');
      expect(receipt.received_by).toBe('admin_user');
    });

    it('should handle bank account transactions', async () => {
      // Create bank account
      const bankAccountResult = await db.insert(accountsTable)
        .values({
          name: 'Bank BCA',
          type: 'BANK',
          bank_name: 'Bank Central Asia',
          account_number: '1234567890',
          balance: '2000000',
          is_active: true
        })
        .returning()
        .execute();

      // Create transaction with bank account
      const bankTransactionResult = await db.insert(transactionsTable)
        .values({
          type: 'INCOME',
          amount: '300000',
          description: 'Bank Transfer Payment',
          account_id: bankAccountResult[0].id,
          created_by: 'cashier'
        })
        .returning()
        .execute();

      const receipt = await generateReceipt(bankTransactionResult[0].id);

      expect(receipt.payment_method).toBe('BANK TRANSFER (Bank BCA)');
    });

    it('should throw error for non-existent transaction', async () => {
      await expect(generateReceipt(99999)).rejects.toThrow(/Transaction with ID 99999 not found/);
    });
  });

  describe('printReceipt', () => {
    let testReceiptData: ReceiptData;

    beforeEach(async () => {
      testReceiptData = await generateReceipt(transactionId);
    });

    it('should successfully print receipt with default copies', async () => {
      const result = await printReceipt(testReceiptData);

      expect(result.success).toBe(true);
      expect(result.printed_copies).toBe(1);
      expect(result.receipt_number).toBe(testReceiptData.receipt_number);
    });

    it('should successfully print receipt with multiple copies', async () => {
      const result = await printReceipt(testReceiptData, 3);

      expect(result.success).toBe(true);
      expect(result.printed_copies).toBe(3);
      expect(result.receipt_number).toBe(testReceiptData.receipt_number);
    });

    it('should validate copies parameter limits', async () => {
      // Test minimum limit
      const result1 = await printReceipt(testReceiptData, 0);
      expect(result1.success).toBe(false);
      expect(result1.printed_copies).toBe(0);
      
      // Test maximum limit
      const result2 = await printReceipt(testReceiptData, 11);
      expect(result2.success).toBe(false);
      expect(result2.printed_copies).toBe(0);
    });

    it('should handle printing errors gracefully', async () => {
      // Mock Math.random to always trigger failure
      const originalRandom = Math.random;
      Math.random = () => 0.01; // Always trigger failure condition

      const result = await printReceipt(testReceiptData, 2);

      expect(result.success).toBe(false);
      expect(result.printed_copies).toBe(0);
      expect(result.receipt_number).toBe(testReceiptData.receipt_number);

      // Restore original Math.random
      Math.random = originalRandom;
    });
  });

  describe('generateAndPrintReceipt', () => {
    it('should generate and print receipt successfully', async () => {
      const result = await generateAndPrintReceipt(transactionId, 2);

      expect(result.success).toBe(true);
      expect(result.printed_copies).toBe(2);
      expect(result.receipt_number).toMatch(/^RCP\d{6}-\d{6}$/);
    });

    it('should handle transaction not found error', async () => {
      await expect(generateAndPrintReceipt(99999)).rejects.toThrow(/Transaction with ID 99999 not found/);
    });

    it('should handle printing errors in combined operation', async () => {
      // Mock Math.random to always trigger printing failure
      const originalRandom = Math.random;
      Math.random = () => 0.01;

      const result = await generateAndPrintReceipt(transactionId, 1);

      expect(result.success).toBe(false);
      expect(result.printed_copies).toBe(0);

      // Restore original Math.random
      Math.random = originalRandom;
    });
  });

  describe('receipt data validation', () => {
    it('should generate proper receipt numbers with padding', async () => {
      // Test with small transaction ID
      const receipt1 = await generateReceipt(transactionId);
      expect(receipt1.receipt_number).toMatch(/^RCP0+\d+-\d{6}$/);
      
      // Verify the ID is properly padded to 6 digits
      const paddedId = String(transactionId).padStart(6, '0');
      expect(receipt1.receipt_number.startsWith(`RCP${paddedId}-`)).toBe(true);
    });

    it('should format amounts correctly', async () => {
      const receipt = await generateReceipt(transactionId);
      
      expect(typeof receipt.total_amount).toBe('number');
      expect(receipt.total_amount).toBe(500000);
      expect(receipt.payment_items[0].amount).toBe(500000);
    });

    it('should handle missing reference numbers', async () => {
      // Create transaction without reference number
      const noRefTransactionResult = await db.insert(transactionsTable)
        .values({
          type: 'INCOME',
          amount: '100000',
          description: 'Cash Payment',
          account_id: accountId,
          created_by: 'cashier'
        })
        .returning()
        .execute();

      const receipt = await generateReceipt(noRefTransactionResult[0].id);
      
      expect(receipt.notes).toBeUndefined();
    });
  });
});