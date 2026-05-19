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
      const dateTime = providerDetails.dateTime || null;
      
      console.log(`\n[ActionAgent] Programmatically creating booking in Firebase for provider '${providerId}' at time: ${dateTime || 'default'}...`);
      const bookingId = await createBooking(userId, providerId, { 
        notes: userConfirmation, 
        date: dateTime 
      });
      console.log(`[ActionAgent] Created booking ID: ${bookingId}`);

      const instruction = `
        You are the Action Executer for Wasila.
        A service provider has just been successfully booked for the user!
        Generate a highly friendly, professional booking confirmation message.
        - You MUST respond in the EXACT same language and writing script that the user wrote their confirmation message in.
        - If the user wrote in Roman Urdu (English alphabet, e.g., "book krdo", "shaam me"), you MUST reply in 100% pure Roman Urdu (using English letters only). NEVER mix Urdu Nastaliq characters or Arabic characters inside a Roman Urdu response.
        - If the user wrote in Urdu script (Nastaliq), reply in 100% Urdu Nastaliq script.
        - If the user wrote in English, reply in 100% English.
        - Mention that their booking has been successfully saved, and include the Booking ID, Provider ID, and User ID.
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
