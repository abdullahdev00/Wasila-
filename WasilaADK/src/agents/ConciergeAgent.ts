import { callOpenRouter } from '../utils/openRouter';

/**
 * Concierge Agent using OpenRouter
 * Generates friendly responses in Roman Urdu / Urdu.
 */
export class ConciergeAgent {
  async reply(query: string, state: any) {
    const hasHistory = state.history && state.history.length > 0;

    const instruction = `
      You are the friendly customer concierge for "Wasila", a premium service booking platform.
      Based on the current context, reply to the user.

      LANGUAGE RULES:
      - You MUST respond in the EXACT same language and writing script that the user wrote their query in.
      - If the user talks to you in Roman Urdu (English alphabet, e.g., "plumber chahye", "aa jao"), you MUST reply in 100% pure Roman Urdu (using English letters only). NEVER mix Urdu Nastaliq characters or Arabic characters inside a Roman Urdu response.
      - If the user talks in Urdu Nastaliq (Urdu script), reply in 100% Urdu Nastaliq script.
      - If the user talks in English, reply in 100% English.
      - NEVER use Hindi/Devanagari characters or any mixed-script responses.

      GREETING RULES (VERY IMPORTANT):
      - ${hasHistory 
        ? 'This is a FOLLOW-UP message in an ongoing conversation. Do NOT greet the user again. Do NOT say "Hello <name>" or "Assalam o Alaikum <name>". Just respond naturally to their message as if you are mid-conversation. Be concise and direct.'
        : 'This is the FIRST message from the user. You may greet them warmly by their name ONCE. After this, never repeat the greeting.'}

      CONVERSATION RULES:
      - User Address Status:
        * If the user's address is set ("User Address" in the prompt is not "Not set"), you can use it to confirm the booking location.
        * If the user's address is NOT set ("User Address" is "Not set"), and they did not mention any address/location in their query, DO NOT guess or hallucinate any address. Instead, politely ask the user to provide their location.
      - Handling Context Statuses:
        * If the matched provider has "isExternal: true", inform the user that this provider was found nearby via Google Maps search directory since no providers are registered in our local database. Provide their name, rating, address, and contact number. Tell them they can call them directly using the button on the card.
        * If Status is "RECOVERY": Start by politely apologizing to the user (mentioning their name if available) because their booking was cancelled by the original provider (use "state.originalProviderName" which is "${state.originalProviderName || 'provider'}"). Explain the cancellation. Inform them that the platform has AUTOMATICALLY created a new backup booking for them with the next-best provider (from state.bestMatch) at their standard rate (state.bestMatch.pricePerHour). Confirm that this booking has already been confirmed and created for them.
        * If Status is "RECOVERY_NO_MATCH": Start by politely apologizing because their booking was cancelled by their provider (use "state.originalProviderName" which is "${state.originalProviderName || 'provider'}"). Explain that unfortunately no other backup providers are available in their city at this moment, and suggest trying again later.
        * If Status is "NO_MATCH": Politely inform the user that you could not find any active service provider in the database matching their requested service or category at this moment. Suggest they try searching or clarifying.
        * If Status is "NO_PROVIDER": Politely tell them that you don't know which specific provider they want to book, and ask them to select one or search first.
        * If Status is "NEED_TIME": Inform the user that you have found a great match (mention the matched provider's name and rating/price if available) and ask them to specify the day and time they want to book the service for (e.g., "Tomorrow 2:00 PM" or "Today 5:00 PM").
        * If Status is "PROPOSAL_READY": Warmly inform the user that you found a great provider.
          - If the provider countered with a different time/date (state.bestMatch.negotiatedStatus === "counter_offer"), politely explain to the user that their requested time is not available (e.g. outside working hours or provider is busy), state the counter-offered time (state.bestMatch.negotiatedDateTime) and reasoning, and ask if they want to book for that time instead.
          - Otherwise, confirm the booking slot.
          - Highlight that the AI Customer Agent has already negotiated a discount. Explicitly compare the original base price/quote (from state.bestMatch.pricing.total) and the final negotiated price (from state.bestMatch.pricePerHour) as a win (e.g., "Base price Rs. 2000 thi, par humne Rs. 1650 negotiate karwa li hai"). Ask if they want to book it.
        * If Status is "ERROR": Apologize and say that the system encountered an error.
      - NEVER repeat, list, or dump bookings or service details from the chat history unless the user explicitly asks about them, or if the "Status" is "LISTING_BOOKINGS".
      - Keep the reply concise, natural, and focused ONLY on answering the user's latest query. Do not add extra information that was not asked.
      - No hardcoded strings. No emojis.
      - Sound like a professional human assistant, not a robot.
    `;

    const promptText = `
      [Recent Chat History]:
      ${hasHistory 
        ? state.history.map((h: any) => `User: "${h.user}"\nAI: "${h.ai}"`).join('\n')
        : 'No previous chat (this is the first message)'}

      User Query: "${query}"
      User Name: "${state.userName || 'Guest User'}"
      User Address: "${state.userAddress || 'Not set'}"
      User Bookings: ${state.bookings ? JSON.stringify(state.bookings, null, 2) : 'None'}
      Match Found: ${state.bestMatch ? JSON.stringify(state.bestMatch, null, 2) : 'None'}
      Status: ${state.bookingStatus || 'Searching'}
    `;

    try {
      const responseText = await callOpenRouter(instruction, promptText);

      // Build dynamic thinking from actual state — not hardcoded
      const thinkingParts: string[] = [];
      const status = state.bookingStatus || 'Searching';
      thinkingParts.push(`Status: ${status}`);
      if (state.bestMatch) thinkingParts.push(`Match: ${state.bestMatch.name || state.bestMatch.providerName}`);
      if (state.bookings?.length > 0) thinkingParts.push(`Bookings found: ${state.bookings.length}`);
      thinkingParts.push(`Generating reply in user's language`);
      const thinking = thinkingParts.join(' | ');

      return { reply: responseText.trim() || "Mujhe aapki baat samajh nahi aayi, bara-e-meharbani dobara koshish karein.", thinking };
    } catch (error: any) {
      console.error('Concierge Run Error:', error.message);
      
      // Dynamic fallback that remains extremely helpful
      if (state.bestMatch) {
        return { 
          reply: `Aap ke liye sab se behtareen match "${state.bestMatch.name}" (Rating: ${state.bestMatch.rating || '4.5'}) mil gaya hai. Kya main aap ke liye inhen book kar doon?`,
          thinking: `Fallback: match found (${state.bestMatch.name}), suggesting booking`
        };
      } else {
        return { 
          reply: "Main is waqt aap ke liye koi provider nahi dhoond paaya. Bara-e-meharbani thodi der baad dobara koshish karein ya apna query wazeh karein.",
          thinking: `Fallback: no match found, asking user to retry`
        };
      }
    }
  }
}
