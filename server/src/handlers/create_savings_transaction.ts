import { db } from '../db';
import { savingsTable, savingsTransactionsTable, studentsTable } from '../db/schema';
import { type CreateSavingsTransactionInput, type SavingsTransaction } from '../schema';
import { eq } from 'drizzle-orm';

export const createSavingsTransaction = async (input: CreateSavingsTransactionInput): Promise<SavingsTransaction> => {
  try {
    // First, verify that the student exists
    const student = await db.select()
      .from(studentsTable)
      .where(eq(studentsTable.id, input.student_id))
      .execute();
    
    if (student.length === 0) {
      throw new Error(`Student with ID ${input.student_id} not found`);
    }

    // Find or create savings account for the student
    let savingsAccount = await db.select()
      .from(savingsTable)
      .where(eq(savingsTable.student_id, input.student_id))
      .execute();

    if (savingsAccount.length === 0) {
      // Create new savings account if it doesn't exist
      const newSavingsAccount = await db.insert(savingsTable)
        .values({
          student_id: input.student_id,
          balance: '0' // Default balance as string for numeric column
        })
        .returning()
        .execute();
      
      savingsAccount = newSavingsAccount;
    }

    const currentAccount = savingsAccount[0];
    const currentBalance = parseFloat(currentAccount.balance);
    let newBalance: number;

    // Calculate new balance based on transaction type
    if (input.type === 'DEPOSIT') {
      newBalance = currentBalance + input.amount;
    } else { // WITHDRAWAL
      if (currentBalance < input.amount) {
        throw new Error('Insufficient balance for withdrawal');
      }
      newBalance = currentBalance - input.amount;
    }

    // Start transaction to ensure data consistency
    const result = await db.transaction(async (tx) => {
      // Update savings balance
      await tx.update(savingsTable)
        .set({ 
          balance: newBalance.toString(),
          updated_at: new Date()
        })
        .where(eq(savingsTable.id, currentAccount.id))
        .execute();

      // Create savings transaction record
      const transactionResult = await tx.insert(savingsTransactionsTable)
        .values({
          savings_id: currentAccount.id,
          type: input.type,
          amount: input.amount.toString(), // Convert number to string for numeric column
          description: input.description || null,
          created_by: input.created_by
        })
        .returning()
        .execute();

      return transactionResult[0];
    });

    // Return the transaction with proper numeric conversion
    return {
      ...result,
      amount: parseFloat(result.amount) // Convert string back to number
    };
  } catch (error) {
    console.error('Savings transaction creation failed:', error);
    throw error;
  }
};