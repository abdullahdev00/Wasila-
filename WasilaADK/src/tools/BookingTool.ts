import { FunctionTool } from '@google/adk';
import { z } from 'zod';
import { createBooking } from '../firebase';

/**
 * ADK Tool: Database Booker
 * Empowers agents to autonomously save bookings into Firebase.
 */
export const bookingTool = new FunctionTool({
  name: 'book_service_provider',
  description: 'Creates a new booking record in the Firebase database for a specific service provider.',
  parameters: z.object({
    providerId: z.string().describe('The unique ID of the service provider to book.'),
    userId: z.string().describe('The ID of the user requesting the booking.'),
    notes: z.string().describe('Any specific instructions or notes from the user for this booking.'),
  }),
  execute: async ({ providerId, userId, notes }) => {
    try {
      console.log(`\n[Booking Tool] Initiating booking for provider '${providerId}'...`);
      const bookingId = await createBooking(userId, providerId, { notes });
      
      console.log(`[Booking Tool] Successfully created booking ID: ${bookingId}`);
      return { 
        status: 'success', 
        bookingId: bookingId,
        message: 'Booking confirmed and saved to database.' 
      };
    } catch (error: any) {
      console.error("[Booking Tool] Error:", error.message);
      return { status: 'error', message: error.message };
    }
  },
});
