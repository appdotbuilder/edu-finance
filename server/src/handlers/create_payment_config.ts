import { db } from '../db';
import { paymentConfigsTable, studentsTable } from '../db/schema';
import { type CreatePaymentConfigInput, type PaymentConfig } from '../schema';
import { eq } from 'drizzle-orm';

export async function createPaymentConfig(input: CreatePaymentConfigInput): Promise<PaymentConfig> {
  try {
    // Validate foreign key constraint if student_id is provided
    if (input.student_id) {
      const student = await db.select()
        .from(studentsTable)
        .where(eq(studentsTable.id, input.student_id))
        .execute();
      
      if (student.length === 0) {
        throw new Error(`Student with id ${input.student_id} does not exist`);
      }
    }

    // Insert payment configuration record
    const result = await db.insert(paymentConfigsTable)
      .values({
        payment_type: input.payment_type,
        name: input.name,
        description: input.description || null,
        amount: input.amount.toString(), // Convert number to string for numeric column
        grade: input.grade || null,
        class_name: input.class_name || null,
        student_id: input.student_id || null,
        is_active: true,
        can_installment: input.can_installment || false
      })
      .returning()
      .execute();

    // Convert numeric fields back to numbers before returning
    const paymentConfig = result[0];
    return {
      ...paymentConfig,
      amount: parseFloat(paymentConfig.amount) // Convert string back to number
    };
  } catch (error) {
    console.error('Payment configuration creation failed:', error);
    throw error;
  }
}