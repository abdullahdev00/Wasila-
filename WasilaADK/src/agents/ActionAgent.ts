import { callOpenRouter } from '../utils/openRouter';
import { createBooking, cancelBooking, fetchUserBookings } from '../firebase';

/**
 * Action Agent using OpenRouter & Direct Firebase Mutations
 */
export class ActionAgent {
  async executeBooking(userConfirmation: string, providerDetails: any) {
    try {
      const providerId = providerDetails.providerId;
      const userId = providerDetails.userId || 'guest';
      const dateTime = providerDetails.dateTime || null;
      const price = providerDetails.price || null;
      
      console.log(`\n[ActionAgent] Programmatically creating booking in Firebase for provider '${providerId}' at time: ${dateTime || 'default'} with price: ${price}...`);
      const bookingId = await createBooking(userId, providerId, { 
        notes: userConfirmation, 
        date: dateTime,
        price: price
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
        message: responseText.trim() || `Aap ki booking mukammal ho gayi hai! Booking ID: ${bookingId}`,
        thinking: `Booking created | Provider: ${providerId} | User: ${userId} | Time: ${dateTime || 'default'} | Price: ${price ? 'Rs. ' + price : 'standard'} | ID: ${bookingId}`
      };
    } catch (error: any) {
      console.error('Action Run Error:', error.message);
      return { status: "error", message: `Maazrat, booking create nahi ho saki: ${error.message}`, thinking: `Error: ${error.message}` };
    }
  }

  async executeCancellation(userQuery: string, details: any) {
    try {
      const userId = details.userId || 'guest';
      const category = details.category || null;

      console.log(`\n[ActionAgent] Fetching bookings for user ${userId} to cancel...`);
      const bookings = await fetchUserBookings(userId);
      
      // Filter bookings that are not already cancelled
      const activeBookings = bookings.filter(b => b.status !== 'cancelled' && b.status !== 'rejected');
      
      if (activeBookings.length === 0) {
        return {
          status: "no_active_bookings",
          message: "Aap ki koi active ya pending booking nahi mili jisey cancel kiya ja sake."
        };
      }

      let bookingToCancel = null;

      if (activeBookings.length === 1) {
        // Only one active booking, cancel it directly
        bookingToCancel = activeBookings[0];
      } else {
        // Multiple bookings. Let LLM decide which booking the user wants to cancel
        const instruction = `
          You are the Booking Selector for Wasila.
          Analyze the user's query and select the booking ID they wish to cancel.
          Return ONLY a JSON object: {"bookingId": "string" | null, "reason": "reasoning"}
        `;
        const promptText = `
          User Query: "${userQuery}"
          Active Bookings: ${JSON.stringify(activeBookings, null, 2)}
        `;
        const responseText = await callOpenRouter(instruction, promptText, { isJson: true });
        const match = responseText.match(/\{[\s\S]*\}/);
        const choice = JSON.parse(match ? match[0] : '{"bookingId": null}');
        if (choice.bookingId) {
          bookingToCancel = activeBookings.find(b => b.id === choice.bookingId) || null;
        }
        if (!bookingToCancel) {
          // Default to the most recent booking if LLM choice fails
          bookingToCancel = activeBookings[0];
        }
      }

      console.log(`[ActionAgent] Selected booking for cancellation:`, bookingToCancel);
      await cancelBooking(bookingToCancel.id);

      const instruction = `
        You are the Action Executer for Wasila.
        A booking has just been successfully CANCELLED for the user.
        Generate a friendly cancellation confirmation message.
        - You MUST respond in the EXACT same language and writing script that the user wrote their query in (Urdu/Roman Urdu/English).
        - If Roman Urdu, use English alphabet only.
        - Mention the service name ("${bookingToCancel.serviceName}") and that it has been successfully cancelled.
      `;
      const promptText = `
        User Query: "${userQuery}"
        Cancelled Booking details:
        - Booking ID: "${bookingToCancel.id}"
        - Service: "${bookingToCancel.serviceName}"
        - Provider: "${bookingToCancel.providerName}"
      `;
      const responseText = await callOpenRouter(instruction, promptText);

      return {
        status: "success",
        bookingId: bookingToCancel.id,
        message: responseText.trim() || `Aap ki booking (${bookingToCancel.serviceName}) cancel ho gayi hai.`,
        thinking: `Cancelled booking | Service: ${bookingToCancel.serviceName} | Provider: ${bookingToCancel.providerName} | Booking ID: ${bookingToCancel.id}`
      };
    } catch (error: any) {
      console.error('Cancellation Action Error:', error.message);
      return { status: "error", message: `Maazrat, booking cancel nahi ho saki: ${error.message}`, thinking: `Error during cancellation: ${error.message}` };
    }
  }
}
