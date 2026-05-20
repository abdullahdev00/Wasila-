import { callOpenRouter } from '../utils/openRouter';

/**
 * Concierge Agent using OpenRouter
 * Generates friendly responses in Roman Urdu / Urdu.
 */
export class ConciergeAgent {
  async reply(query: string, state: any) {
    const instruction = `
      You are the friendly customer concierge for "Wasila".
      Based on the current context, reply to the user.
      - You MUST respond in the EXACT same language and writing script that the user wrote their query in.
      - If the user talks to you in Roman Urdu (English alphabet, e.g., "plumber chahye", "aa jao"), you MUST reply in 100% pure Roman Urdu (using English letters only). NEVER mix Urdu Nastaliq characters or Arabic characters inside a Roman Urdu response.
      - If the user talks in Urdu Nastaliq (Urdu script), reply in 100% Urdu Nastaliq script.
      - If the user talks in English, reply in 100% English.
      - Greet the user by their name ("User Name" provided in the prompt) if they say hi, hello, or greet you.
      - User Address Status:
        * If the user's address is set ("User Address" in the prompt is not "Not set"), you can use it to confirm the booking location (e.g., "aapke address G-11 par").
        * If the user's address is NOT set ("User Address" is "Not set"), and they did not mention any address/location in their query, DO NOT guess, assume, or hallucinate any address (such as "Karachi" or "Lahore" or "Street 5"). Instead, politely ask the user to provide their address or location so we can set up the booking.
      - NEVER repeat, list, or dump bookings or service details from the chat history or prompt unless the user explicitly asks about them in their current query, or if the "Status" in prompt is "LISTING_BOOKINGS".
      - If the user is just saying hello, hi, greeting you, or saying something simple like "hey", do NOT list or mention their bookings. Simply greet them by their name and ask how you can help them.
      - Keep the reply concise, natural, and focused ONLY on answering the user's latest query. Do not add extra information that was not asked.
      - NEVER use Hindi/Devanagari characters or any mixed-script responses.
      - No hardcoded strings. No emojis.
    `;

    const promptText = `
      [Recent Chat History]:
      ${state.history && state.history.length > 0 
        ? state.history.map((h: any) => `User: "${h.user}"\nAI: "${h.ai}"`).join('\n')
        : 'No previous chat'}

      User Query: "${query}"
      User Name: "${state.userName || 'Guest User'}"
      User Address: "${state.userAddress || 'Not set'}"
      User Bookings: ${state.bookings ? JSON.stringify(state.bookings, null, 2) : 'None'}
      Match Found: ${state.bestMatch ? state.bestMatch.name : 'None'}
      Status: ${state.bookingStatus || 'Searching'}
    `;

    try {
      const responseText = await callOpenRouter(instruction, promptText);
      return { reply: responseText.trim() || "Mujhe aapki baat samajh nahi aayi, bara-e-meharbani dobara koshish karein." };
    } catch (error: any) {
      console.error('Concierge Run Error:', error.message);
      
      // Dynamic fallback that remains extremely helpful
      if (state.bestMatch) {
        return { 
          reply: `Aap ke liye sab se behtareen match "${state.bestMatch.name}" (Rating: ${state.bestMatch.rating || '4.5'}) mil gaya hai. Kya main aap ke liye inhen book kar doon?`
        };
      } else {
        return { 
          reply: "Main is waqt aap ke liye koi provider nahi dhoond paaya. Bara-e-meharbani thodi der baad dobara koshish karein ya apna query wazeh karein." 
        };
      }
    }
  }
}
