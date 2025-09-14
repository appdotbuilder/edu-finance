import { db } from '../db';
import { transactionsTable, accountsTable, fundPositionsTable, studentPaymentsTable } from '../db/schema';
import { type CreateTransactionInput, type Transaction } from '../schema';
import { eq } from 'drizzle-orm';

export async function createTransaction(input: CreateTransactionInput): Promise<Transaction> {
  try {
    // Validate that the account exists
    const account = await db.select()
      .from(accountsTable)
      .where(eq(accountsTable.id, input.account_id))
      .execute();

    if (account.length === 0) {
      throw new Error(`Account with ID ${input.account_id} not found`);
    }

    // If fund_position_id is provided, validate it exists
    if (input.fund_position_id) {
      const fundPosition = await db.select()
        .from(fundPositionsTable)
        .where(eq(fundPositionsTable.id, input.fund_position_id))
        .execute();

      if (fundPosition.length === 0) {
        throw new Error(`Fund position with ID ${input.fund_position_id} not found`);
      }
    }

    // If student_payment_id is provided, validate it exists
    if (input.student_payment_id) {
      const studentPayment = await db.select()
        .from(studentPaymentsTable)
        .where(eq(studentPaymentsTable.id, input.student_payment_id))
        .execute();

      if (studentPayment.length === 0) {
        throw new Error(`Student payment with ID ${input.student_payment_id} not found`);
      }
    }

    // Insert the transaction
    const result = await db.insert(transactionsTable)
      .values({
        type: input.type,
        amount: input.amount.toString(), // Convert number to string for numeric column
        description: input.description,
        reference_number: input.reference_number || null,
        account_id: input.account_id,
        fund_position_id: input.fund_position_id || null,
        student_payment_id: input.student_payment_id || null,
        created_by: input.created_by
      })
      .returning()
      .execute();

    const transaction = result[0];

    // Update account balance based on transaction type
    const amountChange = input.type === 'EXPENSE' ? -input.amount : input.amount;
    await db.update(accountsTable)
      .set({
        balance: `${parseFloat(account[0].balance) + amountChange}` // Convert to string for numeric column
      })
      .where(eq(accountsTable.id, input.account_id))
      .execute();

    // Update fund position balance if specified
    if (input.fund_position_id) {
      const fundPosition = await db.select()
        .from(fundPositionsTable)
        .where(eq(fundPositionsTable.id, input.fund_position_id))
        .execute();

      const fundAmountChange = input.type === 'EXPENSE' ? -input.amount : input.amount;
      await db.update(fundPositionsTable)
        .set({
          balance: `${parseFloat(fundPosition[0].balance) + fundAmountChange}` // Convert to string for numeric column
        })
        .where(eq(fundPositionsTable.id, input.fund_position_id))
        .execute();
    }

    // Convert numeric fields back to numbers before returning
    return {
      ...transaction,
      amount: parseFloat(transaction.amount) // Convert string back to number
    };
  } catch (error) {
    console.error('Transaction creation failed:', error);
    throw error;
  }
}