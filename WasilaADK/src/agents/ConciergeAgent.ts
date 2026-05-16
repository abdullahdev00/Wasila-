import { LlmAgent, InMemoryRunner } from '@google/adk';
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
      const events = this.runner.runEphemeral({
        userId: 'hackathon-tester',
        newMessage: { role: 'user', parts: [{ text: contextStr }] }
      });

      for await (const event of events) {
        if (event.errorCode) {
          throw new Error(`API Error ${event.errorCode}: ${event.errorMessage}`);
        }
        if (event.content && event.content.parts && event.author !== 'user') {
          resultText += event.content.parts[0]?.text || "";
        }
      }

      return { reply: resultText.trim() || "Mujhe aapki baat samajh nahi aayi, bara-e-meharbani dobara koshish karein." };
    } catch (error: any) {
      console.error('Concierge Run Error:', error.message);
      return { reply: "Maazrat, abhi network traffic bohat zyada hai aur Google AI quota full ho gaya hai. Bara-e-meharbani thori der baad koshish karein." };
    }
  }
}
