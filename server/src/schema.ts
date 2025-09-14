import { z } from 'zod';

// Enums
export const gradeSchema = z.enum(['TK', 'SD', 'SMP', 'SMA', 'SMK']);
export type Grade = z.infer<typeof gradeSchema>;

export const paymentTypeSchema = z.enum([
  'SPP', 
  'UANG_GEDUNG', 
  'DAFTAR_ULANG', 
  'UANG_UJIAN', 
  'UANG_SERAGAM', 
  'UANG_BUKU', 
  'STUDY_TOUR', 
  'TABUNGAN', 
  'LAINNYA'
]);
export type PaymentType = z.infer<typeof paymentTypeSchema>;

export const transactionTypeSchema = z.enum(['INCOME', 'EXPENSE', 'TRANSFER']);
export type TransactionType = z.infer<typeof transactionTypeSchema>;

export const accountTypeSchema = z.enum(['CASH', 'BANK']);
export type AccountType = z.infer<typeof accountTypeSchema>;

export const studentStatusSchema = z.enum(['ACTIVE', 'INACTIVE', 'GRADUATED']);
export type StudentStatus = z.infer<typeof studentStatusSchema>;

// Student schema
export const studentSchema = z.object({
  id: z.number(),
  nis: z.string(),
  name: z.string(),
  grade: gradeSchema,
  class_name: z.string(),
  phone: z.string().nullable(),
  parent_phone: z.string().nullable(),
  address: z.string().nullable(),
  status: studentStatusSchema,
  created_at: z.coerce.date(),
  updated_at: z.coerce.date()
});

export type Student = z.infer<typeof studentSchema>;

// Payment configuration schema
export const paymentConfigSchema = z.object({
  id: z.number(),
  payment_type: paymentTypeSchema,
  name: z.string(),
  description: z.string().nullable(),
  amount: z.number(),
  grade: gradeSchema.nullable(),
  class_name: z.string().nullable(),
  student_id: z.number().nullable(),
  is_active: z.boolean(),
  can_installment: z.boolean(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date()
});

export type PaymentConfig = z.infer<typeof paymentConfigSchema>;

// Student payment schema
export const studentPaymentSchema = z.object({
  id: z.number(),
  student_id: z.number(),
  payment_config_id: z.number(),
  amount_due: z.number(),
  amount_paid: z.number(),
  amount_remaining: z.number(),
  due_date: z.coerce.date().nullable(),
  status: z.enum(['PENDING', 'PARTIAL', 'PAID']),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date()
});

export type StudentPayment = z.infer<typeof studentPaymentSchema>;

// Account schema
export const accountSchema = z.object({
  id: z.number(),
  name: z.string(),
  type: accountTypeSchema,
  bank_name: z.string().nullable(),
  account_number: z.string().nullable(),
  balance: z.number(),
  is_active: z.boolean(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date()
});

export type Account = z.infer<typeof accountSchema>;

// Fund position schema
export const fundPositionSchema = z.object({
  id: z.number(),
  name: z.string(),
  description: z.string().nullable(),
  balance: z.number(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date()
});

export type FundPosition = z.infer<typeof fundPositionSchema>;

// Transaction schema
export const transactionSchema = z.object({
  id: z.number(),
  type: transactionTypeSchema,
  amount: z.number(),
  description: z.string(),
  reference_number: z.string().nullable(),
  account_id: z.number(),
  fund_position_id: z.number().nullable(),
  student_payment_id: z.number().nullable(),
  created_by: z.string(),
  created_at: z.coerce.date()
});

export type Transaction = z.infer<typeof transactionSchema>;

// Savings schema
export const savingsSchema = z.object({
  id: z.number(),
  student_id: z.number(),
  balance: z.number(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date()
});

export type Savings = z.infer<typeof savingsSchema>;

// Savings transaction schema
export const savingsTransactionSchema = z.object({
  id: z.number(),
  savings_id: z.number(),
  type: z.enum(['DEPOSIT', 'WITHDRAWAL']),
  amount: z.number(),
  description: z.string().nullable(),
  created_by: z.string(),
  created_at: z.coerce.date()
});

export type SavingsTransaction = z.infer<typeof savingsTransactionSchema>;

// SPP card schema
export const sppCardSchema = z.object({
  id: z.number(),
  student_id: z.number(),
  barcode: z.string(),
  is_active: z.boolean(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date()
});

export type SppCard = z.infer<typeof sppCardSchema>;

// WhatsApp notification schema
export const whatsappNotificationSchema = z.object({
  id: z.number(),
  phone: z.string(),
  message: z.string(),
  type: z.enum(['BILL_REMINDER', 'PAYMENT_CONFIRMATION', 'ANNOUNCEMENT']),
  status: z.enum(['PENDING', 'SENT', 'FAILED']),
  sent_at: z.coerce.date().nullable(),
  created_at: z.coerce.date()
});

export type WhatsappNotification = z.infer<typeof whatsappNotificationSchema>;

// Input schemas for creating entities
export const createStudentInputSchema = z.object({
  nis: z.string(),
  name: z.string(),
  grade: gradeSchema,
  class_name: z.string(),
  phone: z.string().nullable().optional(),
  parent_phone: z.string().nullable().optional(),
  address: z.string().nullable().optional(),
  status: studentStatusSchema.optional()
});

export type CreateStudentInput = z.infer<typeof createStudentInputSchema>;

export const createPaymentConfigInputSchema = z.object({
  payment_type: paymentTypeSchema,
  name: z.string(),
  description: z.string().nullable().optional(),
  amount: z.number().positive(),
  grade: gradeSchema.nullable().optional(),
  class_name: z.string().nullable().optional(),
  student_id: z.number().nullable().optional(),
  can_installment: z.boolean().optional()
});

export type CreatePaymentConfigInput = z.infer<typeof createPaymentConfigInputSchema>;

export const createTransactionInputSchema = z.object({
  type: transactionTypeSchema,
  amount: z.number().positive(),
  description: z.string(),
  reference_number: z.string().nullable().optional(),
  account_id: z.number(),
  fund_position_id: z.number().nullable().optional(),
  student_payment_id: z.number().nullable().optional(),
  created_by: z.string()
});

export type CreateTransactionInput = z.infer<typeof createTransactionInputSchema>;

export const createAccountInputSchema = z.object({
  name: z.string(),
  type: accountTypeSchema,
  bank_name: z.string().nullable().optional(),
  account_number: z.string().nullable().optional(),
  balance: z.number().optional()
});

export type CreateAccountInput = z.infer<typeof createAccountInputSchema>;

export const createFundPositionInputSchema = z.object({
  name: z.string(),
  description: z.string().nullable().optional(),
  balance: z.number().optional()
});

export type CreateFundPositionInput = z.infer<typeof createFundPositionInputSchema>;

export const createSavingsTransactionInputSchema = z.object({
  student_id: z.number(),
  type: z.enum(['DEPOSIT', 'WITHDRAWAL']),
  amount: z.number().positive(),
  description: z.string().nullable().optional(),
  created_by: z.string()
});

export type CreateSavingsTransactionInput = z.infer<typeof createSavingsTransactionInputSchema>;

export const processPaymentInputSchema = z.object({
  student_payment_id: z.number(),
  amount: z.number().positive(),
  account_id: z.number(),
  created_by: z.string(),
  reference_number: z.string().nullable().optional()
});

export type ProcessPaymentInput = z.infer<typeof processPaymentInputSchema>;

export const generateSppCardInputSchema = z.object({
  student_id: z.number()
});

export type GenerateSppCardInput = z.infer<typeof generateSppCardInputSchema>;

export const sendWhatsappNotificationInputSchema = z.object({
  phone: z.string(),
  message: z.string(),
  type: z.enum(['BILL_REMINDER', 'PAYMENT_CONFIRMATION', 'ANNOUNCEMENT'])
});

export type SendWhatsappNotificationInput = z.infer<typeof sendWhatsappNotificationInputSchema>;

// Query schemas
export const getStudentsQuerySchema = z.object({
  grade: gradeSchema.optional(),
  class_name: z.string().optional(),
  status: studentStatusSchema.optional(),
  search: z.string().optional()
});

export type GetStudentsQuery = z.infer<typeof getStudentsQuerySchema>;

export const getTransactionsQuerySchema = z.object({
  type: transactionTypeSchema.optional(),
  account_id: z.number().optional(),
  date_from: z.string().optional(),
  date_to: z.string().optional(),
  limit: z.number().int().positive().optional(),
  offset: z.number().int().nonnegative().optional()
});

export type GetTransactionsQuery = z.infer<typeof getTransactionsQuerySchema>;

export const getStudentPaymentsQuerySchema = z.object({
  student_id: z.number().optional(),
  payment_type: paymentTypeSchema.optional(),
  status: z.enum(['PENDING', 'PARTIAL', 'PAID']).optional(),
  grade: gradeSchema.optional(),
  class_name: z.string().optional()
});

export type GetStudentPaymentsQuery = z.infer<typeof getStudentPaymentsQuerySchema>;