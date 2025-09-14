import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { studentsTable } from '../db/schema';
import { type CreateStudentInput } from '../schema';
import { createStudent } from '../handlers/create_student';
import { eq } from 'drizzle-orm';

// Test input with all required fields
const testInput: CreateStudentInput = {
  nis: '12345',
  name: 'John Doe',
  grade: 'SMA',
  class_name: 'XII-A',
  phone: '08123456789',
  parent_phone: '08987654321',
  address: 'Jl. Test No. 123',
  status: 'ACTIVE'
};

// Minimal required fields only
const minimalInput: CreateStudentInput = {
  nis: '54321',
  name: 'Jane Smith',
  grade: 'SMP',
  class_name: 'IX-B'
};

describe('createStudent', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should create a student with all fields', async () => {
    const result = await createStudent(testInput);

    // Basic field validation
    expect(result.nis).toEqual('12345');
    expect(result.name).toEqual('John Doe');
    expect(result.grade).toEqual('SMA');
    expect(result.class_name).toEqual('XII-A');
    expect(result.phone).toEqual('08123456789');
    expect(result.parent_phone).toEqual('08987654321');
    expect(result.address).toEqual('Jl. Test No. 123');
    expect(result.status).toEqual('ACTIVE');
    expect(result.id).toBeDefined();
    expect(result.created_at).toBeInstanceOf(Date);
    expect(result.updated_at).toBeInstanceOf(Date);
  });

  it('should create a student with minimal required fields', async () => {
    const result = await createStudent(minimalInput);

    // Basic field validation
    expect(result.nis).toEqual('54321');
    expect(result.name).toEqual('Jane Smith');
    expect(result.grade).toEqual('SMP');
    expect(result.class_name).toEqual('IX-B');
    expect(result.phone).toBeNull();
    expect(result.parent_phone).toBeNull();
    expect(result.address).toBeNull();
    expect(result.status).toEqual('ACTIVE'); // Default value
    expect(result.id).toBeDefined();
    expect(result.created_at).toBeInstanceOf(Date);
    expect(result.updated_at).toBeInstanceOf(Date);
  });

  it('should save student to database', async () => {
    const result = await createStudent(testInput);

    // Query using proper drizzle syntax
    const students = await db.select()
      .from(studentsTable)
      .where(eq(studentsTable.id, result.id))
      .execute();

    expect(students).toHaveLength(1);
    expect(students[0].nis).toEqual('12345');
    expect(students[0].name).toEqual('John Doe');
    expect(students[0].grade).toEqual('SMA');
    expect(students[0].class_name).toEqual('XII-A');
    expect(students[0].phone).toEqual('08123456789');
    expect(students[0].parent_phone).toEqual('08987654321');
    expect(students[0].address).toEqual('Jl. Test No. 123');
    expect(students[0].status).toEqual('ACTIVE');
    expect(students[0].created_at).toBeInstanceOf(Date);
    expect(students[0].updated_at).toBeInstanceOf(Date);
  });

  it('should handle different grades correctly', async () => {
    const grades = ['TK', 'SD', 'SMP', 'SMA', 'SMK'] as const;
    
    for (const grade of grades) {
      const input: CreateStudentInput = {
        nis: `nis-${grade}`,
        name: `Student ${grade}`,
        grade: grade,
        class_name: 'I-A'
      };
      
      const result = await createStudent(input);
      expect(result.grade).toEqual(grade);
    }
  });

  it('should handle different student statuses correctly', async () => {
    const statuses = ['ACTIVE', 'INACTIVE', 'GRADUATED'] as const;
    
    for (const status of statuses) {
      const input: CreateStudentInput = {
        nis: `nis-${status}`,
        name: `Student ${status}`,
        grade: 'SMA',
        class_name: 'XII-A',
        status: status
      };
      
      const result = await createStudent(input);
      expect(result.status).toEqual(status);
    }
  });

  it('should fail when creating student with duplicate NIS', async () => {
    // Create first student
    await createStudent(testInput);

    // Try to create another student with same NIS
    await expect(createStudent(testInput)).rejects.toThrow(/unique/i);
  });

  it('should handle null optional fields correctly', async () => {
    const inputWithNulls: CreateStudentInput = {
      nis: '99999',
      name: 'Test Student',
      grade: 'SMA',
      class_name: 'XII-C',
      phone: null,
      parent_phone: null,
      address: null
    };

    const result = await createStudent(inputWithNulls);
    
    expect(result.phone).toBeNull();
    expect(result.parent_phone).toBeNull();
    expect(result.address).toBeNull();
  });

  it('should set default status when not provided', async () => {
    const inputWithoutStatus: CreateStudentInput = {
      nis: '88888',
      name: 'Default Status Student',
      grade: 'SD',
      class_name: 'VI-A'
    };

    const result = await createStudent(inputWithoutStatus);
    
    expect(result.status).toEqual('ACTIVE');
  });
});