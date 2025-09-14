import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { fundPositionsTable } from '../db/schema';
import { getFundPositions } from '../handlers/get_fund_positions';

describe('getFundPositions', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should return empty array when no fund positions exist', async () => {
    const result = await getFundPositions();

    expect(result).toEqual([]);
  });

  it('should fetch all fund positions with correct data types', async () => {
    // Create test fund positions
    await db.insert(fundPositionsTable).values([
      {
        name: 'Kas Umum',
        description: 'Dana operasional sekolah',
        balance: '1500000.50'
      },
      {
        name: 'Dana BOS',
        description: 'Bantuan Operasional Sekolah',
        balance: '2000000.75'
      },
      {
        name: 'Dana Pembangunan',
        description: null,
        balance: '500000.00'
      }
    ]).execute();

    const result = await getFundPositions();

    expect(result).toHaveLength(3);

    // Verify data types and content
    result.forEach(fundPosition => {
      expect(fundPosition.id).toBeTypeOf('number');
      expect(fundPosition.name).toBeTypeOf('string');
      expect(fundPosition.balance).toBeTypeOf('number');
      expect(fundPosition.created_at).toBeInstanceOf(Date);
      expect(fundPosition.updated_at).toBeInstanceOf(Date);
    });

    // Verify specific fund position details
    const kasUmum = result.find(fp => fp.name === 'Kas Umum');
    expect(kasUmum).toBeDefined();
    expect(kasUmum!.description).toBe('Dana operasional sekolah');
    expect(kasUmum!.balance).toBe(1500000.50);

    const danaBOS = result.find(fp => fp.name === 'Dana BOS');
    expect(danaBOS).toBeDefined();
    expect(danaBOS!.description).toBe('Bantuan Operasional Sekolah');
    expect(danaBOS!.balance).toBe(2000000.75);

    const danaPembangunan = result.find(fp => fp.name === 'Dana Pembangunan');
    expect(danaPembangunan).toBeDefined();
    expect(danaPembangunan!.description).toBeNull();
    expect(danaPembangunan!.balance).toBe(500000.00);
  });

  it('should return fund positions ordered by creation date (newest first)', async () => {
    // Create fund positions with slight time gaps
    await db.insert(fundPositionsTable).values({
      name: 'First Fund',
      description: 'Created first',
      balance: '1000.00'
    }).execute();

    // Small delay to ensure different timestamps
    await new Promise(resolve => setTimeout(resolve, 10));

    await db.insert(fundPositionsTable).values({
      name: 'Second Fund',
      description: 'Created second',
      balance: '2000.00'
    }).execute();

    await new Promise(resolve => setTimeout(resolve, 10));

    await db.insert(fundPositionsTable).values({
      name: 'Third Fund',
      description: 'Created third',
      balance: '3000.00'
    }).execute();

    const result = await getFundPositions();

    expect(result).toHaveLength(3);
    
    // Should be ordered by creation date descending (newest first)
    expect(result[0].name).toBe('Third Fund');
    expect(result[1].name).toBe('Second Fund');
    expect(result[2].name).toBe('First Fund');

    // Verify timestamps are in descending order
    expect(result[0].created_at.getTime()).toBeGreaterThan(result[1].created_at.getTime());
    expect(result[1].created_at.getTime()).toBeGreaterThan(result[2].created_at.getTime());
  });

  it('should handle fund positions with zero balance correctly', async () => {
    await db.insert(fundPositionsTable).values([
      {
        name: 'Empty Fund',
        description: 'Fund with zero balance',
        balance: '0.00'
      },
      {
        name: 'Negative Fund',
        description: 'Fund with negative balance',
        balance: '-500.25'
      }
    ]).execute();

    const result = await getFundPositions();

    expect(result).toHaveLength(2);

    const emptyFund = result.find(fp => fp.name === 'Empty Fund');
    expect(emptyFund).toBeDefined();
    expect(emptyFund!.balance).toBe(0);

    const negativeFund = result.find(fp => fp.name === 'Negative Fund');
    expect(negativeFund).toBeDefined();
    expect(negativeFund!.balance).toBe(-500.25);
  });

  it('should handle large numbers correctly', async () => {
    await db.insert(fundPositionsTable).values({
      name: 'Large Fund',
      description: 'Fund with large balance',
      balance: '999999999999.99'
    }).execute();

    const result = await getFundPositions();

    expect(result).toHaveLength(1);
    expect(result[0].balance).toBe(999999999999.99);
    expect(typeof result[0].balance).toBe('number');
  });

  it('should handle fund positions with minimal data', async () => {
    // Create fund position with only required fields
    await db.insert(fundPositionsTable).values({
      name: 'Minimal Fund',
      description: null, // nullable field
      // balance will default to '0'
    }).execute();

    const result = await getFundPositions();

    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Minimal Fund');
    expect(result[0].description).toBeNull();
    expect(result[0].balance).toBe(0);
    expect(result[0].created_at).toBeInstanceOf(Date);
    expect(result[0].updated_at).toBeInstanceOf(Date);
  });
});