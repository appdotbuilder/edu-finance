import { db } from '../db';
import { studentsTable, sppCardsTable, studentPaymentsTable, paymentConfigsTable } from '../db/schema';
import { type Student } from '../schema';
import { eq, and } from 'drizzle-orm';

interface BarcodeStudentData extends Student {
  paymentHistory: Array<{
    id: number;
    payment_type: string;
    amount_due: number;
    amount_paid: number;
    amount_remaining: number;
    status: string;
  }>;
}

export async function scanBarcode(barcode: string): Promise<BarcodeStudentData | null> {
  try {
    // First, find the SPP card with the given barcode
    const sppCards = await db.select()
      .from(sppCardsTable)
      .where(and(
        eq(sppCardsTable.barcode, barcode),
        eq(sppCardsTable.is_active, true)
      ))
      .execute();

    if (sppCards.length === 0) {
      return null; // Barcode not found or inactive
    }

    const sppCard = sppCards[0];

    // Get student information
    const students = await db.select()
      .from(studentsTable)
      .where(eq(studentsTable.id, sppCard.student_id))
      .execute();

    if (students.length === 0) {
      return null; // Student not found
    }

    const student = students[0];

    // Get student's payment history with payment config details
    const paymentHistoryResults = await db.select({
      id: studentPaymentsTable.id,
      payment_type: paymentConfigsTable.payment_type,
      amount_due: studentPaymentsTable.amount_due,
      amount_paid: studentPaymentsTable.amount_paid,
      amount_remaining: studentPaymentsTable.amount_remaining,
      status: studentPaymentsTable.status
    })
      .from(studentPaymentsTable)
      .innerJoin(paymentConfigsTable, eq(studentPaymentsTable.payment_config_id, paymentConfigsTable.id))
      .where(eq(studentPaymentsTable.student_id, student.id))
      .execute();

    // Convert numeric fields and format payment history
    const paymentHistory = paymentHistoryResults.map(payment => ({
      id: payment.id,
      payment_type: payment.payment_type,
      amount_due: parseFloat(payment.amount_due),
      amount_paid: parseFloat(payment.amount_paid),
      amount_remaining: parseFloat(payment.amount_remaining),
      status: payment.status
    }));

    // Return student data with payment history
    const barcodeStudentData: BarcodeStudentData = {
      ...student,
      paymentHistory
    };

    return barcodeStudentData;
  } catch (error) {
    console.error('Barcode scanning failed:', error);
    throw error;
  }
}