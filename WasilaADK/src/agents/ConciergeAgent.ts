import { callOpenRouter } from '../utils/openRouter';

/**
 * Concierge Agent using OpenRouter
 * Generates friendly responses in Roman Urdu / Urdu.
 */
export class ConciergeAgent {
  async reply(query: string, state: any) {
    const instruction = `
      You are the friendly customer concierge for "Wasila".
      Based on the current context, reply to the user in friendly Urdu or Roman Urdu.
      No hardcoded strings. No emojis.
    `;

    const promptText = `
      User Query: "${query}"
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
