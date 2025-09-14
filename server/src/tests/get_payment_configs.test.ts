import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { paymentConfigsTable, studentsTable } from '../db/schema';
import { type CreatePaymentConfigInput } from '../schema';
import { getPaymentConfigs } from '../handlers/get_payment_configs';

describe('getPaymentConfigs', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should return empty array when no payment configurations exist', async () => {
    const result = await getPaymentConfigs();
    expect(result).toEqual([]);
  });

  it('should return all active payment configurations', async () => {
    // Create test student first for foreign key constraint
    const studentResult = await db.insert(studentsTable)
      .values({
        nis: 'TEST001',
        name: 'Test Student',
        grade: 'SD',
        class_name: '1A',
        status: 'ACTIVE'
      })
      .returning()
      .execute();

    const student = studentResult[0];

    // Create multiple payment configurations
    await db.insert(paymentConfigsTable)
      .values([
        {
          payment_type: 'SPP',
          name: 'SPP SD Kelas 1',
          description: 'SPP untuk kelas 1 SD',
          amount: '150000.00', // Convert number to string
          grade: 'SD',
          class_name: '1A',
          is_active: true,
          can_installment: true
        },
        {
          payment_type: 'UANG_GEDUNG',
          name: 'Uang Gedung',
          description: 'Biaya pembangunan gedung',
          amount: '500000.00',
          is_active: true,
          can_installment: false
        },
        {
          payment_type: 'UANG_BUKU',
          name: 'Uang Buku Khusus Siswa',
          description: 'Biaya buku untuk siswa tertentu',
          amount: '75000.00',
          student_id: student.id,
          is_active: true,
          can_installment: false
        }
      ])
      .execute();

    const result = await getPaymentConfigs();

    expect(result).toHaveLength(3);
    
    // Verify all configurations are returned
    const sppConfig = result.find(c => c.payment_type === 'SPP');
    const gedungConfig = result.find(c => c.payment_type === 'UANG_GEDUNG');
    const bukuConfig = result.find(c => c.payment_type === 'UANG_BUKU');

    expect(sppConfig).toBeDefined();
    expect(sppConfig?.name).toBe('SPP SD Kelas 1');
    expect(sppConfig?.amount).toBe(150000); // Should be number, not string
    expect(sppConfig?.grade).toBe('SD');
    expect(sppConfig?.class_name).toBe('1A');
    expect(sppConfig?.can_installment).toBe(true);
    expect(typeof sppConfig?.amount).toBe('number');

    expect(gedungConfig).toBeDefined();
    expect(gedungConfig?.amount).toBe(500000);
    expect(gedungConfig?.grade).toBeNull();
    expect(gedungConfig?.class_name).toBeNull();

    expect(bukuConfig).toBeDefined();
    expect(bukuConfig?.amount).toBe(75000);
    expect(bukuConfig?.student_id).toBe(student.id);
  });

  it('should only return active payment configurations', async () => {
    // Create both active and inactive configurations
    await db.insert(paymentConfigsTable)
      .values([
        {
          payment_type: 'SPP',
          name: 'Active SPP',
          amount: '100000.00',
          is_active: true,
          can_installment: false
        },
        {
          payment_type: 'UANG_GEDUNG',
          name: 'Inactive Uang Gedung',
          amount: '200000.00',
          is_active: false,
          can_installment: false
        },
        {
          payment_type: 'UANG_BUKU',
          name: 'Another Active Config',
          amount: '50000.00',
          is_active: true,
          can_installment: true
        }
      ])
      .execute();

    const result = await getPaymentConfigs();

    expect(result).toHaveLength(2);
    expect(result.every(config => config.is_active)).toBe(true);
    
    const configNames = result.map(c => c.name);
    expect(configNames).toContain('Active SPP');
    expect(configNames).toContain('Another Active Config');
    expect(configNames).not.toContain('Inactive Uang Gedung');
  });

  it('should handle different payment types correctly', async () => {
    // Create configurations for different payment types
    await db.insert(paymentConfigsTable)
      .values([
        {
          payment_type: 'SPP',
          name: 'SPP Monthly',
          amount: '150000.00',
          is_active: true,
          can_installment: true
        },
        {
          payment_type: 'DAFTAR_ULANG',
          name: 'Registration Fee',
          amount: '300000.00',
          is_active: true,
          can_installment: false
        },
        {
          payment_type: 'STUDY_TOUR',
          name: 'Study Tour SMA',
          amount: '1000000.00',
          grade: 'SMA',
          is_active: true,
          can_installment: true
        },
        {
          payment_type: 'LAINNYA',
          name: 'Other Fees',
          amount: '50000.00',
          is_active: true,
          can_installment: false
        }
      ])
      .execute();

    const result = await getPaymentConfigs();

    expect(result).toHaveLength(4);
    
    // Verify all payment types are present
    const paymentTypes = result.map(c => c.payment_type);
    expect(paymentTypes).toContain('SPP');
    expect(paymentTypes).toContain('DAFTAR_ULANG');
    expect(paymentTypes).toContain('STUDY_TOUR');
    expect(paymentTypes).toContain('LAINNYA');

    // Verify numeric conversion works for all amounts
    result.forEach(config => {
      expect(typeof config.amount).toBe('number');
      expect(config.amount).toBeGreaterThan(0);
    });
  });

  it('should handle nullable fields correctly', async () => {
    // Create configuration with all nullable fields as null
    await db.insert(paymentConfigsTable)
      .values({
        payment_type: 'TABUNGAN',
        name: 'Savings Fund',
        description: null, // Nullable field
        amount: '25000.00',
        grade: null, // Nullable field
        class_name: null, // Nullable field
        student_id: null, // Nullable field
        is_active: true,
        can_installment: false
      })
      .execute();

    const result = await getPaymentConfigs();

    expect(result).toHaveLength(1);
    
    const config = result[0];
    expect(config.description).toBeNull();
    expect(config.grade).toBeNull();
    expect(config.class_name).toBeNull();
    expect(config.student_id).toBeNull();
    expect(config.amount).toBe(25000);
    expect(config.is_active).toBe(true);
  });

  it('should return configurations with correct timestamps', async () => {
    await db.insert(paymentConfigsTable)
      .values({
        payment_type: 'UANG_UJIAN',
        name: 'Exam Fee',
        amount: '100000.00',
        is_active: true,
        can_installment: false
      })
      .execute();

    const result = await getPaymentConfigs();

    expect(result).toHaveLength(1);
    
    const config = result[0];
    expect(config.created_at).toBeInstanceOf(Date);
    expect(config.updated_at).toBeInstanceOf(Date);
    expect(config.id).toBeDefined();
    expect(typeof config.id).toBe('number');
  });
});