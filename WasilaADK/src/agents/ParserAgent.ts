import { callOpenRouter } from '../utils/openRouter';

/**
 * Intent Parser Agent using OpenRouter
 */
export class ParserAgent {
  async parse(query: string) {
    const instruction = `
      You are the Intent Parser for Wasila. 
      Extract the following fields from the user's query AND the chat history context:
      - category: The specific professional service category the user needs (e.g., "Plumber", "AC Technician", "Electrician", "Gardener"). IMPORTANT: If the user describes a problem (e.g., "nalka kharab hogya", "AC chalu nahi ho raha", "wire toot gayi"), you MUST intelligently guess the correct professional category (e.g., "Plumber" for nalka/water issues, "Electrician" for wires, "Repair" for AC) and return that category. Do NOT return the problem description as the category. Also, if the chat history mentions a specific category (e.g., AI asked "Aapko plumber chahiye?" and user said "G"), you MUST return that category. If no category can be guessed or found, return null.
      - action (search, book, dispute, view_bookings, chat, cancel). 
        * Set action to 'view_bookings' if the user is asking to view, list, check, or inquire about their booked services, scheduled jobs, active bookings, or past orders (e.g., "meri bookings dikhao", "mery kya orders hain", "show my bookings", "check my services", "booking check krna").
        * Set action to 'book' if the user wants to book or hire a service provider (e.g. "book kr do", "Ac technician book kr do", "booking kar do"), confirms a booking, provides scheduling time/date (e.g. "Tomorrow 5 PM", "shaam 5 baje", "kal do baje"), says "book it", "confirm booking", "yes", "kar do", "theek hai", "yes please", or gives any affirmative/confirmation response (like "hmm", "haan", "ji", "ok", "chalo", "done", "proceed", "go ahead", "sure") ESPECIALLY when the recent chat history shows that the AI previously suggested/asked about booking a provider or asked for the booking time. IMPORTANT EXCLUSION: Do NOT set action to 'book' if the user is proposing a price, asking for a discount, or bargaining (e.g. "1000 me krdo", "100 discount do please"), even if they use affirmative words like "krdo" or "kar do". In these cases, the action must remain 'search'.
        * Set action to 'cancel' if the user requests to cancel, terminate, delete, abort, or end a booking/reservation, or says something like "booking cancel kr do", "cancel booking", "booking khatam kr do", "cancel my order", "cancel kr do".
        * Set action to 'chat' if the user is having casual conversation, greeting, asking "how are you", or making small talk that is NOT related to any service request. Examples: "hello", "ksy ho", "thanks", "shukriya".
        * Otherwise set it to 'search'.
      - dateTime: A string representing any date or time mentioned by the user for scheduling/booking (e.g., "Tomorrow, 3:00 PM", "Today, 5:00 PM"). If the user says "3 bjy" or "teen baje", map it to a standard time like "3:00 PM". If the user did not specify any date/time, return null.
      - location: Any location, city, sector, area, or address details mentioned by the user in their query. If the user did not specify any location/address, return null.
      - proposedPrice: Any specific price, discount, or budget proposed, bid, or requested by the user in their current user message (e.g., if user says "1100 rupee krdo please", "1000 main kr do", "rs 800", "900 pkr", return 1100, 1000, 800, 900 respectively as a number). IMPORTANT: Only extract this price if it is explicitly proposed, bid, or requested in the latest user message. If a price was proposed in the recent chat history but NOT in the current user message, you MUST return null.
      - confidence (0-100)

      IMPORTANT: Pay close attention to the [Recent Chat History]. If the AI just asked "should I book X for you?" or offered a service match, and the user responds with ANY short confirmation (even just "hmm", "ok", "haan", "ji"), that means action should be "book".
      
      Return ONLY a JSON object: {"category": string | null, "action": string | null, "dateTime": string | null, "location": string | null, "proposedPrice": number | null, "confidence": number}
    `;

    try {
      const responseText = await callOpenRouter(instruction, query, { isJson: true });
      const cleanJsonStr = responseText.replace(/```json/g, "").replace(/```/g, "").trim();
      const parsed = JSON.parse(cleanJsonStr || '{"category": null, "action": null, "dateTime": null, "location": null, "proposedPrice": null, "confidence": 0}');
      if (parsed.category) {
        // Remove leading/trailing colons, spaces, and punctuation
        parsed.category = parsed.category.replace(/^[:\s\p{P}]+|[:\s\p{P}]+$/gu, "").trim();
      }

      // Build dynamic thinking from actual parsed values — not hardcoded
      const thinkingParts: string[] = [];
      if (parsed.category) thinkingParts.push(`Category detected: ${parsed.category}`);
      if (parsed.action) thinkingParts.push(`Action: ${parsed.action}`);
      if (parsed.dateTime) thinkingParts.push(`Time: ${parsed.dateTime}`);
      if (parsed.location) thinkingParts.push(`Location: ${parsed.location}`);
      if (parsed.proposedPrice) thinkingParts.push(`Proposed price: Rs. ${parsed.proposedPrice}`);
      thinkingParts.push(`Confidence: ${parsed.confidence ?? 0}%`);
      parsed.thinking = thinkingParts.join(' | ');

      return parsed;
    } catch (error: any) {
      console.error('Parser Run Error:', error.message);
      return { category: null, action: null, dateTime: null, location: null, proposedPrice: null, confidence: 0, thinking: 'Failed to parse intent.', error: error.message };
    }
  }
}
