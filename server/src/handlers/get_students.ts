import { db } from '../db';
import { studentsTable } from '../db/schema';
import { type GetStudentsQuery, type Student } from '../schema';
import { eq, and, or, ilike, type SQL } from 'drizzle-orm';

export async function getStudents(query: GetStudentsQuery = {}): Promise<Student[]> {
  try {
    // Collect filter conditions
    const conditions: SQL<unknown>[] = [];

    // Filter by grade
    if (query.grade) {
      conditions.push(eq(studentsTable.grade, query.grade));
    }

    // Filter by class name
    if (query.class_name) {
      conditions.push(eq(studentsTable.class_name, query.class_name));
    }

    // Filter by status
    if (query.status) {
      conditions.push(eq(studentsTable.status, query.status));
    }

    // Search by name or NIS (case-insensitive)
    if (query.search) {
      const searchCondition = or(
        ilike(studentsTable.name, `%${query.search}%`),
        ilike(studentsTable.nis, `%${query.search}%`)
      );
      if (searchCondition) {
        conditions.push(searchCondition);
      }
    }

    // Build and execute query
    let results;
    if (conditions.length === 0) {
      // No filters - select all
      results = await db.select().from(studentsTable).execute();
    } else if (conditions.length === 1) {
      // Single condition
      results = await db.select()
        .from(studentsTable)
        .where(conditions[0])
        .execute();
    } else {
      // Multiple conditions - use AND
      results = await db.select()
        .from(studentsTable)
        .where(and(...conditions))
        .execute();
    }

    // Return the results (no numeric conversion needed for students table)
    return results;
  } catch (error) {
    console.error('Failed to fetch students:', error);
    throw error;
  }
}