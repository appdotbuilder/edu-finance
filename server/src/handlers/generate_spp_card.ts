import { db } from '../db';
import { studentsTable, sppCardsTable } from '../db/schema';
import { type GenerateSppCardInput, type SppCard } from '../schema';
import { eq } from 'drizzle-orm';

export const generateSppCard = async (input: GenerateSppCardInput): Promise<SppCard> => {
  try {
    // Verify that the student exists
    const student = await db.select()
      .from(studentsTable)
      .where(eq(studentsTable.id, input.student_id))
      .execute();

    if (student.length === 0) {
      throw new Error(`Student with ID ${input.student_id} not found`);
    }

    // Check if student already has an active SPP card
    const existingCard = await db.select()
      .from(sppCardsTable)
      .where(eq(sppCardsTable.student_id, input.student_id))
      .execute();

    // Deactivate existing cards for this student
    if (existingCard.length > 0) {
      await db.update(sppCardsTable)
        .set({ 
          is_active: false,
          updated_at: new Date()
        })
        .where(eq(sppCardsTable.student_id, input.student_id))
        .execute();
    }

    // Generate unique barcode
    const timestamp = Date.now();
    const barcode = `SPP${input.student_id.toString().padStart(6, '0')}${timestamp}`;

    // Insert new SPP card
    const result = await db.insert(sppCardsTable)
      .values({
        student_id: input.student_id,
        barcode: barcode,
        is_active: true
      })
      .returning()
      .execute();

    return result[0];
  } catch (error) {
    console.error('SPP card generation failed:', error);
    throw error;
  }
};