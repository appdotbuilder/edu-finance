import { db } from '../db';
import { savingsTable } from '../db/schema';
import { eq } from 'drizzle-orm';
import { type Savings } from '../schema';

export const getStudentSavings = async (studentId: number): Promise<Savings | null> => {
  try {
    const results = await db.select()
      .from(savingsTable)
      .where(eq(savingsTable.student_id, studentId))
      .execute();

    if (results.length === 0) {
      return null;
    }

    const savings = results[0];
    return {
      ...savings,
      balance: parseFloat(savings.balance) // Convert numeric to number
    };
  } catch (error) {
    console.error('Failed to get student savings:', error);
    throw error;
  }
};