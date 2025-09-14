import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { whatsappNotificationsTable } from '../db/schema';
import { type SendWhatsappNotificationInput } from '../schema';
import { sendWhatsappNotification } from '../handlers/send_whatsapp_notification';
import { eq, and } from 'drizzle-orm';

// Test inputs for different notification types
const billReminderInput: SendWhatsappNotificationInput = {
  phone: '+628123456789',
  message: 'Reminder: SPP payment for January 2024 is due. Amount: Rp 500,000',
  type: 'BILL_REMINDER'
};

const paymentConfirmationInput: SendWhatsappNotificationInput = {
  phone: '+628987654321',
  message: 'Payment confirmed: SPP January 2024 - Rp 500,000. Thank you!',
  type: 'PAYMENT_CONFIRMATION'
};

const announcementInput: SendWhatsappNotificationInput = {
  phone: '+628111222333',
  message: 'School announcement: Parent meeting scheduled for next Friday at 2 PM.',
  type: 'ANNOUNCEMENT'
};

describe('sendWhatsappNotification', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should create a bill reminder notification', async () => {
    const result = await sendWhatsappNotification(billReminderInput);

    // Basic field validation
    expect(result.phone).toEqual('+628123456789');
    expect(result.message).toEqual('Reminder: SPP payment for January 2024 is due. Amount: Rp 500,000');
    expect(result.type).toEqual('BILL_REMINDER');
    expect(result.status).toEqual('PENDING');
    expect(result.sent_at).toBeNull();
    expect(result.id).toBeDefined();
    expect(typeof result.id).toBe('number');
    expect(result.created_at).toBeInstanceOf(Date);
  });

  it('should create a payment confirmation notification', async () => {
    const result = await sendWhatsappNotification(paymentConfirmationInput);

    // Validate payment confirmation specific fields
    expect(result.phone).toEqual('+628987654321');
    expect(result.message).toEqual('Payment confirmed: SPP January 2024 - Rp 500,000. Thank you!');
    expect(result.type).toEqual('PAYMENT_CONFIRMATION');
    expect(result.status).toEqual('PENDING');
    expect(result.sent_at).toBeNull();
    expect(result.id).toBeDefined();
    expect(result.created_at).toBeInstanceOf(Date);
  });

  it('should create an announcement notification', async () => {
    const result = await sendWhatsappNotification(announcementInput);

    // Validate announcement specific fields
    expect(result.phone).toEqual('+628111222333');
    expect(result.message).toEqual('School announcement: Parent meeting scheduled for next Friday at 2 PM.');
    expect(result.type).toEqual('ANNOUNCEMENT');
    expect(result.status).toEqual('PENDING');
    expect(result.sent_at).toBeNull();
    expect(result.id).toBeDefined();
    expect(result.created_at).toBeInstanceOf(Date);
  });

  it('should save notification to database', async () => {
    const result = await sendWhatsappNotification(billReminderInput);

    // Query database to verify record was saved
    const notifications = await db.select()
      .from(whatsappNotificationsTable)
      .where(eq(whatsappNotificationsTable.id, result.id))
      .execute();

    expect(notifications).toHaveLength(1);
    const savedNotification = notifications[0];
    
    expect(savedNotification.phone).toEqual('+628123456789');
    expect(savedNotification.message).toEqual('Reminder: SPP payment for January 2024 is due. Amount: Rp 500,000');
    expect(savedNotification.type).toEqual('BILL_REMINDER');
    expect(savedNotification.status).toEqual('PENDING');
    expect(savedNotification.sent_at).toBeNull();
    expect(savedNotification.created_at).toBeInstanceOf(Date);
  });

  it('should handle multiple notifications for same phone number', async () => {
    const firstResult = await sendWhatsappNotification(billReminderInput);
    const secondResult = await sendWhatsappNotification({
      ...billReminderInput,
      message: 'Second reminder: SPP payment overdue'
    });

    // Both notifications should be created successfully
    expect(firstResult.id).not.toEqual(secondResult.id);
    expect(firstResult.phone).toEqual(secondResult.phone);
    expect(firstResult.message).not.toEqual(secondResult.message);

    // Verify both records exist in database
    const notifications = await db.select()
      .from(whatsappNotificationsTable)
      .where(eq(whatsappNotificationsTable.phone, '+628123456789'))
      .execute();

    expect(notifications).toHaveLength(2);
    expect(notifications[0].status).toEqual('PENDING');
    expect(notifications[1].status).toEqual('PENDING');
  });

  it('should query notifications by type and status correctly', async () => {
    // Create notifications of different types
    await sendWhatsappNotification(billReminderInput);
    await sendWhatsappNotification(paymentConfirmationInput);
    await sendWhatsappNotification(announcementInput);

    // Query only bill reminders
    const billReminders = await db.select()
      .from(whatsappNotificationsTable)
      .where(
        and(
          eq(whatsappNotificationsTable.type, 'BILL_REMINDER'),
          eq(whatsappNotificationsTable.status, 'PENDING')
        )
      )
      .execute();

    expect(billReminders).toHaveLength(1);
    expect(billReminders[0].type).toEqual('BILL_REMINDER');
    expect(billReminders[0].message).toContain('SPP payment for January 2024');

    // Query all pending notifications
    const pendingNotifications = await db.select()
      .from(whatsappNotificationsTable)
      .where(eq(whatsappNotificationsTable.status, 'PENDING'))
      .execute();

    expect(pendingNotifications).toHaveLength(3);
    pendingNotifications.forEach(notification => {
      expect(notification.status).toEqual('PENDING');
      expect(notification.sent_at).toBeNull();
    });
  });

  it('should handle long messages correctly', async () => {
    const longMessageInput: SendWhatsappNotificationInput = {
      phone: '+628555666777',
      message: 'This is a very long notification message that contains detailed information about multiple payment items including SPP, building fund, examination fees, uniform costs, book fees, study tour, and savings account details for the current academic year 2024.',
      type: 'ANNOUNCEMENT'
    };

    const result = await sendWhatsappNotification(longMessageInput);

    expect(result.message).toEqual(longMessageInput.message);
    expect(result.message.length).toBeGreaterThan(100);
    expect(result.type).toEqual('ANNOUNCEMENT');
    expect(result.status).toEqual('PENDING');
  });

  it('should handle international phone number formats', async () => {
    const internationalInput: SendWhatsappNotificationInput = {
      phone: '+65 9123 4567',
      message: 'International student payment reminder',
      type: 'BILL_REMINDER'
    };

    const result = await sendWhatsappNotification(internationalInput);

    expect(result.phone).toEqual('+65 9123 4567');
    expect(result.type).toEqual('BILL_REMINDER');

    // Verify saved in database
    const notifications = await db.select()
      .from(whatsappNotificationsTable)
      .where(eq(whatsappNotificationsTable.phone, '+65 9123 4567'))
      .execute();

    expect(notifications).toHaveLength(1);
    expect(notifications[0].phone).toEqual('+65 9123 4567');
  });
});