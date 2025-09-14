import { serial, text, pgTable, timestamp, numeric, integer, boolean, pgEnum, varchar } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// Enums
export const userRoleEnum = pgEnum('user_role', ['admin', 'operator', 'cashier']);
export const paymentTypeEnum = pgEnum('payment_type', ['spp', 'uang_gedung', 'daftar_ulang', 'uang_ujian', 'uang_seragam', 'uang_buku', 'study_tour', 'tabungan', 'custom']);
export const paymentStatusEnum = pgEnum('payment_status', ['pending', 'partial', 'paid']);
export const transactionTypeEnum = pgEnum('transaction_type', ['income', 'expense', 'transfer']);
export const accountTypeEnum = pgEnum('account_type', ['cash', 'bank']);
export const gradeEnum = pgEnum('grade', ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12']);
export const savingsTypeEnum = pgEnum('savings_type', ['deposit', 'withdrawal']);
export const notificationStatusEnum = pgEnum('notification_status', ['pending', 'sent', 'failed']);

// Users table
export const usersTable = pgTable('users', {
  id: serial('id').primaryKey(),
  username: varchar('username', { length: 50 }).notNull().unique(),
  password_hash: text('password_hash').notNull(),
  full_name: varchar('full_name', { length: 100 }).notNull(),
  role: userRoleEnum('role').notNull(),
  is_active: boolean('is_active').default(true).notNull(),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at')
});

// Students table
export const studentsTable = pgTable('students', {
  id: serial('id').primaryKey(),
  student_id: varchar('student_id', { length: 20 }).notNull().unique(),
  name: varchar('name', { length: 100 }).notNull(),
  grade: gradeEnum('grade').notNull(),
  class_name: varchar('class_name', { length: 10 }).notNull(),
  phone: varchar('phone', { length: 20 }),
  parent_phone: varchar('parent_phone', { length: 20 }),
  address: text('address'),
  is_active: boolean('is_active').default(true).notNull(),
  barcode: varchar('barcode', { length: 50 }).unique(),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at')
});

// Payment type configurations table
export const paymentTypeConfigsTable = pgTable('payment_type_configs', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 100 }).notNull(),
  type: paymentTypeEnum('type').notNull(),
  amount: numeric('amount', { precision: 15, scale: 2 }).notNull(),
  is_installment_allowed: boolean('is_installment_allowed').default(true).notNull(),
  is_active: boolean('is_active').default(true).notNull(),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at')
});

// Student payment assignments table (for custom amounts and exemptions)
export const studentPaymentAssignmentsTable = pgTable('student_payment_assignments', {
  id: serial('id').primaryKey(),
  student_id: integer('student_id').notNull().references(() => studentsTable.id),
  payment_type_config_id: integer('payment_type_config_id').notNull().references(() => paymentTypeConfigsTable.id),
  custom_amount: numeric('custom_amount', { precision: 15, scale: 2 }),
  discount_amount: numeric('discount_amount', { precision: 15, scale: 2 }),
  is_exempt: boolean('is_exempt').default(false).notNull(),
  created_at: timestamp('created_at').defaultNow().notNull()
});

// Payment transactions table
export const paymentTransactionsTable = pgTable('payment_transactions', {
  id: serial('id').primaryKey(),
  student_id: integer('student_id').notNull().references(() => studentsTable.id),
  payment_type_config_id: integer('payment_type_config_id').notNull().references(() => paymentTypeConfigsTable.id),
  amount: numeric('amount', { precision: 15, scale: 2 }).notNull(),
  payment_date: timestamp('payment_date').notNull(),
  receipt_number: varchar('receipt_number', { length: 50 }).notNull().unique(),
  notes: text('notes'),
  operator_id: integer('operator_id').notNull().references(() => usersTable.id),
  created_at: timestamp('created_at').defaultNow().notNull()
});

// Accounts table (cash and bank accounts)
export const accountsTable = pgTable('accounts', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 100 }).notNull(),
  type: accountTypeEnum('type').notNull(),
  account_number: varchar('account_number', { length: 50 }),
  bank_name: varchar('bank_name', { length: 100 }),
  balance: numeric('balance', { precision: 15, scale: 2 }).default('0').notNull(),
  is_active: boolean('is_active').default(true).notNull(),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at')
});

// Fund sources table (for tracking different types of funds like Dana BOS)
export const fundSourcesTable = pgTable('fund_sources', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 100 }).notNull(),
  description: text('description'),
  balance: numeric('balance', { precision: 15, scale: 2 }).default('0').notNull(),
  is_active: boolean('is_active').default(true).notNull(),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at')
});

// General transactions table (income, expense, transfers)
export const transactionsTable = pgTable('transactions', {
  id: serial('id').primaryKey(),
  type: transactionTypeEnum('type').notNull(),
  amount: numeric('amount', { precision: 15, scale: 2 }).notNull(),
  description: text('description').notNull(),
  transaction_date: timestamp('transaction_date').notNull(),
  account_id: integer('account_id').notNull().references(() => accountsTable.id),
  fund_source_id: integer('fund_source_id').references(() => fundSourcesTable.id),
  reference_number: varchar('reference_number', { length: 50 }),
  operator_id: integer('operator_id').notNull().references(() => usersTable.id),
  created_at: timestamp('created_at').defaultNow().notNull()
});

// Student savings table
export const studentSavingsTable = pgTable('student_savings', {
  id: serial('id').primaryKey(),
  student_id: integer('student_id').notNull().references(() => studentsTable.id),
  amount: numeric('amount', { precision: 15, scale: 2 }).notNull(),
  type: savingsTypeEnum('type').notNull(),
  transaction_date: timestamp('transaction_date').notNull(),
  notes: text('notes'),
  operator_id: integer('operator_id').notNull().references(() => usersTable.id),
  created_at: timestamp('created_at').defaultNow().notNull()
});

// WhatsApp notifications table
export const whatsappNotificationsTable = pgTable('whatsapp_notifications', {
  id: serial('id').primaryKey(),
  phone_number: varchar('phone_number', { length: 20 }).notNull(),
  message: text('message').notNull(),
  status: notificationStatusEnum('status').default('pending').notNull(),
  sent_at: timestamp('sent_at'),
  error_message: text('error_message'),
  created_at: timestamp('created_at').defaultNow().notNull()
});

// Relations
export const usersRelations = relations(usersTable, ({ many }) => ({
  paymentTransactions: many(paymentTransactionsTable),
  transactions: many(transactionsTable),
  studentSavings: many(studentSavingsTable)
}));

export const studentsRelations = relations(studentsTable, ({ many }) => ({
  paymentAssignments: many(studentPaymentAssignmentsTable),
  paymentTransactions: many(paymentTransactionsTable),
  studentSavings: many(studentSavingsTable)
}));

export const paymentTypeConfigsRelations = relations(paymentTypeConfigsTable, ({ many }) => ({
  paymentAssignments: many(studentPaymentAssignmentsTable),
  paymentTransactions: many(paymentTransactionsTable)
}));

export const studentPaymentAssignmentsRelations = relations(studentPaymentAssignmentsTable, ({ one }) => ({
  student: one(studentsTable, {
    fields: [studentPaymentAssignmentsTable.student_id],
    references: [studentsTable.id]
  }),
  paymentTypeConfig: one(paymentTypeConfigsTable, {
    fields: [studentPaymentAssignmentsTable.payment_type_config_id],
    references: [paymentTypeConfigsTable.id]
  })
}));

export const paymentTransactionsRelations = relations(paymentTransactionsTable, ({ one }) => ({
  student: one(studentsTable, {
    fields: [paymentTransactionsTable.student_id],
    references: [studentsTable.id]
  }),
  paymentTypeConfig: one(paymentTypeConfigsTable, {
    fields: [paymentTransactionsTable.payment_type_config_id],
    references: [paymentTypeConfigsTable.id]
  }),
  operator: one(usersTable, {
    fields: [paymentTransactionsTable.operator_id],
    references: [usersTable.id]
  })
}));

export const accountsRelations = relations(accountsTable, ({ many }) => ({
  transactions: many(transactionsTable)
}));

export const fundSourcesRelations = relations(fundSourcesTable, ({ many }) => ({
  transactions: many(transactionsTable)
}));

export const transactionsRelations = relations(transactionsTable, ({ one }) => ({
  account: one(accountsTable, {
    fields: [transactionsTable.account_id],
    references: [accountsTable.id]
  }),
  fundSource: one(fundSourcesTable, {
    fields: [transactionsTable.fund_source_id],
    references: [fundSourcesTable.id]
  }),
  operator: one(usersTable, {
    fields: [transactionsTable.operator_id],
    references: [usersTable.id]
  })
}));

export const studentSavingsRelations = relations(studentSavingsTable, ({ one }) => ({
  student: one(studentsTable, {
    fields: [studentSavingsTable.student_id],
    references: [studentsTable.id]
  }),
  operator: one(usersTable, {
    fields: [studentSavingsTable.operator_id],
    references: [usersTable.id]
  })
}));

// Export all tables for relation queries
export const tables = {
  users: usersTable,
  students: studentsTable,
  paymentTypeConfigs: paymentTypeConfigsTable,
  studentPaymentAssignments: studentPaymentAssignmentsTable,
  paymentTransactions: paymentTransactionsTable,
  accounts: accountsTable,
  fundSources: fundSourcesTable,
  transactions: transactionsTable,
  studentSavings: studentSavingsTable,
  whatsappNotifications: whatsappNotificationsTable
};

// TypeScript types for the table schemas
export type User = typeof usersTable.$inferSelect;
export type NewUser = typeof usersTable.$inferInsert;
export type Student = typeof studentsTable.$inferSelect;
export type NewStudent = typeof studentsTable.$inferInsert;
export type PaymentTypeConfig = typeof paymentTypeConfigsTable.$inferSelect;
export type NewPaymentTypeConfig = typeof paymentTypeConfigsTable.$inferInsert;
export type StudentPaymentAssignment = typeof studentPaymentAssignmentsTable.$inferSelect;
export type NewStudentPaymentAssignment = typeof studentPaymentAssignmentsTable.$inferInsert;
export type PaymentTransaction = typeof paymentTransactionsTable.$inferSelect;
export type NewPaymentTransaction = typeof paymentTransactionsTable.$inferInsert;
export type Account = typeof accountsTable.$inferSelect;
export type NewAccount = typeof accountsTable.$inferInsert;
export type FundSource = typeof fundSourcesTable.$inferSelect;
export type NewFundSource = typeof fundSourcesTable.$inferInsert;
export type Transaction = typeof transactionsTable.$inferSelect;
export type NewTransaction = typeof transactionsTable.$inferInsert;
export type StudentSavings = typeof studentSavingsTable.$inferSelect;
export type NewStudentSavings = typeof studentSavingsTable.$inferInsert;
export type WhatsappNotification = typeof whatsappNotificationsTable.$inferSelect;
export type NewWhatsappNotification = typeof whatsappNotificationsTable.$inferInsert;