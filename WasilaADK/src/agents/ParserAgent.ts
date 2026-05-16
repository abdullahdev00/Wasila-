import { LlmAgent, InMemoryRunner } from '@google/adk';
import * as dotenv from 'dotenv';
dotenv.config();

/**
 * Professional Intent Parser Agent using Official Google ADK
 */
export class ParserAgent {
  private runner: InMemoryRunner;

  constructor() {
    const agent = new LlmAgent({
      name: 'WasilaParser',
      description: 'Parses multilingual user queries into structured intents.',
      model: 'gemini-2.5-flash',
      instruction: `
        You are the Intent Parser for Wasila. 
        Extract the following fields from the user's query:
        - category (e.g., Plumber, Electrician, AC Mechanic, Maths Tutor, Painter, Carpenter)
        - action (search, book, dispute)
        - confidence (0-100)
        
        Return ONLY a JSON object.
      `
    });

    this.runner = new InMemoryRunner({
      appName: 'WasilaOrchestrator',
      agent: agent
    });
  }

  async parse(query: string) {
    let resultText = "";

    try {
      const events = this.runner.runEphemeral({
        userId: 'hackathon-tester',
        newMessage: { role: 'user', parts: [{ text: query }] }
      });

      for await (const event of events) {
        if (event.errorCode) {
          throw new Error(`API Error ${event.errorCode}: ${event.errorMessage}`);
        }
        if (event.content && event.content.parts && event.author !== 'user') {
          resultText += event.content.parts[0]?.text || "";
        }
      }

      // Professional JSON Extraction
      const cleanJsonStr = resultText.replace(/```json/g, "").replace(/```/g, "").trim();
      return JSON.parse(cleanJsonStr || '{"category": null, "action": null, "confidence": 0}');
    } catch (error: any) {
      console.error('Parser Run Error:', error.message);
      return { category: null, error: error.message };
    }
  }
}
