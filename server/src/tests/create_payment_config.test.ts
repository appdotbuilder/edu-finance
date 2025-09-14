import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { paymentConfigsTable, studentsTable } from '../db/schema';
import { type CreatePaymentConfigInput } from '../schema';
import { createPaymentConfig } from '../handlers/create_payment_config';
import { eq } from 'drizzle-orm';

// Test data setup
const createTestStudent = async () => {
  const result = await db.insert(studentsTable)
    .values({
      nis: 'TEST001',
      name: 'Test Student',
      grade: 'SMA',
      class_name: 'XII IPA 1',
      phone: '081234567890',
      parent_phone: '081987654321',
      address: 'Test Address',
      status: 'ACTIVE'
    })
    .returning()
    .execute();
  return result[0];
};

// Test inputs
const basicPaymentConfigInput: CreatePaymentConfigInput = {
  payment_type: 'SPP',
  name: 'SPP SMA Regular',
  description: 'Monthly school fee for SMA students',
  amount: 500000,
  grade: 'SMA',
  class_name: null,
  student_id: null,
  can_installment: true
};

const specificStudentPaymentConfigInput: CreatePaymentConfigInput = {
  payment_type: 'UANG_GEDUNG',
  name: 'Building Fund - Special Rate',
  description: 'Discounted building fund for scholarship student',
  amount: 2500000,
  grade: null,
  class_name: null,
  student_id: 1, // Will be set to actual student ID in tests
  can_installment: false
};

describe('createPaymentConfig', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should create a payment configuration for grade level', async () => {
    const result = await createPaymentConfig(basicPaymentConfigInput);

    // Basic field validation
    expect(result.payment_type).toEqual('SPP');
    expect(result.name).toEqual('SPP SMA Regular');
    expect(result.description).toEqual('Monthly school fee for SMA students');
    expect(result.amount).toEqual(500000);
    expect(typeof result.amount).toBe('number');
    expect(result.grade).toEqual('SMA');
    expect(result.class_name).toBeNull();
    expect(result.student_id).toBeNull();
    expect(result.is_active).toBe(true);
    expect(result.can_installment).toBe(true);
    expect(result.id).toBeDefined();
    expect(result.created_at).toBeInstanceOf(Date);
    expect(result.updated_at).toBeInstanceOf(Date);
  });

  it('should save payment configuration to database', async () => {
    const result = await createPaymentConfig(basicPaymentConfigInput);

    // Query using proper drizzle syntax
    const paymentConfigs = await db.select()
      .from(paymentConfigsTable)
      .where(eq(paymentConfigsTable.id, result.id))
      .execute();

    expect(paymentConfigs).toHaveLength(1);
    expect(paymentConfigs[0].payment_type).toEqual('SPP');
    expect(paymentConfigs[0].name).toEqual('SPP SMA Regular');
    expect(paymentConfigs[0].description).toEqual('Monthly school fee for SMA students');
    expect(parseFloat(paymentConfigs[0].amount)).toEqual(500000);
    expect(paymentConfigs[0].grade).toEqual('SMA');
    expect(paymentConfigs[0].is_active).toBe(true);
    expect(paymentConfigs[0].can_installment).toBe(true);
    expect(paymentConfigs[0].created_at).toBeInstanceOf(Date);
    expect(paymentConfigs[0].updated_at).toBeInstanceOf(Date);
  });

  it('should create payment configuration for specific student', async () => {
    // Create prerequisite student
    const student = await createTestStudent();
    
    const input = {
      ...specificStudentPaymentConfigInput,
      student_id: student.id
    };

    const result = await createPaymentConfig(input);

    expect(result.payment_type).toEqual('UANG_GEDUNG');
    expect(result.name).toEqual('Building Fund - Special Rate');
    expect(result.amount).toEqual(2500000);
    expect(typeof result.amount).toBe('number');
    expect(result.grade).toBeNull();
    expect(result.class_name).toBeNull();
    expect(result.student_id).toEqual(student.id);
    expect(result.can_installment).toBe(false);
    expect(result.is_active).toBe(true);
  });

  it('should create payment configuration for specific class', async () => {
    const classLevelInput: CreatePaymentConfigInput = {
      payment_type: 'UANG_UJIAN',
      name: 'Exam Fee - XII IPA 1',
      description: 'Final exam fee for grade XII IPA 1',
      amount: 150000,
      grade: 'SMA',
      class_name: 'XII IPA 1',
      student_id: null,
      can_installment: false
    };

    const result = await createPaymentConfig(classLevelInput);

    expect(result.payment_type).toEqual('UANG_UJIAN');
    expect(result.name).toEqual('Exam Fee - XII IPA 1');
    expect(result.grade).toEqual('SMA');
    expect(result.class_name).toEqual('XII IPA 1');
    expect(result.student_id).toBeNull();
    expect(result.amount).toEqual(150000);
    expect(result.can_installment).toBe(false);
  });

  it('should handle minimal required fields', async () => {
    const minimalInput: CreatePaymentConfigInput = {
      payment_type: 'LAINNYA',
      name: 'Miscellaneous Fee',
      amount: 25000
    };

    const result = await createPaymentConfig(minimalInput);

    expect(result.payment_type).toEqual('LAINNYA');
    expect(result.name).toEqual('Miscellaneous Fee');
    expect(result.amount).toEqual(25000);
    expect(result.description).toBeNull();
    expect(result.grade).toBeNull();
    expect(result.class_name).toBeNull();
    expect(result.student_id).toBeNull();
    expect(result.can_installment).toBe(false); // Default value
    expect(result.is_active).toBe(true); // Default value
  });

  it('should reject invalid student_id', async () => {
    const invalidStudentInput = {
      ...basicPaymentConfigInput,
      student_id: 99999 // Non-existent student ID
    };

    await expect(createPaymentConfig(invalidStudentInput))
      .rejects.toThrow(/Student with id 99999 does not exist/i);
  });

  it('should handle different payment types correctly', async () => {
    const paymentTypes = [
      'SPP', 'UANG_GEDUNG', 'DAFTAR_ULANG', 'UANG_UJIAN', 
      'UANG_SERAGAM', 'UANG_BUKU', 'STUDY_TOUR', 'TABUNGAN', 'LAINNYA'
    ] as const;

    for (const paymentType of paymentTypes) {
      const input: CreatePaymentConfigInput = {
        payment_type: paymentType,
        name: `Test ${paymentType}`,
        amount: 100000
      };

      const result = await createPaymentConfig(input);
      expect(result.payment_type).toEqual(paymentType);
      expect(result.name).toEqual(`Test ${paymentType}`);
    }
  });

  it('should handle different grade levels correctly', async () => {
    const grades = ['TK', 'SD', 'SMP', 'SMA', 'SMK'] as const;

    for (const grade of grades) {
      const input: CreatePaymentConfigInput = {
        payment_type: 'SPP',
        name: `SPP for ${grade}`,
        amount: 200000,
        grade: grade
      };

      const result = await createPaymentConfig(input);
      expect(result.grade).toEqual(grade);
      expect(result.name).toEqual(`SPP for ${grade}`);
    }
  });

  it('should preserve numeric precision for amounts', async () => {
    const preciseAmountInput: CreatePaymentConfigInput = {
      payment_type: 'SPP',
      name: 'Precise Amount Test',
      amount: 1234567.89
    };

    const result = await createPaymentConfig(preciseAmountInput);
    expect(result.amount).toEqual(1234567.89);
    expect(typeof result.amount).toBe('number');

    // Verify in database
    const saved = await db.select()
      .from(paymentConfigsTable)
      .where(eq(paymentConfigsTable.id, result.id))
      .execute();
    
    expect(parseFloat(saved[0].amount)).toEqual(1234567.89);
  });
});