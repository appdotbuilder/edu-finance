import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { 
  studentsTable, 
  accountsTable, 
  fundPositionsTable, 
  transactionsTable,
  paymentConfigsTable,
  studentPaymentsTable
} from '../db/schema';
import {
  getDailyReport,
  getMonthlyReport,
  getOutstandingPayments,
  getCashPositionReport
} from '../handlers/get_financial_reports';

describe('Financial Reports', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  describe('getDailyReport', () => {
    it('should generate daily report with income and expense transactions', async () => {
      // Create account
      const [account] = await db.insert(accountsTable)
        .values({
          name: 'Main Cash',
          type: 'CASH',
          balance: '1000000.00'
        })
        .returning()
        .execute();

      // Create transactions for specific date
      const targetDate = '2024-01-15';
      const transactionDate = new Date(targetDate);

      await db.insert(transactionsTable)
        .values([
          {
            type: 'INCOME',
            amount: '500000.00',
            description: 'SPP Payment',
            account_id: account.id,
            created_by: 'admin',
            created_at: transactionDate
          },
          {
            type: 'INCOME',
            amount: '200000.00',
            description: 'Registration Fee',
            account_id: account.id,
            created_by: 'admin',
            created_at: transactionDate
          },
          {
            type: 'EXPENSE',
            amount: '150000.00',
            description: 'Office Supplies',
            account_id: account.id,
            created_by: 'admin',
            created_at: transactionDate
          }
        ])
        .execute();

      const result = await getDailyReport(targetDate);

      expect(result.date).toEqual(targetDate);
      expect(result.total_income).toEqual(700000);
      expect(result.total_expense).toEqual(150000);
      expect(result.net_cashflow).toEqual(550000);
      expect(result.transactions_count).toEqual(3);
    });

    it('should return zero values for date with no transactions', async () => {
      const result = await getDailyReport('2024-01-15');

      expect(result.date).toEqual('2024-01-15');
      expect(result.total_income).toEqual(0);
      expect(result.total_expense).toEqual(0);
      expect(result.net_cashflow).toEqual(0);
      expect(result.transactions_count).toEqual(0);
    });
  });

  describe('getMonthlyReport', () => {
    it('should generate monthly report with payment collections breakdown', async () => {
      // Create prerequisites
      const [student] = await db.insert(studentsTable)
        .values({
          nis: '12345',
          name: 'Test Student',
          grade: 'SMA',
          class_name: 'X-1',
          status: 'ACTIVE'
        })
        .returning()
        .execute();

      const [account] = await db.insert(accountsTable)
        .values({
          name: 'Main Cash',
          type: 'CASH',
          balance: '1000000.00'
        })
        .returning()
        .execute();

      const [paymentConfig] = await db.insert(paymentConfigsTable)
        .values({
          payment_type: 'SPP',
          name: 'SPP January',
          amount: '500000.00',
          is_active: true,
          can_installment: false
        })
        .returning()
        .execute();

      const [studentPayment] = await db.insert(studentPaymentsTable)
        .values({
          student_id: student.id,
          payment_config_id: paymentConfig.id,
          amount_due: '500000.00',
          amount_remaining: '500000.00'
        })
        .returning()
        .execute();

      // Create transactions for January 2024
      const januaryDate = new Date('2024-01-15');
      
      await db.insert(transactionsTable)
        .values([
          {
            type: 'INCOME',
            amount: '500000.00',
            description: 'SPP Payment',
            account_id: account.id,
            student_payment_id: studentPayment.id,
            created_by: 'admin',
            created_at: januaryDate
          },
          {
            type: 'EXPENSE',
            amount: '100000.00',
            description: 'Office Rent',
            account_id: account.id,
            created_by: 'admin',
            created_at: januaryDate
          }
        ])
        .execute();

      const result = await getMonthlyReport(1, 2024);

      expect(result.month).toEqual('2024-01');
      expect(result.year).toEqual(2024);
      expect(result.total_income).toEqual(500000);
      expect(result.total_expense).toEqual(100000);
      expect(result.net_cashflow).toEqual(400000);
      expect(result.payment_collections).toHaveProperty('SPP', 500000);
    });

    it('should return zero values for month with no transactions', async () => {
      const result = await getMonthlyReport(1, 2024);

      expect(result.month).toEqual('2024-01');
      expect(result.year).toEqual(2024);
      expect(result.total_income).toEqual(0);
      expect(result.total_expense).toEqual(0);
      expect(result.net_cashflow).toEqual(0);
      expect(result.payment_collections).toEqual({});
    });
  });

  describe('getOutstandingPayments', () => {
    it('should return outstanding payments for all students', async () => {
      // Create student
      const [student] = await db.insert(studentsTable)
        .values({
          nis: '12345',
          name: 'Test Student',
          grade: 'SMA',
          class_name: 'X-1',
          status: 'ACTIVE'
        })
        .returning()
        .execute();

      // Create payment config
      const [paymentConfig] = await db.insert(paymentConfigsTable)
        .values({
          payment_type: 'SPP',
          name: 'SPP January',
          amount: '500000.00',
          is_active: true,
          can_installment: false
        })
        .returning()
        .execute();

      // Create outstanding student payment
      await db.insert(studentPaymentsTable)
        .values({
          student_id: student.id,
          payment_config_id: paymentConfig.id,
          amount_due: '500000.00',
          amount_paid: '200000.00',
          amount_remaining: '300000.00',
          status: 'PARTIAL',
          due_date: new Date('2024-01-31')
        })
        .execute();

      const results = await getOutstandingPayments();

      expect(results).toHaveLength(1);
      
      const report = results[0];
      expect(report.student_name).toEqual('Test Student');
      expect(report.nis).toEqual('12345');
      expect(report.grade).toEqual('SMA');
      expect(report.class_name).toEqual('X-1');
      expect(report.total_outstanding).toEqual(300000);
      expect(report.outstanding_payments).toHaveLength(1);
      
      const payment = report.outstanding_payments[0];
      expect(payment.payment_type).toEqual('SPP');
      expect(payment.amount_due).toEqual(500000);
      expect(payment.amount_paid).toEqual(200000);
      expect(payment.amount_remaining).toEqual(300000);
      expect(payment.due_date).toEqual('2024-01-31');
    });

    it('should filter outstanding payments by grade', async () => {
      // Create students with different grades
      const [studentSMA] = await db.insert(studentsTable)
        .values({
          nis: '12345',
          name: 'SMA Student',
          grade: 'SMA',
          class_name: 'X-1',
          status: 'ACTIVE'
        })
        .returning()
        .execute();

      const [studentSMP] = await db.insert(studentsTable)
        .values({
          nis: '12346',
          name: 'SMP Student',
          grade: 'SMP',
          class_name: 'VII-1',
          status: 'ACTIVE'
        })
        .returning()
        .execute();

      const [paymentConfig] = await db.insert(paymentConfigsTable)
        .values({
          payment_type: 'SPP',
          name: 'SPP January',
          amount: '500000.00',
          is_active: true,
          can_installment: false
        })
        .returning()
        .execute();

      // Create outstanding payments for both students
      await db.insert(studentPaymentsTable)
        .values([
          {
            student_id: studentSMA.id,
            payment_config_id: paymentConfig.id,
            amount_due: '500000.00',
            amount_remaining: '500000.00',
            status: 'PENDING'
          },
          {
            student_id: studentSMP.id,
            payment_config_id: paymentConfig.id,
            amount_due: '400000.00',
            amount_remaining: '400000.00',
            status: 'PENDING'
          }
        ])
        .execute();

      const results = await getOutstandingPayments('SMA');

      expect(results).toHaveLength(1);
      expect(results[0].student_name).toEqual('SMA Student');
      expect(results[0].grade).toEqual('SMA');
    });

    it('should exclude fully paid payments', async () => {
      // Create student
      const [student] = await db.insert(studentsTable)
        .values({
          nis: '12345',
          name: 'Test Student',
          grade: 'SMA',
          class_name: 'X-1',
          status: 'ACTIVE'
        })
        .returning()
        .execute();

      const [paymentConfig] = await db.insert(paymentConfigsTable)
        .values({
          payment_type: 'SPP',
          name: 'SPP January',
          amount: '500000.00',
          is_active: true,
          can_installment: false
        })
        .returning()
        .execute();

      // Create fully paid student payment
      await db.insert(studentPaymentsTable)
        .values({
          student_id: student.id,
          payment_config_id: paymentConfig.id,
          amount_due: '500000.00',
          amount_paid: '500000.00',
          amount_remaining: '0.00',
          status: 'PAID'
        })
        .execute();

      const results = await getOutstandingPayments();

      expect(results).toHaveLength(0);
    });
  });

  describe('getCashPositionReport', () => {
    it('should return cash position with accounts and fund positions', async () => {
      // Create accounts
      await db.insert(accountsTable)
        .values([
          {
            name: 'Main Cash',
            type: 'CASH',
            balance: '5000000.00',
            is_active: true
          },
          {
            name: 'Bank BCA',
            type: 'BANK',
            bank_name: 'BCA',
            account_number: '1234567890',
            balance: '10000000.00',
            is_active: true
          },
          {
            name: 'Inactive Account',
            type: 'CASH',
            balance: '1000000.00',
            is_active: false
          }
        ])
        .execute();

      // Create fund positions
      await db.insert(fundPositionsTable)
        .values([
          {
            name: 'Education Fund',
            description: 'Funds for educational activities',
            balance: '3000000.00'
          },
          {
            name: 'Maintenance Fund',
            description: 'Funds for facility maintenance',
            balance: '2000000.00'
          }
        ])
        .execute();

      const result = await getCashPositionReport();

      expect(result.accounts).toHaveLength(2); // Only active accounts
      expect(result.fund_positions).toHaveLength(2);
      expect(result.total_cash_position).toEqual(15000000); // 5M + 10M (only active accounts)

      // Check account details
      const cashAccount = result.accounts.find(a => a.account_name === 'Main Cash');
      expect(cashAccount).toBeDefined();
      expect(cashAccount?.account_type).toEqual('CASH');
      expect(cashAccount?.balance).toEqual(5000000);

      const bankAccount = result.accounts.find(a => a.account_name === 'Bank BCA');
      expect(bankAccount).toBeDefined();
      expect(bankAccount?.account_type).toEqual('BANK');
      expect(bankAccount?.balance).toEqual(10000000);

      // Check fund position details
      const educationFund = result.fund_positions.find(f => f.fund_name === 'Education Fund');
      expect(educationFund).toBeDefined();
      expect(educationFund?.balance).toEqual(3000000);
    });

    it('should return empty report when no accounts or fund positions exist', async () => {
      const result = await getCashPositionReport();

      expect(result.accounts).toHaveLength(0);
      expect(result.fund_positions).toHaveLength(0);
      expect(result.total_cash_position).toEqual(0);
    });
  });
});