import { callOpenRouter } from '../utils/openRouter';

/**
 * Intent Parser Agent using OpenRouter
 */
export class ParserAgent {
  async parse(query: string) {
    const instruction = `
      You are the Intent Parser for Wasila. 
      Extract the following fields from the user's query and context:
      - category (e.g., Plumber, Electrician, AC Mechanic, Maths Tutor, Painter, Carpenter)
      - action (search, book, dispute, view_bookings). 
        * Set action to 'view_bookings' if the user is asking to view, list, check, or inquire about their booked services, scheduled jobs, active bookings, or past orders (e.g., "meri bookings dikhao", "mery kya orders hain", "show my bookings", "check my services", "booking check krna").
        * Set action to 'book' if the user confirms a booking, wants to hire a provider, says "book it", "confirm booking", "book krdo", "booking kar do", "yes", "kar do", "theek hai", "yes please".
        * Otherwise set it to 'search'.
      - dateTime: A string representing any date or time mentioned by the user for scheduling/booking (e.g., "Tomorrow, 3:00 PM", "Today, 5:00 PM"). If the user says "3 bjy" or "teen baje", map it to a standard time like "3:00 PM" (e.g., "Today, 3:00 PM" or "Tomorrow, 3:00 PM" based on context). If the user did not specify any date/time, return null.
      - confidence (0-100)
      
      Return ONLY a JSON object: {"category": string | null, "action": string | null, "dateTime": string | null, "confidence": number}
    `;

    try {
      const responseText = await callOpenRouter(instruction, query, { isJson: true });
      const cleanJsonStr = responseText.replace(/```json/g, "").replace(/```/g, "").trim();
      const parsed = JSON.parse(cleanJsonStr || '{"category": null, "action": null, "dateTime": null, "confidence": 0}');
      if (parsed.category) {
        // Remove leading/trailing colons, spaces, and punctuation
        parsed.category = parsed.category.replace(/^[:\s\p{P}]+|[:\s\p{P}]+$/gu, "").trim();
      }
      return parsed;
    } catch (error: any) {
      console.error('Parser Run Error:', error.message);
      return { category: null, action: null, confidence: 0, error: error.message };
    }
  }
}
