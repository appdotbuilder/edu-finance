import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { accountsTable } from '../db/schema';
import { type CreateAccountInput } from '../schema';
import { getAccounts } from '../handlers/get_accounts';

// Test data for different account types
const cashAccountInput: CreateAccountInput = {
  name: 'Kas Utama',
  type: 'CASH',
  balance: 5000000
};

const bankAccountInput: CreateAccountInput = {
  name: 'Bank Mandiri',
  type: 'BANK',
  bank_name: 'Bank Mandiri',
  account_number: '1234567890',
  balance: 25000000
};

const inactiveAccountInput: CreateAccountInput = {
  name: 'Kas Lama',
  type: 'CASH',
  balance: 1000000
};

describe('getAccounts', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should return empty array when no accounts exist', async () => {
    const result = await getAccounts();

    expect(result).toEqual([]);
  });

  it('should fetch all accounts with proper numeric conversion', async () => {
    // Create test accounts with proper ordering
    await db.insert(accountsTable)
      .values({
        name: cashAccountInput.name,
        type: cashAccountInput.type,
        balance: cashAccountInput.balance!.toString(), // Convert to string for insertion
      })
      .execute();

    // Small delay to ensure different timestamp
    await new Promise(resolve => setTimeout(resolve, 10));

    await db.insert(accountsTable)
      .values({
        name: bankAccountInput.name,
        type: bankAccountInput.type,
        bank_name: bankAccountInput.bank_name,
        account_number: bankAccountInput.account_number,
        balance: bankAccountInput.balance!.toString(), // Convert to string for insertion
      })
      .execute();

    const result = await getAccounts();

    expect(result).toHaveLength(2);
    
    // Verify first account (most recent first due to desc ordering)
    const bankAccount = result[0]; // Bank account was inserted second, so appears first
    expect(bankAccount.name).toEqual('Bank Mandiri');
    expect(bankAccount.type).toEqual('BANK');
    expect(bankAccount.bank_name).toEqual('Bank Mandiri');
    expect(bankAccount.account_number).toEqual('1234567890');
    expect(bankAccount.balance).toEqual(25000000);
    expect(typeof bankAccount.balance).toBe('number'); // Verify numeric conversion
    expect(bankAccount.is_active).toBe(true);
    expect(bankAccount.id).toBeDefined();
    expect(bankAccount.created_at).toBeInstanceOf(Date);
    expect(bankAccount.updated_at).toBeInstanceOf(Date);

    // Verify second account
    const cashAccount = result[1]; // Cash account was inserted first, so appears second
    expect(cashAccount.name).toEqual('Kas Utama');
    expect(cashAccount.type).toEqual('CASH');
    expect(cashAccount.bank_name).toBeNull();
    expect(cashAccount.account_number).toBeNull();
    expect(cashAccount.balance).toEqual(5000000);
    expect(typeof cashAccount.balance).toBe('number'); // Verify numeric conversion
    expect(cashAccount.is_active).toBe(true);
  });

  it('should include both active and inactive accounts', async () => {
    // Create active and inactive accounts
    await db.insert(accountsTable)
      .values([
        {
          name: cashAccountInput.name,
          type: cashAccountInput.type,
          balance: cashAccountInput.balance!.toString(),
          is_active: true
        },
        {
          name: inactiveAccountInput.name,
          type: inactiveAccountInput.type,
          balance: inactiveAccountInput.balance!.toString(),
          is_active: false
        }
      ])
      .execute();

    const result = await getAccounts();

    expect(result).toHaveLength(2);
    
    const activeAccounts = result.filter(account => account.is_active);
    const inactiveAccounts = result.filter(account => !account.is_active);
    
    expect(activeAccounts).toHaveLength(1);
    expect(inactiveAccounts).toHaveLength(1);
    
    expect(activeAccounts[0].name).toEqual('Kas Utama');
    expect(inactiveAccounts[0].name).toEqual('Kas Lama');
  });

  it('should return accounts ordered by creation date (newest first)', async () => {
    // Create accounts with small delay to ensure different timestamps
    await db.insert(accountsTable)
      .values({
        name: 'First Account',
        type: 'CASH',
        balance: '1000000'
      })
      .execute();

    // Small delay to ensure different timestamp
    await new Promise(resolve => setTimeout(resolve, 10));

    await db.insert(accountsTable)
      .values({
        name: 'Second Account',
        type: 'BANK',
        balance: '2000000'
      })
      .execute();

    await new Promise(resolve => setTimeout(resolve, 10));

    await db.insert(accountsTable)
      .values({
        name: 'Third Account',
        type: 'CASH',
        balance: '3000000'
      })
      .execute();

    const result = await getAccounts();

    expect(result).toHaveLength(3);
    expect(result[0].name).toEqual('Third Account'); // Most recent first
    expect(result[1].name).toEqual('Second Account');
    expect(result[2].name).toEqual('First Account'); // Oldest last
  });

  it('should handle accounts with zero balance correctly', async () => {
    await db.insert(accountsTable)
      .values({
        name: 'Zero Balance Account',
        type: 'CASH',
        balance: '0'
      })
      .execute();

    const result = await getAccounts();

    expect(result).toHaveLength(1);
    expect(result[0].balance).toEqual(0);
    expect(typeof result[0].balance).toBe('number');
  });

  it('should handle decimal balances correctly', async () => {
    await db.insert(accountsTable)
      .values({
        name: 'Decimal Balance Account',
        type: 'BANK',
        balance: '1500.50'
      })
      .execute();

    const result = await getAccounts();

    expect(result).toHaveLength(1);
    expect(result[0].balance).toEqual(1500.50);
    expect(typeof result[0].balance).toBe('number');
  });
});