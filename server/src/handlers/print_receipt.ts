import { db } from '../db';
import { 
  transactionsTable, 
  studentPaymentsTable, 
  studentsTable, 
  paymentConfigsTable,
  accountsTable 
} from '../db/schema';
import { eq, and } from 'drizzle-orm';

export interface ReceiptData {
  id: number;
  receipt_number: string;
  student_name: string;
  nis: string;
  payment_items: Array<{
    description: string;
    amount: number;
  }>;
  total_amount: number;
  payment_method: string;
  received_by: string;
  transaction_date: Date;
  notes?: string;
}

export interface PrintResult {
  success: boolean;
  printed_copies: number;
  receipt_number?: string;
}

export const generateReceipt = async (transactionId: number, copies: number = 1): Promise<ReceiptData> => {
  try {
    // Query transaction with all related data
    const results = await db.select({
      transaction: transactionsTable,
      student_payment: studentPaymentsTable,
      student: studentsTable,
      payment_config: paymentConfigsTable,
      account: accountsTable
    })
    .from(transactionsTable)
    .innerJoin(accountsTable, eq(transactionsTable.account_id, accountsTable.id))
    .leftJoin(studentPaymentsTable, eq(transactionsTable.student_payment_id, studentPaymentsTable.id))
    .leftJoin(studentsTable, eq(studentPaymentsTable.student_id, studentsTable.id))
    .leftJoin(paymentConfigsTable, eq(studentPaymentsTable.payment_config_id, paymentConfigsTable.id))
    .where(eq(transactionsTable.id, transactionId))
    .execute();

    if (results.length === 0) {
      throw new Error(`Transaction with ID ${transactionId} not found`);
    }

    const result = results[0];
    const transaction = result.transaction;
    const student = result.student;
    const paymentConfig = result.payment_config;
    const account = result.account;

    // Generate receipt number
    const receiptNumber = `RCP${String(transactionId).padStart(6, '0')}-${Date.now().toString().slice(-6)}`;

    // Build payment items array
    const paymentItems = [];
    
    if (paymentConfig) {
      paymentItems.push({
        description: paymentConfig.name,
        amount: parseFloat(transaction.amount)
      });
    } else {
      // For non-student payment transactions
      paymentItems.push({
        description: transaction.description,
        amount: parseFloat(transaction.amount)
      });
    }

    // Determine payment method based on account type
    const paymentMethod = account.type === 'CASH' ? 'CASH' : `BANK TRANSFER (${account.name})`;

    const receiptData: ReceiptData = {
      id: transaction.id,
      receipt_number: receiptNumber,
      student_name: student?.name || 'N/A',
      nis: student?.nis || 'N/A',
      payment_items: paymentItems,
      total_amount: parseFloat(transaction.amount),
      payment_method: paymentMethod,
      received_by: transaction.created_by,
      transaction_date: transaction.created_at,
      notes: transaction.reference_number ? `Ref: ${transaction.reference_number}` : undefined
    };

    return receiptData;
  } catch (error) {
    console.error('Receipt generation failed:', error);
    throw error;
  }
};

export const printReceipt = async (receiptData: ReceiptData, copies: number = 1): Promise<PrintResult> => {
  try {
    // Validate copies parameter
    if (copies < 1 || copies > 10) {
      return {
        success: false,
        printed_copies: 0,
        receipt_number: receiptData.receipt_number
      };
    }

    // Simulate printing process
    // In a real implementation, this would interface with printer hardware/API
    console.log(`Printing ${copies} copies of receipt ${receiptData.receipt_number}`);
    console.log(`Student: ${receiptData.student_name} (${receiptData.nis})`);
    console.log(`Total Amount: Rp ${receiptData.total_amount.toLocaleString('id-ID')}`);
    console.log(`Payment Method: ${receiptData.payment_method}`);
    console.log(`Received By: ${receiptData.received_by}`);
    
    // Simulate potential printing failure (5% chance)
    const shouldFail = Math.random() < 0.05;
    if (shouldFail) {
      throw new Error('Printer communication error');
    }

    return {
      success: true,
      printed_copies: copies,
      receipt_number: receiptData.receipt_number
    };
  } catch (error) {
    console.error('Receipt printing failed:', error);
    return {
      success: false,
      printed_copies: 0,
      receipt_number: receiptData.receipt_number
    };
  }
};

export const generateAndPrintReceipt = async (transactionId: number, copies: number = 1): Promise<PrintResult> => {
  try {
    // Generate receipt data
    const receiptData = await generateReceipt(transactionId);
    
    // Print the receipt
    const printResult = await printReceipt(receiptData, copies);
    
    return printResult;
  } catch (error) {
    console.error('Generate and print receipt failed:', error);
    throw error;
  }
};