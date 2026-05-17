import { LlmAgent, InMemoryRunner } from '@google/adk';
import { runEphemeralWithRetry } from '../utils/retryHelper.js';
import * as dotenv from 'dotenv';
dotenv.config();

/**
 * Concierge Agent using Official Google ADK
 * Generates the final friendly response in Roman Urdu / Urdu.
 */
export class ConciergeAgent {
  private runner: InMemoryRunner;

  constructor() {
    const agent = new LlmAgent({
      name: 'WasilaConcierge',
      description: 'Generates user-friendly natural language responses.',
      model: 'gemini-2.5-flash',
      instruction: `
        You are the friendly customer concierge for "Wasila".
        Based on the current context, reply to the user in friendly Urdu or Roman Urdu.
        No hardcoded strings. No emojis.
      `
    });

    this.runner = new InMemoryRunner({
      appName: 'WasilaOrchestrator',
      agent: agent
    });
  }

  async reply(query: string, state: any) {
    let resultText = "";
    const contextStr = `
      User Query: "${query}"
      Match Found: ${state.bestMatch ? state.bestMatch.name : 'None'}
      Status: ${state.bookingStatus || 'Searching'}
    `;

    try {
      resultText = await runEphemeralWithRetry(this.runner, {
        userId: 'hackathon-tester',
        newMessage: { role: 'user', parts: [{ text: contextStr }] }
      });

      return { reply: resultText.trim() || "Mujhe aapki baat samajh nahi aayi, bara-e-meharbani dobara koshish karein." };
    } catch (error: any) {
      console.error('Concierge Run Error:', error.message);
      
      // Dynamic fallback that bypasses the quota error and remains extremely helpful
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
