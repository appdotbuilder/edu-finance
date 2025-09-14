import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { fundPositionsTable } from '../db/schema';
import { type CreateFundPositionInput } from '../schema';
import { createFundPosition } from '../handlers/create_fund_position';
import { eq } from 'drizzle-orm';

// Test input with all fields
const testInput: CreateFundPositionInput = {
  name: 'Dana BOS',
  description: 'Dana Bantuan Operasional Sekolah',
  balance: 50000000
};

// Test input with minimal required fields
const minimalInput: CreateFundPositionInput = {
  name: 'Uang Gedung'
};

describe('createFundPosition', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should create a fund position with all fields', async () => {
    const result = await createFundPosition(testInput);

    // Basic field validation
    expect(result.name).toEqual('Dana BOS');
    expect(result.description).toEqual('Dana Bantuan Operasional Sekolah');
    expect(result.balance).toEqual(50000000);
    expect(typeof result.balance).toBe('number');
    expect(result.id).toBeDefined();
    expect(result.created_at).toBeInstanceOf(Date);
    expect(result.updated_at).toBeInstanceOf(Date);
  });

  it('should create a fund position with minimal fields', async () => {
    const result = await createFundPosition(minimalInput);

    expect(result.name).toEqual('Uang Gedung');
    expect(result.description).toBeNull();
    expect(result.balance).toEqual(0);
    expect(typeof result.balance).toBe('number');
    expect(result.id).toBeDefined();
    expect(result.created_at).toBeInstanceOf(Date);
    expect(result.updated_at).toBeInstanceOf(Date);
  });

  it('should save fund position to database correctly', async () => {
    const result = await createFundPosition(testInput);

    // Query using proper drizzle syntax
    const fundPositions = await db.select()
      .from(fundPositionsTable)
      .where(eq(fundPositionsTable.id, result.id))
      .execute();

    expect(fundPositions).toHaveLength(1);
    const savedPosition = fundPositions[0];
    expect(savedPosition.name).toEqual('Dana BOS');
    expect(savedPosition.description).toEqual('Dana Bantuan Operasional Sekolah');
    expect(parseFloat(savedPosition.balance)).toEqual(50000000);
    expect(savedPosition.created_at).toBeInstanceOf(Date);
    expect(savedPosition.updated_at).toBeInstanceOf(Date);
  });

  it('should handle zero balance correctly', async () => {
    const zeroBalanceInput: CreateFundPositionInput = {
      name: 'Emergency Fund',
      balance: 0
    };

    const result = await createFundPosition(zeroBalanceInput);

    expect(result.balance).toEqual(0);
    expect(typeof result.balance).toBe('number');

    // Verify in database
    const fundPositions = await db.select()
      .from(fundPositionsTable)
      .where(eq(fundPositionsTable.id, result.id))
      .execute();

    expect(parseFloat(fundPositions[0].balance)).toEqual(0);
  });

  it('should handle large balance amounts', async () => {
    const largeBalanceInput: CreateFundPositionInput = {
      name: 'Major Development Fund',
      description: 'Large infrastructure fund',
      balance: 999999999999.99
    };

    const result = await createFundPosition(largeBalanceInput);

    expect(result.balance).toEqual(999999999999.99);
    expect(typeof result.balance).toBe('number');

    // Verify in database
    const fundPositions = await db.select()
      .from(fundPositionsTable)
      .where(eq(fundPositionsTable.id, result.id))
      .execute();

    expect(parseFloat(fundPositions[0].balance)).toEqual(999999999999.99);
  });

  it('should create multiple fund positions with unique names', async () => {
    const input1: CreateFundPositionInput = {
      name: 'Dana BOS',
      balance: 10000000
    };

    const input2: CreateFundPositionInput = {
      name: 'Dana Komite',
      balance: 5000000
    };

    const result1 = await createFundPosition(input1);
    const result2 = await createFundPosition(input2);

    expect(result1.id).not.toEqual(result2.id);
    expect(result1.name).toEqual('Dana BOS');
    expect(result2.name).toEqual('Dana Komite');
    expect(result1.balance).toEqual(10000000);
    expect(result2.balance).toEqual(5000000);

    // Verify both exist in database
    const allFundPositions = await db.select()
      .from(fundPositionsTable)
      .execute();

    expect(allFundPositions).toHaveLength(2);
    
    const names = allFundPositions.map(fp => fp.name).sort();
    expect(names).toEqual(['Dana BOS', 'Dana Komite']);
  });

  it('should handle special characters in name and description', async () => {
    const specialInput: CreateFundPositionInput = {
      name: 'Dana R&D (Riset & Pengembangan)',
      description: 'Fund untuk riset & pengembangan teknologi 100% digital',
      balance: 1234.56
    };

    const result = await createFundPosition(specialInput);

    expect(result.name).toEqual('Dana R&D (Riset & Pengembangan)');
    expect(result.description).toEqual('Fund untuk riset & pengembangan teknologi 100% digital');
    expect(result.balance).toEqual(1234.56);

    // Verify in database
    const fundPositions = await db.select()
      .from(fundPositionsTable)
      .where(eq(fundPositionsTable.id, result.id))
      .execute();

    expect(fundPositions[0].name).toEqual('Dana R&D (Riset & Pengembangan)');
    expect(fundPositions[0].description).toEqual('Fund untuk riset & pengembangan teknologi 100% digital');
  });
});