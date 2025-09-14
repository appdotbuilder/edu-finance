import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { studentsTable, savingsTable } from '../db/schema';
import { getStudentSavings } from '../handlers/get_student_savings';

describe('getStudentSavings', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  let studentId: number;
  let savingsId: number;

  beforeEach(async () => {
    // Create a test student first
    const studentResult = await db.insert(studentsTable)
      .values({
        nis: 'TEST001',
        name: 'Test Student',
        grade: 'SMA',
        class_name: '12A',
        status: 'ACTIVE'
      })
      .returning()
      .execute();

    studentId = studentResult[0].id;

    // Create savings account for the student
    const savingsResult = await db.insert(savingsTable)
      .values({
        student_id: studentId,
        balance: '150000.50' // Store as string for numeric column
      })
      .returning()
      .execute();

    savingsId = savingsResult[0].id;
  });

  it('should return student savings when exists', async () => {
    const result = await getStudentSavings(studentId);

    expect(result).toBeDefined();
    expect(result!.id).toBe(savingsId);
    expect(result!.student_id).toBe(studentId);
    expect(result!.balance).toBe(150000.50); // Should be converted to number
    expect(typeof result!.balance).toBe('number');
    expect(result!.created_at).toBeInstanceOf(Date);
    expect(result!.updated_at).toBeInstanceOf(Date);
  });

  it('should return null when student has no savings account', async () => {
    // Create another student without savings
    const anotherStudentResult = await db.insert(studentsTable)
      .values({
        nis: 'TEST002',
        name: 'Another Student',
        grade: 'SMP',
        class_name: '9B',
        status: 'ACTIVE'
      })
      .returning()
      .execute();

    const result = await getStudentSavings(anotherStudentResult[0].id);

    expect(result).toBeNull();
  });

  it('should return null for non-existent student', async () => {
    const result = await getStudentSavings(99999);

    expect(result).toBeNull();
  });

  it('should handle zero balance correctly', async () => {
    // Create student with zero balance
    const zeroStudentResult = await db.insert(studentsTable)
      .values({
        nis: 'TEST003',
        name: 'Zero Balance Student',
        grade: 'SD',
        class_name: '6A',
        status: 'ACTIVE'
      })
      .returning()
      .execute();

    await db.insert(savingsTable)
      .values({
        student_id: zeroStudentResult[0].id,
        balance: '0.00'
      })
      .execute();

    const result = await getStudentSavings(zeroStudentResult[0].id);

    expect(result).toBeDefined();
    expect(result!.balance).toBe(0);
    expect(typeof result!.balance).toBe('number');
  });

  it('should handle large balance amounts correctly', async () => {
    // Create student with large balance
    const richStudentResult = await db.insert(studentsTable)
      .values({
        nis: 'TEST004',
        name: 'Rich Student',
        grade: 'SMK',
        class_name: '11C',
        status: 'ACTIVE'
      })
      .returning()
      .execute();

    await db.insert(savingsTable)
      .values({
        student_id: richStudentResult[0].id,
        balance: '9999999.99'
      })
      .execute();

    const result = await getStudentSavings(richStudentResult[0].id);

    expect(result).toBeDefined();
    expect(result!.balance).toBe(9999999.99);
    expect(typeof result!.balance).toBe('number');
  });
});