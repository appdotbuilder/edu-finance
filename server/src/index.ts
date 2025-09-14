import { initTRPC } from '@trpc/server';
import { createHTTPServer } from '@trpc/server/adapters/standalone';
import 'dotenv/config';
import cors from 'cors';
import superjson from 'superjson';
import { z } from 'zod';

// Import schemas
import {
  createUserInputSchema,
  createStudentInputSchema,
  createPaymentTypeConfigInputSchema,
  createStudentPaymentAssignmentInputSchema,
  createPaymentTransactionInputSchema,
  createAccountInputSchema,
  createFundSourceInputSchema,
  createTransactionInputSchema,
  createStudentSavingsInputSchema,
  createWhatsappNotificationInputSchema,
  reportRequestSchema
} from './schema';

// Import handlers
import { createUser } from './handlers/create_user';
import { getUsers } from './handlers/get_users';
import { createStudent } from './handlers/create_student';
import { getStudents, getStudentByBarcode } from './handlers/get_students';
import { createPaymentTypeConfig } from './handlers/create_payment_type_config';
import { getPaymentTypeConfigs } from './handlers/get_payment_type_configs';
import { createStudentPaymentAssignment } from './handlers/create_student_payment_assignment';
import { createPaymentTransaction, processPaymentByBarcode } from './handlers/create_payment_transaction';
import { getPaymentTransactions, getStudentPaymentHistory } from './handlers/get_payment_transactions';
import { createAccount } from './handlers/create_account';
import { getAccounts, getAccountBalance } from './handlers/get_accounts';
import { createFundSource } from './handlers/create_fund_source';
import { getFundSources } from './handlers/get_fund_sources';
import { createTransaction, createTransfer } from './handlers/create_transaction';
import { getTransactions } from './handlers/get_transactions';
import { createStudentSavings } from './handlers/create_student_savings';
import { getStudentSavings, getStudentSavingsBalance } from './handlers/get_student_savings';
import { createWhatsappNotification, sendPaymentNotification, sendPaymentReminderNotification } from './handlers/create_whatsapp_notification';
import { getWhatsappNotifications, getPendingWhatsappNotifications } from './handlers/get_whatsapp_notifications';
import { generateReport, generateDailyIncomeReport, generateMonthlyRecapReport } from './handlers/generate_reports';
import { generateSppCard, generateBarcodeForStudent, printReceipt } from './handlers/generate_spp_card';

const t = initTRPC.create({
  transformer: superjson,
});

const publicProcedure = t.procedure;
const router = t.router;

const appRouter = router({
  // Health check
  healthcheck: publicProcedure.query(() => {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }),

  // User management
  createUser: publicProcedure
    .input(createUserInputSchema)
    .mutation(({ input }) => createUser(input)),
  getUsers: publicProcedure
    .query(() => getUsers()),

  // Student management
  createStudent: publicProcedure
    .input(createStudentInputSchema)
    .mutation(({ input }) => createStudent(input)),
  getStudents: publicProcedure
    .query(() => getStudents()),
  getStudentByBarcode: publicProcedure
    .input(z.object({ barcode: z.string() }))
    .query(({ input }) => getStudentByBarcode(input.barcode)),

  // Payment type configuration
  createPaymentTypeConfig: publicProcedure
    .input(createPaymentTypeConfigInputSchema)
    .mutation(({ input }) => createPaymentTypeConfig(input)),
  getPaymentTypeConfigs: publicProcedure
    .query(() => getPaymentTypeConfigs()),

  // Student payment assignments
  createStudentPaymentAssignment: publicProcedure
    .input(createStudentPaymentAssignmentInputSchema)
    .mutation(({ input }) => createStudentPaymentAssignment(input)),

  // Payment transactions
  createPaymentTransaction: publicProcedure
    .input(createPaymentTransactionInputSchema)
    .mutation(({ input }) => createPaymentTransaction(input)),
  processPaymentByBarcode: publicProcedure
    .input(z.object({
      barcode: z.string(),
      paymentData: createPaymentTransactionInputSchema.omit({ student_id: true })
    }))
    .mutation(({ input }) => processPaymentByBarcode(input.barcode, input.paymentData)),
  getPaymentTransactions: publicProcedure
    .query(() => getPaymentTransactions()),
  getStudentPaymentHistory: publicProcedure
    .input(z.object({ studentId: z.number() }))
    .query(({ input }) => getStudentPaymentHistory(input.studentId)),

  // Account management
  createAccount: publicProcedure
    .input(createAccountInputSchema)
    .mutation(({ input }) => createAccount(input)),
  getAccounts: publicProcedure
    .query(() => getAccounts()),
  getAccountBalance: publicProcedure
    .input(z.object({ accountId: z.number() }))
    .query(({ input }) => getAccountBalance(input.accountId)),

  // Fund source management
  createFundSource: publicProcedure
    .input(createFundSourceInputSchema)
    .mutation(({ input }) => createFundSource(input)),
  getFundSources: publicProcedure
    .query(() => getFundSources()),

  // General transactions
  createTransaction: publicProcedure
    .input(createTransactionInputSchema)
    .mutation(({ input }) => createTransaction(input)),
  createTransfer: publicProcedure
    .input(z.object({
      fromAccountId: z.number(),
      toAccountId: z.number(),
      amount: z.number().positive(),
      description: z.string(),
      operatorId: z.number()
    }))
    .mutation(({ input }) => createTransfer(input.fromAccountId, input.toAccountId, input.amount, input.description, input.operatorId)),
  getTransactions: publicProcedure
    .query(() => getTransactions()),

  // Student savings
  createStudentSavings: publicProcedure
    .input(createStudentSavingsInputSchema)
    .mutation(({ input }) => createStudentSavings(input)),
  getStudentSavings: publicProcedure
    .input(z.object({ studentId: z.number() }))
    .query(({ input }) => getStudentSavings(input.studentId)),
  getStudentSavingsBalance: publicProcedure
    .input(z.object({ studentId: z.number() }))
    .query(({ input }) => getStudentSavingsBalance(input.studentId)),

  // WhatsApp notifications
  createWhatsappNotification: publicProcedure
    .input(createWhatsappNotificationInputSchema)
    .mutation(({ input }) => createWhatsappNotification(input)),
  sendPaymentNotification: publicProcedure
    .input(z.object({
      studentId: z.number(),
      paymentAmount: z.number(),
      receiptNumber: z.string()
    }))
    .mutation(({ input }) => sendPaymentNotification(input.studentId, input.paymentAmount, input.receiptNumber)),
  sendPaymentReminderNotification: publicProcedure
    .input(z.object({
      studentId: z.number(),
      paymentType: z.string(),
      amount: z.number()
    }))
    .mutation(({ input }) => sendPaymentReminderNotification(input.studentId, input.paymentType, input.amount)),
  getWhatsappNotifications: publicProcedure
    .query(() => getWhatsappNotifications()),
  getPendingWhatsappNotifications: publicProcedure
    .query(() => getPendingWhatsappNotifications()),

  // Reports
  generateReport: publicProcedure
    .input(reportRequestSchema)
    .query(({ input }) => generateReport(input)),
  generateDailyIncomeReport: publicProcedure
    .input(z.object({ date: z.coerce.date() }))
    .query(({ input }) => generateDailyIncomeReport(input.date)),
  generateMonthlyRecapReport: publicProcedure
    .input(z.object({ year: z.number(), month: z.number().min(1).max(12) }))
    .query(({ input }) => generateMonthlyRecapReport(input.year, input.month)),

  // SPP cards and receipts
  generateSppCard: publicProcedure
    .input(z.object({ studentId: z.number() }))
    .query(({ input }) => generateSppCard(input.studentId)),
  generateBarcodeForStudent: publicProcedure
    .input(z.object({ studentId: z.number() }))
    .mutation(({ input }) => generateBarcodeForStudent(input.studentId)),
  printReceipt: publicProcedure
    .input(z.object({ transactionId: z.number(), copies: z.number().min(1).default(1) }))
    .query(({ input }) => printReceipt(input.transactionId, input.copies))
});

export type AppRouter = typeof appRouter;

async function start() {
  const port = process.env['SERVER_PORT'] || 2022;
  const server = createHTTPServer({
    middleware: (req, res, next) => {
      cors()(req, res, next);
    },
    router: appRouter,
    createContext() {
      return {};
    },
  });
  server.listen(port);
  console.log(`EduFinance TRPC server listening at port: ${port}`);
}

start();