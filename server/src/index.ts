import { initTRPC } from '@trpc/server';
import { createHTTPServer } from '@trpc/server/adapters/standalone';
import 'dotenv/config';
import cors from 'cors';
import superjson from 'superjson';
import { z } from 'zod';

// Import schemas
import {
  createStudentInputSchema,
  createPaymentConfigInputSchema,
  createTransactionInputSchema,
  createAccountInputSchema,
  createFundPositionInputSchema,
  createSavingsTransactionInputSchema,
  processPaymentInputSchema,
  generateSppCardInputSchema,
  sendWhatsappNotificationInputSchema,
  getStudentsQuerySchema,
  getTransactionsQuerySchema,
  getStudentPaymentsQuerySchema,
} from './schema';

// Import handlers
import { createStudent } from './handlers/create_student';
import { getStudents } from './handlers/get_students';
import { createPaymentConfig } from './handlers/create_payment_config';
import { getPaymentConfigs } from './handlers/get_payment_configs';
import { getStudentPayments } from './handlers/get_student_payments';
import { processPayment } from './handlers/process_payment';
import { createAccount } from './handlers/create_account';
import { getAccounts } from './handlers/get_accounts';
import { createFundPosition } from './handlers/create_fund_position';
import { getFundPositions } from './handlers/get_fund_positions';
import { createTransaction } from './handlers/create_transaction';
import { getTransactions } from './handlers/get_transactions';
import { createSavingsTransaction } from './handlers/create_savings_transaction';
import { getStudentSavings } from './handlers/get_student_savings';
import { generateSppCard } from './handlers/generate_spp_card';
import { scanBarcode } from './handlers/scan_barcode';
import { sendWhatsappNotification } from './handlers/send_whatsapp_notification';
import { getDailyReport, getMonthlyReport, getOutstandingPayments, getCashPositionReport } from './handlers/get_financial_reports';
import { generateReceipt, printReceipt } from './handlers/print_receipt';

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

  // Student management
  createStudent: publicProcedure
    .input(createStudentInputSchema)
    .mutation(({ input }) => createStudent(input)),

  getStudents: publicProcedure
    .input(getStudentsQuerySchema.optional())
    .query(({ input }) => getStudents(input)),

  // Payment configuration management
  createPaymentConfig: publicProcedure
    .input(createPaymentConfigInputSchema)
    .mutation(({ input }) => createPaymentConfig(input)),

  getPaymentConfigs: publicProcedure
    .query(() => getPaymentConfigs()),

  // Student payment management
  getStudentPayments: publicProcedure
    .input(getStudentPaymentsQuerySchema.optional())
    .query(({ input }) => getStudentPayments(input)),

  processPayment: publicProcedure
    .input(processPaymentInputSchema)
    .mutation(({ input }) => processPayment(input)),

  // Account management
  createAccount: publicProcedure
    .input(createAccountInputSchema)
    .mutation(({ input }) => createAccount(input)),

  getAccounts: publicProcedure
    .query(() => getAccounts()),

  // Fund position management
  createFundPosition: publicProcedure
    .input(createFundPositionInputSchema)
    .mutation(({ input }) => createFundPosition(input)),

  getFundPositions: publicProcedure
    .query(() => getFundPositions()),

  // Transaction management
  createTransaction: publicProcedure
    .input(createTransactionInputSchema)
    .mutation(({ input }) => createTransaction(input)),

  getTransactions: publicProcedure
    .input(getTransactionsQuerySchema.optional())
    .query(({ input }) => getTransactions(input)),

  // Savings management
  createSavingsTransaction: publicProcedure
    .input(createSavingsTransactionInputSchema)
    .mutation(({ input }) => createSavingsTransaction(input)),

  getStudentSavings: publicProcedure
    .input(z.object({ studentId: z.number() }))
    .query(({ input }) => getStudentSavings(input.studentId)),

  // SPP Card management
  generateSppCard: publicProcedure
    .input(generateSppCardInputSchema)
    .mutation(({ input }) => generateSppCard(input)),

  scanBarcode: publicProcedure
    .input(z.object({ barcode: z.string() }))
    .query(({ input }) => scanBarcode(input.barcode)),

  // WhatsApp notifications
  sendWhatsappNotification: publicProcedure
    .input(sendWhatsappNotificationInputSchema)
    .mutation(({ input }) => sendWhatsappNotification(input)),

  // Financial reports
  getDailyReport: publicProcedure
    .input(z.object({ date: z.string() }))
    .query(({ input }) => getDailyReport(input.date)),

  getMonthlyReport: publicProcedure
    .input(z.object({ month: z.number().int().min(1).max(12), year: z.number().int() }))
    .query(({ input }) => getMonthlyReport(input.month, input.year)),

  getOutstandingPayments: publicProcedure
    .input(z.object({ 
      grade: z.string().optional(), 
      className: z.string().optional() 
    }).optional())
    .query(({ input }) => getOutstandingPayments(input?.grade, input?.className)),

  getCashPositionReport: publicProcedure
    .query(() => getCashPositionReport()),

  // Receipt printing
  generateReceipt: publicProcedure
    .input(z.object({ 
      transactionId: z.number(), 
      copies: z.number().int().positive().optional() 
    }))
    .query(({ input }) => generateReceipt(input.transactionId, input.copies)),

  printReceipt: publicProcedure
    .input(z.object({
      receiptData: z.any(), // Will be properly typed in actual implementation
      copies: z.number().int().positive().optional()
    }))
    .mutation(({ input }) => printReceipt(input.receiptData, input.copies)),
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