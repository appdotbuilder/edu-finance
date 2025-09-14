import { 
  serial, 
  text, 
  pgTable, 
  timestamp, 
  numeric, 
  integer, 
  boolean,
  pgEnum,
  unique,
  index
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// Enums
export const gradeEnum = pgEnum('grade', ['TK', 'SD', 'SMP', 'SMA', 'SMK']);
export const paymentTypeEnum = pgEnum('payment_type', [
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
export const transactionTypeEnum = pgEnum('transaction_type', ['INCOME', 'EXPENSE', 'TRANSFER']);
export const accountTypeEnum = pgEnum('account_type', ['CASH', 'BANK']);
export const studentStatusEnum = pgEnum('student_status', ['ACTIVE', 'INACTIVE', 'GRADUATED']);
export const paymentStatusEnum = pgEnum('payment_status', ['PENDING', 'PARTIAL', 'PAID']);
export const savingsTransactionTypeEnum = pgEnum('savings_transaction_type', ['DEPOSIT', 'WITHDRAWAL']);
export const notificationTypeEnum = pgEnum('notification_type', ['BILL_REMINDER', 'PAYMENT_CONFIRMATION', 'ANNOUNCEMENT']);
export const notificationStatusEnum = pgEnum('notification_status', ['PENDING', 'SENT', 'FAILED']);

// Students table
export const studentsTable = pgTable('students', {
  id: serial('id').primaryKey(),
  nis: text('nis').notNull().unique(),
  name: text('name').notNull(),
  grade: gradeEnum('grade').notNull(),
  class_name: text('class_name').notNull(),
  phone: text('phone'),
  parent_phone: text('parent_phone'),
  address: text('address'),
  status: studentStatusEnum('status').notNull().default('ACTIVE'),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  gradeClassIdx: index('students_grade_class_idx').on(table.grade, table.class_name),
  statusIdx: index('students_status_idx').on(table.status),
}));

// Payment configurations table
export const paymentConfigsTable = pgTable('payment_configs', {
  id: serial('id').primaryKey(),
  payment_type: paymentTypeEnum('payment_type').notNull(),
  name: text('name').notNull(),
  description: text('description'),
  amount: numeric('amount', { precision: 12, scale: 2 }).notNull(),
  grade: gradeEnum('grade'),
  class_name: text('class_name'),
  student_id: integer('student_id').references(() => studentsTable.id),
  is_active: boolean('is_active').notNull().default(true),
  can_installment: boolean('can_installment').notNull().default(false),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  paymentTypeIdx: index('payment_configs_payment_type_idx').on(table.payment_type),
  gradeClassIdx: index('payment_configs_grade_class_idx').on(table.grade, table.class_name),
}));

// Student payments table
export const studentPaymentsTable = pgTable('student_payments', {
  id: serial('id').primaryKey(),
  student_id: integer('student_id').notNull().references(() => studentsTable.id),
  payment_config_id: integer('payment_config_id').notNull().references(() => paymentConfigsTable.id),
  amount_due: numeric('amount_due', { precision: 12, scale: 2 }).notNull(),
  amount_paid: numeric('amount_paid', { precision: 12, scale: 2 }).notNull().default('0'),
  amount_remaining: numeric('amount_remaining', { precision: 12, scale: 2 }).notNull(),
  due_date: timestamp('due_date'),
  status: paymentStatusEnum('status').notNull().default('PENDING'),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  studentIdx: index('student_payments_student_idx').on(table.student_id),
  statusIdx: index('student_payments_status_idx').on(table.status),
  dueDateIdx: index('student_payments_due_date_idx').on(table.due_date),
}));

// Accounts table
export const accountsTable = pgTable('accounts', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  type: accountTypeEnum('type').notNull(),
  bank_name: text('bank_name'),
  account_number: text('account_number'),
  balance: numeric('balance', { precision: 15, scale: 2 }).notNull().default('0'),
  is_active: boolean('is_active').notNull().default(true),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  typeIdx: index('accounts_type_idx').on(table.type),
}));

// Fund positions table
export const fundPositionsTable = pgTable('fund_positions', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  balance: numeric('balance', { precision: 15, scale: 2 }).notNull().default('0'),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull(),
});

// Transactions table
export const transactionsTable = pgTable('transactions', {
  id: serial('id').primaryKey(),
  type: transactionTypeEnum('type').notNull(),
  amount: numeric('amount', { precision: 12, scale: 2 }).notNull(),
  description: text('description').notNull(),
  reference_number: text('reference_number'),
  account_id: integer('account_id').notNull().references(() => accountsTable.id),
  fund_position_id: integer('fund_position_id').references(() => fundPositionsTable.id),
  student_payment_id: integer('student_payment_id').references(() => studentPaymentsTable.id),
  created_by: text('created_by').notNull(),
  created_at: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  typeIdx: index('transactions_type_idx').on(table.type),
  accountIdx: index('transactions_account_idx').on(table.account_id),
  createdAtIdx: index('transactions_created_at_idx').on(table.created_at),
  referenceIdx: index('transactions_reference_idx').on(table.reference_number),
}));

// Savings table
export const savingsTable = pgTable('savings', {
  id: serial('id').primaryKey(),
  student_id: integer('student_id').notNull().references(() => studentsTable.id).unique(),
  balance: numeric('balance', { precision: 12, scale: 2 }).notNull().default('0'),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull(),
});

// Savings transactions table
export const savingsTransactionsTable = pgTable('savings_transactions', {
  id: serial('id').primaryKey(),
  savings_id: integer('savings_id').notNull().references(() => savingsTable.id),
  type: savingsTransactionTypeEnum('type').notNull(),
  amount: numeric('amount', { precision: 12, scale: 2 }).notNull(),
  description: text('description'),
  created_by: text('created_by').notNull(),
  created_at: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  savingsIdx: index('savings_transactions_savings_idx').on(table.savings_id),
  typeIdx: index('savings_transactions_type_idx').on(table.type),
}));

// SPP cards table
export const sppCardsTable = pgTable('spp_cards', {
  id: serial('id').primaryKey(),
  student_id: integer('student_id').notNull().references(() => studentsTable.id),
  barcode: text('barcode').notNull().unique(),
  is_active: boolean('is_active').notNull().default(true),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  barcodeIdx: index('spp_cards_barcode_idx').on(table.barcode),
}));

// WhatsApp notifications table
export const whatsappNotificationsTable = pgTable('whatsapp_notifications', {
  id: serial('id').primaryKey(),
  phone: text('phone').notNull(),
  message: text('message').notNull(),
  type: notificationTypeEnum('type').notNull(),
  status: notificationStatusEnum('status').notNull().default('PENDING'),
  sent_at: timestamp('sent_at'),
  created_at: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  statusIdx: index('whatsapp_notifications_status_idx').on(table.status),
  typeIdx: index('whatsapp_notifications_type_idx').on(table.type),
}));

// Relations
export const studentsRelations = relations(studentsTable, ({ many, one }) => ({
  paymentConfigs: many(paymentConfigsTable),
  studentPayments: many(studentPaymentsTable),
  savings: one(savingsTable),
  sppCards: many(sppCardsTable),
}));

export const paymentConfigsRelations = relations(paymentConfigsTable, ({ one, many }) => ({
  student: one(studentsTable, {
    fields: [paymentConfigsTable.student_id],
    references: [studentsTable.id],
  }),
  studentPayments: many(studentPaymentsTable),
}));

export const studentPaymentsRelations = relations(studentPaymentsTable, ({ one, many }) => ({
  student: one(studentsTable, {
    fields: [studentPaymentsTable.student_id],
    references: [studentsTable.id],
  }),
  paymentConfig: one(paymentConfigsTable, {
    fields: [studentPaymentsTable.payment_config_id],
    references: [paymentConfigsTable.id],
  }),
  transactions: many(transactionsTable),
}));

export const accountsRelations = relations(accountsTable, ({ many }) => ({
  transactions: many(transactionsTable),
}));

export const fundPositionsRelations = relations(fundPositionsTable, ({ many }) => ({
  transactions: many(transactionsTable),
}));

export const transactionsRelations = relations(transactionsTable, ({ one }) => ({
  account: one(accountsTable, {
    fields: [transactionsTable.account_id],
    references: [accountsTable.id],
  }),
  fundPosition: one(fundPositionsTable, {
    fields: [transactionsTable.fund_position_id],
    references: [fundPositionsTable.id],
  }),
  studentPayment: one(studentPaymentsTable, {
    fields: [transactionsTable.student_payment_id],
    references: [studentPaymentsTable.id],
  }),
}));

export const savingsRelations = relations(savingsTable, ({ one, many }) => ({
  student: one(studentsTable, {
    fields: [savingsTable.student_id],
    references: [studentsTable.id],
  }),
  transactions: many(savingsTransactionsTable),
}));

export const savingsTransactionsRelations = relations(savingsTransactionsTable, ({ one }) => ({
  savings: one(savingsTable, {
    fields: [savingsTransactionsTable.savings_id],
    references: [savingsTable.id],
  }),
}));

export const sppCardsRelations = relations(sppCardsTable, ({ one }) => ({
  student: one(studentsTable, {
    fields: [sppCardsTable.student_id],
    references: [studentsTable.id],
  }),
}));

// Export all tables for drizzle
export const tables = {
  students: studentsTable,
  paymentConfigs: paymentConfigsTable,
  studentPayments: studentPaymentsTable,
  accounts: accountsTable,
  fundPositions: fundPositionsTable,
  transactions: transactionsTable,
  savings: savingsTable,
  savingsTransactions: savingsTransactionsTable,
  sppCards: sppCardsTable,
  whatsappNotifications: whatsappNotificationsTable,
};