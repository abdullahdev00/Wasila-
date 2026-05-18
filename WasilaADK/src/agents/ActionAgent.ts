import { callOpenRouter } from '../utils/openRouter';
import { createBooking } from '../firebase';

/**
 * Action Agent using OpenRouter & Direct Firebase Mutations
 */
export class ActionAgent {
  async executeBooking(userConfirmation: string, providerDetails: any) {
    try {
      const providerId = providerDetails.providerId;
      const userId = providerDetails.userId || 'guest';
      
      console.log(`\n[ActionAgent] Programmatically creating booking in Firebase for provider '${providerId}'...`);
      const bookingId = await createBooking(userId, providerId, { notes: userConfirmation });
      console.log(`[ActionAgent] Created booking ID: ${bookingId}`);

      const instruction = `
        You are the Action Executer for Wasila.
        A service provider has just been successfully booked for the user!
        Generate a highly friendly, professional booking confirmation message in Roman Urdu or Urdu.
        Mention that their booking has been successfully saved.
      `;

      const promptText = `
        User Confirmation Message: "${userConfirmation}"
        Booking Details:
        - Booking ID: "${bookingId}"
        - Provider ID: "${providerId}"
        - User ID: "${userId}"
      `;

      const responseText = await callOpenRouter(instruction, promptText);
      
      return { 
        status: "success", 
        bookingId: bookingId, 
        message: responseText.trim() || `Aap ki booking mukammal ho gayi hai! Booking ID: ${bookingId}` 
      };
    } catch (error: any) {
      console.error('Action Run Error:', error.message);
      return { status: "error", message: `Maazrat, booking create nahi ho saki: ${error.message}` };
    }
  }
}
