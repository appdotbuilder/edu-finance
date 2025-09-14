import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { studentsTable, paymentConfigsTable, studentPaymentsTable } from '../db/schema';
import { type CreateStudentInput, type CreatePaymentConfigInput, type GetStudentPaymentsQuery } from '../schema';
import { getStudentPayments } from '../handlers/get_student_payments';

// Test data setup
const createTestStudent = async (overrides: Partial<CreateStudentInput> = {}) => {
  const studentData: CreateStudentInput = {
    nis: '12345',
    name: 'Test Student',
    grade: 'SMA',
    class_name: '10A',
    phone: '081234567890',
    parent_phone: '081234567891',
    address: 'Test Address',
    status: 'ACTIVE',
    ...overrides
  };

  const result = await db.insert(studentsTable)
    .values({
      ...studentData,
      created_at: new Date(),
      updated_at: new Date()
    })
    .returning()
    .execute();

  return result[0];
};

const createTestPaymentConfig = async (overrides: Partial<CreatePaymentConfigInput> = {}) => {
  const configData: CreatePaymentConfigInput = {
    payment_type: 'SPP',
    name: 'SPP Monthly',
    description: 'Monthly SPP payment',
    amount: 500000,
    grade: 'SMA',
    class_name: '10A',
    can_installment: false,
    ...overrides
  };

  const result = await db.insert(paymentConfigsTable)
    .values({
      ...configData,
      amount: configData.amount.toString(),
      is_active: true,
      created_at: new Date(),
      updated_at: new Date()
    })
    .returning()
    .execute();

  return result[0];
};

const createTestStudentPayment = async (studentId: number, paymentConfigId: number, overrides: any = {}) => {
  const paymentData = {
    student_id: studentId,
    payment_config_id: paymentConfigId,
    amount_due: '500000',
    amount_paid: '0',
    amount_remaining: '500000',
    status: 'PENDING' as const,
    due_date: new Date('2024-01-15'),
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides
  };

  const result = await db.insert(studentPaymentsTable)
    .values(paymentData)
    .returning()
    .execute();

  return result[0];
};

describe('getStudentPayments', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should return all student payments when no filters applied', async () => {
    // Create test data
    const student = await createTestStudent();
    const paymentConfig = await createTestPaymentConfig();
    await createTestStudentPayment(student.id, paymentConfig.id);

    const results = await getStudentPayments();

    expect(results).toHaveLength(1);
    expect(results[0].student_id).toEqual(student.id);
    expect(results[0].payment_config_id).toEqual(paymentConfig.id);
    expect(typeof results[0].amount_due).toBe('number');
    expect(results[0].amount_due).toEqual(500000);
    expect(typeof results[0].amount_paid).toBe('number');
    expect(results[0].amount_paid).toEqual(0);
    expect(typeof results[0].amount_remaining).toBe('number');
    expect(results[0].amount_remaining).toEqual(500000);
    expect(results[0].status).toEqual('PENDING');
  });

  it('should filter by student_id', async () => {
    // Create multiple students and payments
    const student1 = await createTestStudent({ nis: '11111' });
    const student2 = await createTestStudent({ nis: '22222' });
    const paymentConfig = await createTestPaymentConfig();

    await createTestStudentPayment(student1.id, paymentConfig.id);
    await createTestStudentPayment(student2.id, paymentConfig.id);

    const query: GetStudentPaymentsQuery = {
      student_id: student1.id
    };

    const results = await getStudentPayments(query);

    expect(results).toHaveLength(1);
    expect(results[0].student_id).toEqual(student1.id);
  });

  it('should filter by payment status', async () => {
    const student = await createTestStudent();
    const paymentConfig = await createTestPaymentConfig();

    // Create payments with different statuses
    await createTestStudentPayment(student.id, paymentConfig.id, { status: 'PENDING' });
    await createTestStudentPayment(student.id, paymentConfig.id, { status: 'PAID' });

    const query: GetStudentPaymentsQuery = {
      status: 'PENDING'
    };

    const results = await getStudentPayments(query);

    expect(results).toHaveLength(1);
    expect(results[0].status).toEqual('PENDING');
  });

  it('should filter by payment_type', async () => {
    const student = await createTestStudent();

    // Create different payment configs
    const sppConfig = await createTestPaymentConfig({ payment_type: 'SPP', name: 'SPP Payment' });
    const buildingConfig = await createTestPaymentConfig({ payment_type: 'UANG_GEDUNG', name: 'Building Fee' });

    await createTestStudentPayment(student.id, sppConfig.id);
    await createTestStudentPayment(student.id, buildingConfig.id);

    const query: GetStudentPaymentsQuery = {
      payment_type: 'SPP'
    };

    const results = await getStudentPayments(query);

    expect(results).toHaveLength(1);
    expect(results[0].payment_config_id).toEqual(sppConfig.id);
  });

  it('should filter by grade', async () => {
    // Create students with different grades
    const smaStudent = await createTestStudent({ nis: '11111', grade: 'SMA' });
    const smpStudent = await createTestStudent({ nis: '22222', grade: 'SMP' });

    const smaConfig = await createTestPaymentConfig({ grade: 'SMA' });
    const smpConfig = await createTestPaymentConfig({ grade: 'SMP' });

    await createTestStudentPayment(smaStudent.id, smaConfig.id);
    await createTestStudentPayment(smpStudent.id, smpConfig.id);

    const query: GetStudentPaymentsQuery = {
      grade: 'SMA'
    };

    const results = await getStudentPayments(query);

    expect(results).toHaveLength(1);
    expect(results[0].student_id).toEqual(smaStudent.id);
  });

  it('should filter by class_name', async () => {
    // Create students in different classes
    const class10A = await createTestStudent({ nis: '11111', class_name: '10A' });
    const class10B = await createTestStudent({ nis: '22222', class_name: '10B' });

    const paymentConfig = await createTestPaymentConfig();

    await createTestStudentPayment(class10A.id, paymentConfig.id);
    await createTestStudentPayment(class10B.id, paymentConfig.id);

    const query: GetStudentPaymentsQuery = {
      class_name: '10A'
    };

    const results = await getStudentPayments(query);

    expect(results).toHaveLength(1);
    expect(results[0].student_id).toEqual(class10A.id);
  });

  it('should handle multiple filters combined', async () => {
    // Create test data
    const smaStudent = await createTestStudent({
      nis: '11111',
      grade: 'SMA',
      class_name: '10A'
    });
    const smpStudent = await createTestStudent({
      nis: '22222',
      grade: 'SMP',
      class_name: '8A'
    });

    const sppConfig = await createTestPaymentConfig({
      payment_type: 'SPP',
      grade: 'SMA'
    });
    const buildingConfig = await createTestPaymentConfig({
      payment_type: 'UANG_GEDUNG',
      grade: 'SMP'
    });

    // Create payments
    await createTestStudentPayment(smaStudent.id, sppConfig.id, { status: 'PENDING' });
    await createTestStudentPayment(smaStudent.id, sppConfig.id, { status: 'PAID' });
    await createTestStudentPayment(smpStudent.id, buildingConfig.id, { status: 'PENDING' });

    const query: GetStudentPaymentsQuery = {
      grade: 'SMA',
      payment_type: 'SPP',
      status: 'PENDING'
    };

    const results = await getStudentPayments(query);

    expect(results).toHaveLength(1);
    expect(results[0].student_id).toEqual(smaStudent.id);
    expect(results[0].status).toEqual('PENDING');
  });

  it('should handle partial payments correctly', async () => {
    const student = await createTestStudent();
    const paymentConfig = await createTestPaymentConfig({ amount: 1000000 });

    // Create partial payment
    await createTestStudentPayment(student.id, paymentConfig.id, {
      amount_due: '1000000',
      amount_paid: '300000',
      amount_remaining: '700000',
      status: 'PARTIAL'
    });

    const results = await getStudentPayments();

    expect(results).toHaveLength(1);
    expect(results[0].amount_due).toEqual(1000000);
    expect(results[0].amount_paid).toEqual(300000);
    expect(results[0].amount_remaining).toEqual(700000);
    expect(results[0].status).toEqual('PARTIAL');
  });

  it('should return empty array when no payments match filters', async () => {
    const student = await createTestStudent({ grade: 'SMA' });
    const paymentConfig = await createTestPaymentConfig({ payment_type: 'SPP' });
    await createTestStudentPayment(student.id, paymentConfig.id);

    const query: GetStudentPaymentsQuery = {
      grade: 'SMP' // Different grade
    };

    const results = await getStudentPayments(query);
    expect(results).toHaveLength(0);
  });

  it('should handle payments with due_date correctly', async () => {
    const student = await createTestStudent();
    const paymentConfig = await createTestPaymentConfig();
    const dueDate = new Date('2024-01-15');

    await createTestStudentPayment(student.id, paymentConfig.id, {
      due_date: dueDate
    });

    const results = await getStudentPayments();

    expect(results).toHaveLength(1);
    expect(results[0].due_date).toEqual(dueDate);
  });

  it('should handle payments without due_date', async () => {
    const student = await createTestStudent();
    const paymentConfig = await createTestPaymentConfig();

    await createTestStudentPayment(student.id, paymentConfig.id, {
      due_date: null
    });

    const results = await getStudentPayments();

    expect(results).toHaveLength(1);
    expect(results[0].due_date).toBeNull();
  });
});