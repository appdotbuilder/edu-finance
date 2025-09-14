import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { studentsTable, sppCardsTable, studentPaymentsTable, paymentConfigsTable } from '../db/schema';
import { scanBarcode } from '../handlers/scan_barcode';

// Test data
const testStudent = {
  nis: 'TEST001',
  name: 'Test Student',
  grade: 'SMA' as const,
  class_name: '12A',
  phone: '081234567890',
  parent_phone: '081234567891',
  address: 'Test Address',
  status: 'ACTIVE' as const
};

const testPaymentConfig = {
  payment_type: 'SPP' as const,
  name: 'SPP Bulan Januari',
  description: 'Pembayaran SPP bulan Januari',
  amount: '500000',
  grade: 'SMA' as const,
  class_name: '12A',
  is_active: true,
  can_installment: false
};

describe('scanBarcode', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should return student data with payment history when barcode is valid', async () => {
    // Create test student
    const studentResults = await db.insert(studentsTable)
      .values(testStudent)
      .returning()
      .execute();
    const student = studentResults[0];

    // Create test payment config
    const paymentConfigResults = await db.insert(paymentConfigsTable)
      .values(testPaymentConfig)
      .returning()
      .execute();
    const paymentConfig = paymentConfigResults[0];

    // Create test SPP card
    const sppCardResults = await db.insert(sppCardsTable)
      .values({
        student_id: student.id,
        barcode: 'BARCODE123456',
        is_active: true
      })
      .returning()
      .execute();

    // Create test student payment
    await db.insert(studentPaymentsTable)
      .values({
        student_id: student.id,
        payment_config_id: paymentConfig.id,
        amount_due: '500000',
        amount_paid: '200000',
        amount_remaining: '300000',
        status: 'PARTIAL' as const
      })
      .execute();

    const result = await scanBarcode('BARCODE123456');

    // Verify student data
    expect(result).toBeDefined();
    expect(result!.id).toBe(student.id);
    expect(result!.nis).toBe('TEST001');
    expect(result!.name).toBe('Test Student');
    expect(result!.grade).toBe('SMA');
    expect(result!.class_name).toBe('12A');
    expect(result!.phone).toBe('081234567890');
    expect(result!.parent_phone).toBe('081234567891');
    expect(result!.address).toBe('Test Address');
    expect(result!.status).toBe('ACTIVE');

    // Verify payment history
    expect(result!.paymentHistory).toHaveLength(1);
    const payment = result!.paymentHistory[0];
    expect(payment.payment_type).toBe('SPP');
    expect(payment.amount_due).toBe(500000);
    expect(payment.amount_paid).toBe(200000);
    expect(payment.amount_remaining).toBe(300000);
    expect(payment.status).toBe('PARTIAL');
    expect(typeof payment.amount_due).toBe('number');
    expect(typeof payment.amount_paid).toBe('number');
    expect(typeof payment.amount_remaining).toBe('number');
  });

  it('should return student with multiple payment history entries', async () => {
    // Create test student
    const studentResults = await db.insert(studentsTable)
      .values(testStudent)
      .returning()
      .execute();
    const student = studentResults[0];

    // Create multiple payment configs
    const sppConfig = await db.insert(paymentConfigsTable)
      .values({
        ...testPaymentConfig,
        name: 'SPP Januari',
        payment_type: 'SPP' as const
      })
      .returning()
      .execute();

    const buildingConfig = await db.insert(paymentConfigsTable)
      .values({
        ...testPaymentConfig,
        name: 'Uang Gedung',
        payment_type: 'UANG_GEDUNG' as const,
        amount: '1000000'
      })
      .returning()
      .execute();

    // Create SPP card
    await db.insert(sppCardsTable)
      .values({
        student_id: student.id,
        barcode: 'MULTI123456',
        is_active: true
      })
      .execute();

    // Create multiple student payments
    await db.insert(studentPaymentsTable)
      .values([
        {
          student_id: student.id,
          payment_config_id: sppConfig[0].id,
          amount_due: '500000',
          amount_paid: '500000',
          amount_remaining: '0',
          status: 'PAID' as const
        },
        {
          student_id: student.id,
          payment_config_id: buildingConfig[0].id,
          amount_due: '1000000',
          amount_paid: '0',
          amount_remaining: '1000000',
          status: 'PENDING' as const
        }
      ])
      .execute();

    const result = await scanBarcode('MULTI123456');

    expect(result).toBeDefined();
    expect(result!.paymentHistory).toHaveLength(2);

    const sppPayment = result!.paymentHistory.find(p => p.payment_type === 'SPP');
    const buildingPayment = result!.paymentHistory.find(p => p.payment_type === 'UANG_GEDUNG');

    expect(sppPayment).toBeDefined();
    expect(sppPayment!.status).toBe('PAID');
    expect(sppPayment!.amount_due).toBe(500000);
    expect(sppPayment!.amount_paid).toBe(500000);

    expect(buildingPayment).toBeDefined();
    expect(buildingPayment!.status).toBe('PENDING');
    expect(buildingPayment!.amount_due).toBe(1000000);
    expect(buildingPayment!.amount_paid).toBe(0);
  });

  it('should return student with empty payment history when no payments exist', async () => {
    // Create test student
    const studentResults = await db.insert(studentsTable)
      .values(testStudent)
      .returning()
      .execute();
    const student = studentResults[0];

    // Create SPP card without any payments
    await db.insert(sppCardsTable)
      .values({
        student_id: student.id,
        barcode: 'NOPAY123456',
        is_active: true
      })
      .execute();

    const result = await scanBarcode('NOPAY123456');

    expect(result).toBeDefined();
    expect(result!.id).toBe(student.id);
    expect(result!.name).toBe('Test Student');
    expect(result!.paymentHistory).toHaveLength(0);
  });

  it('should return null when barcode does not exist', async () => {
    const result = await scanBarcode('NONEXISTENT');
    expect(result).toBeNull();
  });

  it('should return null when barcode exists but is inactive', async () => {
    // Create test student
    const studentResults = await db.insert(studentsTable)
      .values(testStudent)
      .returning()
      .execute();
    const student = studentResults[0];

    // Create inactive SPP card
    await db.insert(sppCardsTable)
      .values({
        student_id: student.id,
        barcode: 'INACTIVE123',
        is_active: false
      })
      .execute();

    const result = await scanBarcode('INACTIVE123');
    expect(result).toBeNull();
  });

  it('should return null when barcode is malformed', async () => {
    // Test with various malformed barcodes
    const malformedBarcodes = [
      'INVALID-BARCODE-123',
      '!@#$%^&*()',
      'BARCODE WITH SPACES',
      '12345', // Too short
      'A'.repeat(100) // Too long
    ];

    for (const barcode of malformedBarcodes) {
      const result = await scanBarcode(barcode);
      expect(result).toBeNull();
    }
  });

  it('should handle barcode scanning for different grades and classes', async () => {
    // Create students from different grades
    const tkStudent = await db.insert(studentsTable)
      .values({
        ...testStudent,
        nis: 'TK001',
        name: 'TK Student',
        grade: 'TK' as const,
        class_name: 'TK-B'
      })
      .returning()
      .execute();

    const sdStudent = await db.insert(studentsTable)
      .values({
        ...testStudent,
        nis: 'SD001',
        name: 'SD Student',
        grade: 'SD' as const,
        class_name: '6A'
      })
      .returning()
      .execute();

    // Create SPP cards for both students
    await db.insert(sppCardsTable)
      .values([
        {
          student_id: tkStudent[0].id,
          barcode: 'TK_BARCODE',
          is_active: true
        },
        {
          student_id: sdStudent[0].id,
          barcode: 'SD_BARCODE',
          is_active: true
        }
      ])
      .execute();

    // Test TK student
    const tkResult = await scanBarcode('TK_BARCODE');
    expect(tkResult).toBeDefined();
    expect(tkResult!.grade).toBe('TK');
    expect(tkResult!.class_name).toBe('TK-B');

    // Test SD student
    const sdResult = await scanBarcode('SD_BARCODE');
    expect(sdResult).toBeDefined();
    expect(sdResult!.grade).toBe('SD');
    expect(sdResult!.class_name).toBe('6A');
  });

  it('should handle empty barcode input', async () => {
    const result = await scanBarcode('');
    expect(result).toBeNull();
  });
});