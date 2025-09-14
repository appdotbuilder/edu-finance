import { db } from '../db';
import { 
  transactionsTable, 
  studentPaymentsTable, 
  accountsTable 
} from '../db/schema';
import { type ProcessPaymentInput, type Transaction } from '../schema';
import { eq } from 'drizzle-orm';

export async function processPayment(input: ProcessPaymentInput): Promise<Transaction> {
  try {
    // Start a database transaction
    const result = await db.transaction(async (tx) => {
      // 1. Verify student payment exists
      const studentPayments = await tx.select()
        .from(studentPaymentsTable)
        .where(eq(studentPaymentsTable.id, input.student_payment_id))
        .execute();

      if (studentPayments.length === 0) {
        throw new Error(`Student payment with ID ${input.student_payment_id} not found`);
      }

      const studentPayment = studentPayments[0];
      const currentRemaining = parseFloat(studentPayment.amount_remaining);

      // 2. Verify payment amount doesn't exceed remaining amount
      if (input.amount > currentRemaining) {
        throw new Error(`Payment amount ${input.amount} exceeds remaining amount ${currentRemaining}`);
      }

      // 3. Verify account exists
      const accounts = await tx.select()
        .from(accountsTable)
        .where(eq(accountsTable.id, input.account_id))
        .execute();

      if (accounts.length === 0) {
        throw new Error(`Account with ID ${input.account_id} not found`);
      }

      // 4. Calculate new payment amounts
      const currentPaid = parseFloat(studentPayment.amount_paid);
      const newAmountPaid = currentPaid + input.amount;
      const newAmountRemaining = currentRemaining - input.amount;

      // 5. Determine new payment status
      let newStatus: 'PENDING' | 'PARTIAL' | 'PAID';
      if (newAmountRemaining === 0) {
        newStatus = 'PAID';
      } else if (newAmountPaid > 0) {
        newStatus = 'PARTIAL';
      } else {
        newStatus = 'PENDING';
      }

      // 6. Update student payment record
      await tx.update(studentPaymentsTable)
        .set({
          amount_paid: newAmountPaid.toString(),
          amount_remaining: newAmountRemaining.toString(),
          status: newStatus,
          updated_at: new Date()
        })
        .where(eq(studentPaymentsTable.id, input.student_payment_id))
        .execute();

      // 7. Update account balance (increase for INCOME)
      const currentBalance = parseFloat(accounts[0].balance);
      const newBalance = currentBalance + input.amount;

      await tx.update(accountsTable)
        .set({
          balance: newBalance.toString(),
          updated_at: new Date()
        })
        .where(eq(accountsTable.id, input.account_id))
        .execute();

      // 8. Create transaction record
      const transactionResult = await tx.insert(transactionsTable)
        .values({
          type: 'INCOME',
          amount: input.amount.toString(),
          description: `Payment for student payment ID: ${input.student_payment_id}`,
          reference_number: input.reference_number || null,
          account_id: input.account_id,
          fund_position_id: null,
          student_payment_id: input.student_payment_id,
          created_by: input.created_by
        })
        .returning()
        .execute();

      const transaction = transactionResult[0];

      return {
        ...transaction,
        amount: parseFloat(transaction.amount)
      };
    });

    return result;
  } catch (error) {
    console.error('Payment processing failed:', error);
    throw error;
  }
}