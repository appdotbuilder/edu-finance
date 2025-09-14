import { z } from 'zod';

// Enums
export const userRoleEnum = z.enum(['admin', 'operator', 'cashier']);
export const paymentTypeEnum = z.enum(['spp', 'uang_gedung', 'daftar_ulang', 'uang_ujian', 'uang_seragam', 'uang_buku', 'study_tour', 'tabungan', 'custom']);
export const paymentStatusEnum = z.enum(['pending', 'partial', 'paid']);
export const transactionTypeEnum = z.enum(['income', 'expense', 'transfer']);
export const accountTypeEnum = z.enum(['cash', 'bank']);
export const gradeEnum = z.enum(['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12']);

// User schemas
export const userSchema = z.object({
  id: z.number(),
  username: z.string(),
  password_hash: z.string(),
  full_name: z.string(),
  role: userRoleEnum,
  is_active: z.boolean(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date().nullable()
});

export type User = z.infer<typeof userSchema>;

export const createUserInputSchema = z.object({
  username: z.string().min(3).max(50),
  password: z.string().min(6),
  full_name: z.string().min(1),
  role: userRoleEnum
});

export type CreateUserInput = z.infer<typeof createUserInputSchema>;

// Student schemas
export const studentSchema = z.object({
  id: z.number(),
  student_id: z.string(),
  name: z.string(),
  grade: gradeEnum,
  class_name: z.string(),
  phone: z.string().nullable(),
  parent_phone: z.string().nullable(),
  address: z.string().nullable(),
  is_active: z.boolean(),
  barcode: z.string().nullable(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date().nullable()
});

export type Student = z.infer<typeof studentSchema>;

export const createStudentInputSchema = z.object({
  student_id: z.string(),
  name: z.string().min(1),
  grade: gradeEnum,
  class_name: z.string(),
  phone: z.string().optional(),
  parent_phone: z.string().optional(),
  address: z.string().optional()
});

export type CreateStudentInput = z.infer<typeof createStudentInputSchema>;

// Payment type configuration schemas
export const paymentTypeConfigSchema = z.object({
  id: z.number(),
  name: z.string(),
  type: paymentTypeEnum,
  amount: z.number(),
  is_installment_allowed: z.boolean(),
  is_active: z.boolean(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date().nullable()
});

export type PaymentTypeConfig = z.infer<typeof paymentTypeConfigSchema>;

export const createPaymentTypeConfigInputSchema = z.object({
  name: z.string().min(1),
  type: paymentTypeEnum,
  amount: z.number().positive(),
  is_installment_allowed: z.boolean().default(true)
});

export type CreatePaymentTypeConfigInput = z.infer<typeof createPaymentTypeConfigInputSchema>;

// Student payment assignment schemas
export const studentPaymentAssignmentSchema = z.object({
  id: z.number(),
  student_id: z.number(),
  payment_type_config_id: z.number(),
  custom_amount: z.number().nullable(),
  discount_amount: z.number().nullable(),
  is_exempt: z.boolean(),
  created_at: z.coerce.date()
});

export type StudentPaymentAssignment = z.infer<typeof studentPaymentAssignmentSchema>;

export const createStudentPaymentAssignmentInputSchema = z.object({
  student_id: z.number(),
  payment_type_config_id: z.number(),
  custom_amount: z.number().positive().optional(),
  discount_amount: z.number().nonnegative().optional(),
  is_exempt: z.boolean().default(false)
});

export type CreateStudentPaymentAssignmentInput = z.infer<typeof createStudentPaymentAssignmentInputSchema>;

// Payment transaction schemas
export const paymentTransactionSchema = z.object({
  id: z.number(),
  student_id: z.number(),
  payment_type_config_id: z.number(),
  amount: z.number(),
  payment_date: z.coerce.date(),
  receipt_number: z.string(),
  notes: z.string().nullable(),
  operator_id: z.number(),
  created_at: z.coerce.date()
});

export type PaymentTransaction = z.infer<typeof paymentTransactionSchema>;

export const createPaymentTransactionInputSchema = z.object({
  student_id: z.number(),
  payment_type_config_id: z.number(),
  amount: z.number().positive(),
  payment_date: z.coerce.date().optional().default(() => new Date()),
  notes: z.string().optional(),
  operator_id: z.number()
});

export type CreatePaymentTransactionInput = z.infer<typeof createPaymentTransactionInputSchema>;

// Account schemas (for cash and bank accounts)
export const accountSchema = z.object({
  id: z.number(),
  name: z.string(),
  type: accountTypeEnum,
  account_number: z.string().nullable(),
  bank_name: z.string().nullable(),
  balance: z.number(),
  is_active: z.boolean(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date().nullable()
});

export type Account = z.infer<typeof accountSchema>;

export const createAccountInputSchema = z.object({
  name: z.string().min(1),
  type: accountTypeEnum,
  account_number: z.string().optional(),
  bank_name: z.string().optional(),
  initial_balance: z.number().default(0)
});

export type CreateAccountInput = z.infer<typeof createAccountInputSchema>;

// Fund source schemas (for tracking different types of funds)
export const fundSourceSchema = z.object({
  id: z.number(),
  name: z.string(),
  description: z.string().nullable(),
  balance: z.number(),
  is_active: z.boolean(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date().nullable()
});

export type FundSource = z.infer<typeof fundSourceSchema>;

export const createFundSourceInputSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  initial_balance: z.number().default(0)
});

export type CreateFundSourceInput = z.infer<typeof createFundSourceInputSchema>;

// General transaction schemas (for income/expense/transfers)
export const transactionSchema = z.object({
  id: z.number(),
  type: transactionTypeEnum,
  amount: z.number(),
  description: z.string(),
  transaction_date: z.coerce.date(),
  account_id: z.number(),
  fund_source_id: z.number().nullable(),
  reference_number: z.string().nullable(),
  operator_id: z.number(),
  created_at: z.coerce.date()
});

export type Transaction = z.infer<typeof transactionSchema>;

export const createTransactionInputSchema = z.object({
  type: transactionTypeEnum,
  amount: z.number().positive(),
  description: z.string().min(1),
  transaction_date: z.coerce.date().optional().default(() => new Date()),
  account_id: z.number(),
  fund_source_id: z.number().optional(),
  reference_number: z.string().optional(),
  operator_id: z.number()
});

export type CreateTransactionInput = z.infer<typeof createTransactionInputSchema>;

// Student savings schemas
export const studentSavingsSchema = z.object({
  id: z.number(),
  student_id: z.number(),
  amount: z.number(),
  type: z.enum(['deposit', 'withdrawal']),
  transaction_date: z.coerce.date(),
  notes: z.string().nullable(),
  operator_id: z.number(),
  created_at: z.coerce.date()
});

export type StudentSavings = z.infer<typeof studentSavingsSchema>;

export const createStudentSavingsInputSchema = z.object({
  student_id: z.number(),
  amount: z.number().positive(),
  type: z.enum(['deposit', 'withdrawal']),
  transaction_date: z.coerce.date().optional().default(() => new Date()),
  notes: z.string().optional(),
  operator_id: z.number()
});

export type CreateStudentSavingsInput = z.infer<typeof createStudentSavingsInputSchema>;

// WhatsApp notification schemas
export const whatsappNotificationSchema = z.object({
  id: z.number(),
  phone_number: z.string(),
  message: z.string(),
  status: z.enum(['pending', 'sent', 'failed']),
  sent_at: z.coerce.date().nullable(),
  error_message: z.string().nullable(),
  created_at: z.coerce.date()
});

export type WhatsappNotification = z.infer<typeof whatsappNotificationSchema>;

export const createWhatsappNotificationInputSchema = z.object({
  phone_number: z.string(),
  message: z.string().min(1)
});

export type CreateWhatsappNotificationInput = z.infer<typeof createWhatsappNotificationInputSchema>;

// Report request schemas
export const reportRequestSchema = z.object({
  report_type: z.enum([
    'daily_income',
    'monthly_recap',
    'yearly_recap',
    'student_outstanding',
    'class_outstanding',
    'all_outstanding',
    'balance_report',
    'cash_position',
    'payment_history',
    'savings_report'
  ]),
  start_date: z.coerce.date().optional(),
  end_date: z.coerce.date().optional(),
  student_id: z.number().optional(),
  class_name: z.string().optional(),
  grade: gradeEnum.optional()
});

export type ReportRequest = z.infer<typeof reportRequestSchema>;