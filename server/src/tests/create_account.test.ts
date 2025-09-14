import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { accountsTable } from '../db/schema';
import { type CreateAccountInput } from '../schema';
import { createAccount } from '../handlers/create_account';
import { eq } from 'drizzle-orm';

// Test inputs for different account types
const cashAccountInput: CreateAccountInput = {
  name: 'Kas Utama',
  type: 'CASH',
  balance: 1000000
};

const bankAccountInput: CreateAccountInput = {
  name: 'BCA Sekolah',
  type: 'BANK',
  bank_name: 'Bank Central Asia',
  account_number: '1234567890',
  balance: 5000000
};

const minimalCashInput: CreateAccountInput = {
  name: 'Kas Kecil',
  type: 'CASH'
};

const minimalBankInput: CreateAccountInput = {
  name: 'Mandiri Sekolah',
  type: 'BANK'
};

describe('createAccount', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should create a cash account with balance', async () => {
    const result = await createAccount(cashAccountInput);

    // Basic field validation
    expect(result.name).toEqual('Kas Utama');
    expect(result.type).toEqual('CASH');
    expect(result.balance).toEqual(1000000);
    expect(typeof result.balance).toBe('number');
    expect(result.bank_name).toBeNull();
    expect(result.account_number).toBeNull();
    expect(result.is_active).toBe(true);
    expect(result.id).toBeDefined();
    expect(result.created_at).toBeInstanceOf(Date);
    expect(result.updated_at).toBeInstanceOf(Date);
  });

  it('should create a bank account with full details', async () => {
    const result = await createAccount(bankAccountInput);

    // Basic field validation
    expect(result.name).toEqual('BCA Sekolah');
    expect(result.type).toEqual('BANK');
    expect(result.bank_name).toEqual('Bank Central Asia');
    expect(result.account_number).toEqual('1234567890');
    expect(result.balance).toEqual(5000000);
    expect(typeof result.balance).toBe('number');
    expect(result.is_active).toBe(true);
    expect(result.id).toBeDefined();
    expect(result.created_at).toBeInstanceOf(Date);
    expect(result.updated_at).toBeInstanceOf(Date);
  });

  it('should create cash account with default balance', async () => {
    const result = await createAccount(minimalCashInput);

    expect(result.name).toEqual('Kas Kecil');
    expect(result.type).toEqual('CASH');
    expect(result.balance).toEqual(0);
    expect(typeof result.balance).toBe('number');
    expect(result.bank_name).toBeNull();
    expect(result.account_number).toBeNull();
    expect(result.is_active).toBe(true);
  });

  it('should create bank account with minimal details', async () => {
    const result = await createAccount(minimalBankInput);

    expect(result.name).toEqual('Mandiri Sekolah');
    expect(result.type).toEqual('BANK');
    expect(result.balance).toEqual(0);
    expect(typeof result.balance).toBe('number');
    expect(result.bank_name).toBeNull();
    expect(result.account_number).toBeNull();
    expect(result.is_active).toBe(true);
  });

  it('should save account to database', async () => {
    const result = await createAccount(bankAccountInput);

    // Query using proper drizzle syntax
    const accounts = await db.select()
      .from(accountsTable)
      .where(eq(accountsTable.id, result.id))
      .execute();

    expect(accounts).toHaveLength(1);
    expect(accounts[0].name).toEqual('BCA Sekolah');
    expect(accounts[0].type).toEqual('BANK');
    expect(accounts[0].bank_name).toEqual('Bank Central Asia');
    expect(accounts[0].account_number).toEqual('1234567890');
    expect(parseFloat(accounts[0].balance)).toEqual(5000000);
    expect(accounts[0].is_active).toBe(true);
    expect(accounts[0].created_at).toBeInstanceOf(Date);
    expect(accounts[0].updated_at).toBeInstanceOf(Date);
  });

  it('should handle zero balance correctly', async () => {
    const zeroBalanceInput: CreateAccountInput = {
      name: 'Zero Balance Account',
      type: 'CASH',
      balance: 0
    };

    const result = await createAccount(zeroBalanceInput);

    expect(result.balance).toEqual(0);
    expect(typeof result.balance).toBe('number');

    // Verify in database
    const accounts = await db.select()
      .from(accountsTable)
      .where(eq(accountsTable.id, result.id))
      .execute();

    expect(parseFloat(accounts[0].balance)).toEqual(0);
  });

  it('should handle large balance amounts', async () => {
    const largeBalanceInput: CreateAccountInput = {
      name: 'Large Balance Account',
      type: 'BANK',
      balance: 999999999.99
    };

    const result = await createAccount(largeBalanceInput);

    expect(result.balance).toEqual(999999999.99);
    expect(typeof result.balance).toBe('number');

    // Verify precision is maintained in database
    const accounts = await db.select()
      .from(accountsTable)
      .where(eq(accountsTable.id, result.id))
      .execute();

    expect(parseFloat(accounts[0].balance)).toEqual(999999999.99);
  });

  it('should create multiple accounts with unique IDs', async () => {
    const account1 = await createAccount(cashAccountInput);
    const account2 = await createAccount(bankAccountInput);

    expect(account1.id).toBeDefined();
    expect(account2.id).toBeDefined();
    expect(account1.id).not.toEqual(account2.id);

    // Verify both exist in database
    const allAccounts = await db.select()
      .from(accountsTable)
      .execute();

    expect(allAccounts).toHaveLength(2);
    expect(allAccounts.map(a => a.name)).toContain('Kas Utama');
    expect(allAccounts.map(a => a.name)).toContain('BCA Sekolah');
  });

  it('should handle decimal balance values correctly', async () => {
    const decimalInput: CreateAccountInput = {
      name: 'Decimal Account',
      type: 'CASH',
      balance: 123.45
    };

    const result = await createAccount(decimalInput);

    expect(result.balance).toEqual(123.45);
    expect(typeof result.balance).toBe('number');

    // Verify decimal precision in database
    const accounts = await db.select()
      .from(accountsTable)
      .where(eq(accountsTable.id, result.id))
      .execute();

    expect(parseFloat(accounts[0].balance)).toEqual(123.45);
  });
});