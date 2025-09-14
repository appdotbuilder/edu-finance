import { db } from '../db';
import { studentsTable } from '../db/schema';
import { type CreateStudentInput, type Student } from '../schema';

export const createStudent = async (input: CreateStudentInput): Promise<Student> => {
  try {
    // Insert student record
    const result = await db.insert(studentsTable)
      .values({
        nis: input.nis,
        name: input.name,
        grade: input.grade,
        class_name: input.class_name,
        phone: input.phone || null,
        parent_phone: input.parent_phone || null,
        address: input.address || null,
        status: input.status || 'ACTIVE'
      })
      .returning()
      .execute();

    // Return the created student
    const student = result[0];
    return student;
  } catch (error) {
    console.error('Student creation failed:', error);
    throw error;
  }
};