import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { studentsTable, sppCardsTable } from '../db/schema';
import { type GenerateSppCardInput, type CreateStudentInput } from '../schema';
import { generateSppCard } from '../handlers/generate_spp_card';
import { eq } from 'drizzle-orm';

// Test student data
const testStudentInput: CreateStudentInput = {
  nis: 'TEST001',
  name: 'Test Student',
  grade: 'SMA',
  class_name: '12A',
  phone: '081234567890',
  parent_phone: '081234567891',
  address: 'Test Address',
  status: 'ACTIVE'
};

describe('generateSppCard', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  let testStudent: any;

  beforeEach(async () => {
    // Create a test student for each test
    const studentResult = await db.insert(studentsTable)
      .values(testStudentInput)
      .returning()
      .execute();
    testStudent = studentResult[0];
  });

  it('should generate an SPP card for a student', async () => {
    const input: GenerateSppCardInput = {
      student_id: testStudent.id
    };

    const result = await generateSppCard(input);

    // Verify basic properties
    expect(result.id).toBeDefined();
    expect(result.student_id).toEqual(testStudent.id);
    expect(result.barcode).toBeDefined();
    expect(result.barcode).toMatch(/^SPP\d{6}\d+$/); // Format: SPP + 6-digit student ID + timestamp
    expect(result.is_active).toBe(true);
    expect(result.created_at).toBeInstanceOf(Date);
    expect(result.updated_at).toBeInstanceOf(Date);
  });

  it('should save SPP card to database', async () => {
    const input: GenerateSppCardInput = {
      student_id: testStudent.id
    };

    const result = await generateSppCard(input);

    // Verify card was saved to database
    const cards = await db.select()
      .from(sppCardsTable)
      .where(eq(sppCardsTable.id, result.id))
      .execute();

    expect(cards).toHaveLength(1);
    expect(cards[0].student_id).toEqual(testStudent.id);
    expect(cards[0].barcode).toEqual(result.barcode);
    expect(cards[0].is_active).toBe(true);
  });

  it('should generate unique barcodes for different students', async () => {
    // Create another test student
    const anotherStudentInput: CreateStudentInput = {
      nis: 'TEST002',
      name: 'Another Test Student',
      grade: 'SMA',
      class_name: '12B',
      status: 'ACTIVE'
    };

    const anotherStudentResult = await db.insert(studentsTable)
      .values(anotherStudentInput)
      .returning()
      .execute();
    const anotherStudent = anotherStudentResult[0];

    // Generate cards for both students
    const card1 = await generateSppCard({ student_id: testStudent.id });
    const card2 = await generateSppCard({ student_id: anotherStudent.id });

    // Verify barcodes are unique
    expect(card1.barcode).not.toEqual(card2.barcode);
    expect(card1.student_id).toEqual(testStudent.id);
    expect(card2.student_id).toEqual(anotherStudent.id);
  });

  it('should deactivate existing SPP card when generating new one', async () => {
    const input: GenerateSppCardInput = {
      student_id: testStudent.id
    };

    // Generate first SPP card
    const firstCard = await generateSppCard(input);
    expect(firstCard.is_active).toBe(true);

    // Generate second SPP card for same student
    const secondCard = await generateSppCard(input);
    expect(secondCard.is_active).toBe(true);

    // Verify first card is now deactivated
    const firstCardUpdated = await db.select()
      .from(sppCardsTable)
      .where(eq(sppCardsTable.id, firstCard.id))
      .execute();

    expect(firstCardUpdated[0].is_active).toBe(false);

    // Verify second card is still active
    const secondCardUpdated = await db.select()
      .from(sppCardsTable)
      .where(eq(sppCardsTable.id, secondCard.id))
      .execute();

    expect(secondCardUpdated[0].is_active).toBe(true);
  });

  it('should handle multiple existing cards correctly', async () => {
    const input: GenerateSppCardInput = {
      student_id: testStudent.id
    };

    // Create multiple cards manually first
    await db.insert(sppCardsTable)
      .values([
        {
          student_id: testStudent.id,
          barcode: 'SPP000001OLD1',
          is_active: true
        },
        {
          student_id: testStudent.id,
          barcode: 'SPP000001OLD2',
          is_active: true
        }
      ])
      .execute();

    // Generate new card
    const newCard = await generateSppCard(input);

    // Verify all old cards are deactivated
    const allCards = await db.select()
      .from(sppCardsTable)
      .where(eq(sppCardsTable.student_id, testStudent.id))
      .execute();

    const activeCards = allCards.filter(card => card.is_active);
    const inactiveCards = allCards.filter(card => !card.is_active);

    expect(activeCards).toHaveLength(1);
    expect(activeCards[0].id).toEqual(newCard.id);
    expect(inactiveCards).toHaveLength(2);
  });

  it('should throw error for non-existent student', async () => {
    const input: GenerateSppCardInput = {
      student_id: 99999 // Non-existent student ID
    };

    await expect(generateSppCard(input)).rejects.toThrow(/Student with ID 99999 not found/i);
  });

  it('should generate barcode with proper format', async () => {
    const input: GenerateSppCardInput = {
      student_id: testStudent.id
    };

    const result = await generateSppCard(input);

    // Verify barcode format: SPP + padded student ID + timestamp
    const expectedPrefix = `SPP${testStudent.id.toString().padStart(6, '0')}`;
    expect(result.barcode).toMatch(new RegExp(`^${expectedPrefix}\\d+$`));
    
    // Verify the timestamp part is reasonable (within last few seconds)
    const timestampPart = result.barcode.replace(expectedPrefix, '');
    const timestamp = parseInt(timestampPart);
    const now = Date.now();
    expect(timestamp).toBeGreaterThan(now - 5000); // Within 5 seconds
    expect(timestamp).toBeLessThanOrEqual(now);
  });
});