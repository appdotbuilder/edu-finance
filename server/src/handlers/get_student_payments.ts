import { db } from '../db';
import { studentPaymentsTable, studentsTable, paymentConfigsTable } from '../db/schema';
import { type GetStudentPaymentsQuery, type StudentPayment } from '../schema';
import { eq, and, type SQL } from 'drizzle-orm';

export const getStudentPayments = async (query: GetStudentPaymentsQuery = {}): Promise<StudentPayment[]> => {
  try {
    // Build conditions array
    const conditions: SQL<unknown>[] = [];

    // Basic filters that don't require joins
    if (query.student_id !== undefined) {
      conditions.push(eq(studentPaymentsTable.student_id, query.student_id));
    }

    if (query.status) {
      conditions.push(eq(studentPaymentsTable.status, query.status));
    }

    // Check if we need joins for filtering
    const needsStudentJoin = query.grade || query.class_name;
    const needsPaymentConfigJoin = query.payment_type;

    if (needsStudentJoin && needsPaymentConfigJoin) {
      // Both joins needed
      if (query.grade) {
        conditions.push(eq(studentsTable.grade, query.grade));
      }
      if (query.class_name) {
        conditions.push(eq(studentsTable.class_name, query.class_name));
      }
      if (query.payment_type) {
        conditions.push(eq(paymentConfigsTable.payment_type, query.payment_type));
      }

      const queryWithBothJoins = db.select({
        id: studentPaymentsTable.id,
        student_id: studentPaymentsTable.student_id,
        payment_config_id: studentPaymentsTable.payment_config_id,
        amount_due: studentPaymentsTable.amount_due,
        amount_paid: studentPaymentsTable.amount_paid,
        amount_remaining: studentPaymentsTable.amount_remaining,
        due_date: studentPaymentsTable.due_date,
        status: studentPaymentsTable.status,
        created_at: studentPaymentsTable.created_at,
        updated_at: studentPaymentsTable.updated_at,
      })
      .from(studentPaymentsTable)
      .innerJoin(studentsTable, eq(studentPaymentsTable.student_id, studentsTable.id))
      .innerJoin(paymentConfigsTable, eq(studentPaymentsTable.payment_config_id, paymentConfigsTable.id));

      const finalQuery = conditions.length > 0
        ? queryWithBothJoins.where(conditions.length === 1 ? conditions[0] : and(...conditions))
        : queryWithBothJoins;

      const results = await finalQuery.execute();
      return results.map(result => ({
        id: result.id,
        student_id: result.student_id,
        payment_config_id: result.payment_config_id,
        amount_due: parseFloat(result.amount_due),
        amount_paid: parseFloat(result.amount_paid),
        amount_remaining: parseFloat(result.amount_remaining),
        due_date: result.due_date,
        status: result.status,
        created_at: result.created_at,
        updated_at: result.updated_at,
      }));
    } else if (needsStudentJoin) {
      // Only student join needed
      if (query.grade) {
        conditions.push(eq(studentsTable.grade, query.grade));
      }
      if (query.class_name) {
        conditions.push(eq(studentsTable.class_name, query.class_name));
      }

      const queryWithStudentJoin = db.select({
        id: studentPaymentsTable.id,
        student_id: studentPaymentsTable.student_id,
        payment_config_id: studentPaymentsTable.payment_config_id,
        amount_due: studentPaymentsTable.amount_due,
        amount_paid: studentPaymentsTable.amount_paid,
        amount_remaining: studentPaymentsTable.amount_remaining,
        due_date: studentPaymentsTable.due_date,
        status: studentPaymentsTable.status,
        created_at: studentPaymentsTable.created_at,
        updated_at: studentPaymentsTable.updated_at,
      })
      .from(studentPaymentsTable)
      .innerJoin(studentsTable, eq(studentPaymentsTable.student_id, studentsTable.id));

      const finalQuery = conditions.length > 0
        ? queryWithStudentJoin.where(conditions.length === 1 ? conditions[0] : and(...conditions))
        : queryWithStudentJoin;

      const results = await finalQuery.execute();
      return results.map(result => ({
        id: result.id,
        student_id: result.student_id,
        payment_config_id: result.payment_config_id,
        amount_due: parseFloat(result.amount_due),
        amount_paid: parseFloat(result.amount_paid),
        amount_remaining: parseFloat(result.amount_remaining),
        due_date: result.due_date,
        status: result.status,
        created_at: result.created_at,
        updated_at: result.updated_at,
      }));
    } else if (needsPaymentConfigJoin) {
      // Only payment config join needed
      if (query.payment_type) {
        conditions.push(eq(paymentConfigsTable.payment_type, query.payment_type));
      }

      const queryWithConfigJoin = db.select({
        id: studentPaymentsTable.id,
        student_id: studentPaymentsTable.student_id,
        payment_config_id: studentPaymentsTable.payment_config_id,
        amount_due: studentPaymentsTable.amount_due,
        amount_paid: studentPaymentsTable.amount_paid,
        amount_remaining: studentPaymentsTable.amount_remaining,
        due_date: studentPaymentsTable.due_date,
        status: studentPaymentsTable.status,
        created_at: studentPaymentsTable.created_at,
        updated_at: studentPaymentsTable.updated_at,
      })
      .from(studentPaymentsTable)
      .innerJoin(paymentConfigsTable, eq(studentPaymentsTable.payment_config_id, paymentConfigsTable.id));

      const finalQuery = conditions.length > 0
        ? queryWithConfigJoin.where(conditions.length === 1 ? conditions[0] : and(...conditions))
        : queryWithConfigJoin;

      const results = await finalQuery.execute();
      return results.map(result => ({
        id: result.id,
        student_id: result.student_id,
        payment_config_id: result.payment_config_id,
        amount_due: parseFloat(result.amount_due),
        amount_paid: parseFloat(result.amount_paid),
        amount_remaining: parseFloat(result.amount_remaining),
        due_date: result.due_date,
        status: result.status,
        created_at: result.created_at,
        updated_at: result.updated_at,
      }));
    } else {
      // No joins needed - simple query
      const baseQuery = db.select().from(studentPaymentsTable);
      
      const finalQuery = conditions.length > 0
        ? baseQuery.where(conditions.length === 1 ? conditions[0] : and(...conditions))
        : baseQuery;

      const results = await finalQuery.execute();

      return results.map(result => ({
        ...result,
        amount_due: parseFloat(result.amount_due),
        amount_paid: parseFloat(result.amount_paid),
        amount_remaining: parseFloat(result.amount_remaining),
      }));
    }
  } catch (error) {
    console.error('Failed to get student payments:', error);
    throw error;
  }
};