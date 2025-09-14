import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { studentsTable } from '../db/schema';
import { type CreateStudentInput } from '../schema';
import { getStudents } from '../handlers/get_students';

// Test students data
const testStudents: CreateStudentInput[] = [
  {
    nis: '12345',
    name: 'Ahmad Santoso',
    grade: 'SMA',
    class_name: '10A',
    phone: '081234567890',
    parent_phone: '081234567891',
    address: 'Jakarta Pusat',
    status: 'ACTIVE'
  },
  {
    nis: '12346',
    name: 'Sari Dewi',
    grade: 'SMA',
    class_name: '10B',
    phone: '081234567892',
    parent_phone: '081234567893',
    address: 'Jakarta Selatan',
    status: 'ACTIVE'
  },
  {
    nis: '12347',
    name: 'Budi Pratama',
    grade: 'SMP',
    class_name: '8A',
    phone: '081234567894',
    parent_phone: '081234567895',
    address: 'Jakarta Timur',
    status: 'INACTIVE'
  },
  {
    nis: '12348',
    name: 'Rina Maharani',
    grade: 'SD',
    class_name: '5B',
    phone: null,
    parent_phone: '081234567896',
    address: 'Jakarta Barat',
    status: 'GRADUATED'
  }
];

describe('getStudents', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  // Helper function to create test students
  const createTestStudents = async () => {
    for (const student of testStudents) {
      await db.insert(studentsTable).values(student).execute();
    }
  };

  it('should return all students when no query provided', async () => {
    await createTestStudents();
    
    const result = await getStudents();
    
    expect(result).toHaveLength(4);
    expect(result[0]).toMatchObject({
      nis: '12345',
      name: 'Ahmad Santoso',
      grade: 'SMA',
      class_name: '10A',
      status: 'ACTIVE'
    });
    expect(result[0].id).toBeDefined();
    expect(result[0].created_at).toBeInstanceOf(Date);
    expect(result[0].updated_at).toBeInstanceOf(Date);
  });

  it('should return empty array when no students exist', async () => {
    const result = await getStudents();
    
    expect(result).toHaveLength(0);
  });

  it('should filter students by grade', async () => {
    await createTestStudents();
    
    const result = await getStudents({ grade: 'SMA' });
    
    expect(result).toHaveLength(2);
    expect(result[0].grade).toBe('SMA');
    expect(result[1].grade).toBe('SMA');
    expect(result[0].name).toBe('Ahmad Santoso');
    expect(result[1].name).toBe('Sari Dewi');
  });

  it('should filter students by class name', async () => {
    await createTestStudents();
    
    const result = await getStudents({ class_name: '10A' });
    
    expect(result).toHaveLength(1);
    expect(result[0].class_name).toBe('10A');
    expect(result[0].name).toBe('Ahmad Santoso');
  });

  it('should filter students by status', async () => {
    await createTestStudents();
    
    const result = await getStudents({ status: 'INACTIVE' });
    
    expect(result).toHaveLength(1);
    expect(result[0].status).toBe('INACTIVE');
    expect(result[0].name).toBe('Budi Pratama');
  });

  it('should search students by name (case-insensitive)', async () => {
    await createTestStudents();
    
    const result = await getStudents({ search: 'ahmad' });
    
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Ahmad Santoso');
  });

  it('should search students by partial name', async () => {
    await createTestStudents();
    
    const result = await getStudents({ search: 'Sari' });
    
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Sari Dewi');
  });

  it('should search students by NIS', async () => {
    await createTestStudents();
    
    const result = await getStudents({ search: '12347' });
    
    expect(result).toHaveLength(1);
    expect(result[0].nis).toBe('12347');
    expect(result[0].name).toBe('Budi Pratama');
  });

  it('should search students by partial NIS', async () => {
    await createTestStudents();
    
    const result = await getStudents({ search: '1234' });
    
    expect(result).toHaveLength(4);
    // All students have NIS starting with '1234'
  });

  it('should return empty array for non-matching search', async () => {
    await createTestStudents();
    
    const result = await getStudents({ search: 'NonExistent' });
    
    expect(result).toHaveLength(0);
  });

  it('should combine multiple filters with AND logic', async () => {
    await createTestStudents();
    
    const result = await getStudents({ 
      grade: 'SMA',
      class_name: '10A',
      status: 'ACTIVE'
    });
    
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Ahmad Santoso');
    expect(result[0].grade).toBe('SMA');
    expect(result[0].class_name).toBe('10A');
    expect(result[0].status).toBe('ACTIVE');
  });

  it('should combine filter with search', async () => {
    await createTestStudents();
    
    const result = await getStudents({ 
      grade: 'SMA',
      search: 'Sari'
    });
    
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Sari Dewi');
    expect(result[0].grade).toBe('SMA');
  });

  it('should return empty array when filters do not match', async () => {
    await createTestStudents();
    
    const result = await getStudents({ 
      grade: 'TK',
      class_name: '10A'
    });
    
    expect(result).toHaveLength(0);
  });

  it('should handle students with null optional fields', async () => {
    await createTestStudents();
    
    const result = await getStudents({ grade: 'SD' });
    
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Rina Maharani');
    expect(result[0].phone).toBeNull();
    expect(result[0].parent_phone).toBe('081234567896');
    expect(result[0].address).toBe('Jakarta Barat');
  });

  it('should maintain proper data types in returned students', async () => {
    await createTestStudents();
    
    const result = await getStudents();
    
    expect(result).toHaveLength(4);
    
    const student = result[0];
    expect(typeof student.id).toBe('number');
    expect(typeof student.nis).toBe('string');
    expect(typeof student.name).toBe('string');
    expect(typeof student.grade).toBe('string');
    expect(typeof student.class_name).toBe('string');
    expect(student.created_at).toBeInstanceOf(Date);
    expect(student.updated_at).toBeInstanceOf(Date);
  });
});