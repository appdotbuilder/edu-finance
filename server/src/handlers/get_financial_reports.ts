import { db } from '../db';
import { 
  transactionsTable, 
  accountsTable, 
  fundPositionsTable, 
  studentPaymentsTable, 
  studentsTable, 
  paymentConfigsTable 
} from '../db/schema';
import { eq, and, gte, lte, ne, sql } from 'drizzle-orm';

interface DailyReport {
  date: string;
  total_income: number;
  total_expense: number;
  net_cashflow: number;
  transactions_count: number;
}

interface MonthlyReport {
  month: string;
  year: number;
  total_income: number;
  total_expense: number;
  net_cashflow: number;
  payment_collections: Record<string, number>;
}

interface OutstandingPaymentReport {
  student_id: number;
  student_name: string;
  nis: string;
  grade: string;
  class_name: string;
  outstanding_payments: Array<{
    payment_type: string;
    amount_due: number;
    amount_paid: number;
    amount_remaining: number;
    due_date: string | null;
  }>;
  total_outstanding: number;
}

interface CashPositionReport {
  accounts: Array<{
    account_name: string;
    account_type: string;
    balance: number;
  }>;
  fund_positions: Array<{
    fund_name: string;
    balance: number;
  }>;
  total_cash_position: number;
}

export async function getDailyReport(date: string): Promise<DailyReport> {
  try {
    const targetDate = new Date(date);
    const nextDay = new Date(targetDate);
    nextDay.setDate(nextDay.getDate() + 1);

    // Query transactions for the specific date
    const transactions = await db.select()
      .from(transactionsTable)
      .where(
        and(
          gte(transactionsTable.created_at, targetDate),
          lte(transactionsTable.created_at, nextDay)
        )
      )
      .execute();

    let total_income = 0;
    let total_expense = 0;

    for (const transaction of transactions) {
      const amount = parseFloat(transaction.amount);
      
      if (transaction.type === 'INCOME') {
        total_income += amount;
      } else if (transaction.type === 'EXPENSE') {
        total_expense += amount;
      }
    }

    return {
      date,
      total_income,
      total_expense,
      net_cashflow: total_income - total_expense,
      transactions_count: transactions.length
    };
  } catch (error) {
    console.error('Daily report generation failed:', error);
    throw error;
  }
}

export async function getMonthlyReport(month: number, year: number): Promise<MonthlyReport> {
  try {
    // Create date range for the month
    const startDate = new Date(year, month - 1, 1); // month is 0-indexed in Date constructor
    const endDate = new Date(year, month, 0, 23, 59, 59); // Last day of month

    // Query transactions for the month
    const transactions = await db.select({
      transaction: transactionsTable,
      paymentConfig: paymentConfigsTable
    })
      .from(transactionsTable)
      .leftJoin(
        studentPaymentsTable,
        eq(transactionsTable.student_payment_id, studentPaymentsTable.id)
      )
      .leftJoin(
        paymentConfigsTable,
        eq(studentPaymentsTable.payment_config_id, paymentConfigsTable.id)
      )
      .where(
        and(
          gte(transactionsTable.created_at, startDate),
          lte(transactionsTable.created_at, endDate)
        )
      )
      .execute();

    let total_income = 0;
    let total_expense = 0;
    const payment_collections: Record<string, number> = {};

    for (const result of transactions) {
      const amount = parseFloat(result.transaction.amount);
      
      if (result.transaction.type === 'INCOME') {
        total_income += amount;
        
        // Track payment collections by type
        if (result.paymentConfig?.payment_type) {
          const paymentType = result.paymentConfig.payment_type;
          payment_collections[paymentType] = (payment_collections[paymentType] || 0) + amount;
        }
      } else if (result.transaction.type === 'EXPENSE') {
        total_expense += amount;
      }
    }

    return {
      month: `${year}-${month.toString().padStart(2, '0')}`,
      year,
      total_income,
      total_expense,
      net_cashflow: total_income - total_expense,
      payment_collections
    };
  } catch (error) {
    console.error('Monthly report generation failed:', error);
    throw error;
  }
}

export async function getOutstandingPayments(grade?: string, className?: string): Promise<OutstandingPaymentReport[]> {
  try {
    // Build query conditions
    const conditions: any[] = [
      ne(studentPaymentsTable.status, 'PAID')
    ];

    if (grade) {
      conditions.push(eq(studentsTable.grade, grade as any));
    }

    if (className) {
      conditions.push(eq(studentsTable.class_name, className));
    }

    // Query outstanding payments with student and payment config details
    const results = await db.select({
      studentPayment: studentPaymentsTable,
      student: studentsTable,
      paymentConfig: paymentConfigsTable
    })
      .from(studentPaymentsTable)
      .innerJoin(studentsTable, eq(studentPaymentsTable.student_id, studentsTable.id))
      .innerJoin(paymentConfigsTable, eq(studentPaymentsTable.payment_config_id, paymentConfigsTable.id))
      .where(conditions.length === 1 ? conditions[0] : and(...conditions))
      .execute();

    // Group by student
    const studentMap = new Map<number, OutstandingPaymentReport>();

    for (const result of results) {
      const studentId = result.student.id;
      
      if (!studentMap.has(studentId)) {
        studentMap.set(studentId, {
          student_id: studentId,
          student_name: result.student.name,
          nis: result.student.nis,
          grade: result.student.grade,
          class_name: result.student.class_name,
          outstanding_payments: [],
          total_outstanding: 0
        });
      }

      const studentReport = studentMap.get(studentId)!;
      const amountRemaining = parseFloat(result.studentPayment.amount_remaining);

      studentReport.outstanding_payments.push({
        payment_type: result.paymentConfig.payment_type,
        amount_due: parseFloat(result.studentPayment.amount_due),
        amount_paid: parseFloat(result.studentPayment.amount_paid),
        amount_remaining: amountRemaining,
        due_date: result.studentPayment.due_date?.toISOString().split('T')[0] || null
      });

      studentReport.total_outstanding += amountRemaining;
    }

    return Array.from(studentMap.values());
  } catch (error) {
    console.error('Outstanding payments report generation failed:', error);
    throw error;
  }
}

export async function getCashPositionReport(): Promise<CashPositionReport> {
  try {
    // Query all active accounts
    const accounts = await db.select()
      .from(accountsTable)
      .where(eq(accountsTable.is_active, true))
      .execute();

    // Query all fund positions
    const fundPositions = await db.select()
      .from(fundPositionsTable)
      .execute();

    let total_cash_position = 0;

    // Process accounts
    const accountsData = accounts.map(account => {
      const balance = parseFloat(account.balance);
      total_cash_position += balance;
      
      return {
        account_name: account.name,
        account_type: account.type,
        balance
      };
    });

    // Process fund positions
    const fundPositionsData = fundPositions.map(fund => {
      const balance = parseFloat(fund.balance);
      
      return {
        fund_name: fund.name,
        balance
      };
    });

    return {
      accounts: accountsData,
      fund_positions: fundPositionsData,
      total_cash_position
    };
  } catch (error) {
    console.error('Cash position report generation failed:', error);
    throw error;
  }
}