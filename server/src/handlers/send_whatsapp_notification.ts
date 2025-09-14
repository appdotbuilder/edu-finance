import { db } from '../db';
import { whatsappNotificationsTable } from '../db/schema';
import { type SendWhatsappNotificationInput, type WhatsappNotification } from '../schema';

export const sendWhatsappNotification = async (input: SendWhatsappNotificationInput): Promise<WhatsappNotification> => {
  try {
    // Insert WhatsApp notification record
    const result = await db.insert(whatsappNotificationsTable)
      .values({
        phone: input.phone,
        message: input.message,
        type: input.type,
        status: 'PENDING', // Default status for new notifications
        sent_at: null // Will be updated when actually sent
      })
      .returning()
      .execute();

    const notification = result[0];
    
    return {
      ...notification,
      sent_at: notification.sent_at // already nullable, no conversion needed
    };
  } catch (error) {
    console.error('WhatsApp notification creation failed:', error);
    throw error;
  }
};