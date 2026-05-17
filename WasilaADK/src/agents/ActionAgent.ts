import { LlmAgent, InMemoryRunner } from '@google/adk';
import { runEphemeralWithRetry } from '../utils/retryHelper.js';
import { bookingTool } from '../tools/BookingTool.js';
import * as dotenv from 'dotenv';
dotenv.config();

/**
 * Action Agent using Official Google ADK
 * Equipped with BookingTool to modify the database.
 */
export class ActionAgent {
  private runner: InMemoryRunner;

  constructor() {
    const agent = new LlmAgent({
      name: 'WasilaAction',
      description: 'Executes final actions like booking a service provider.',
      model: 'gemini-2.5-flash',
      tools: [bookingTool], // Injecting the Booking Tool
      instruction: `
        You are the Action Executer for Wasila.
        If the user confirms they want to proceed with a provider, use the 'book_service_provider' tool.
        Return ONLY a JSON object: {"status": "success/error", "bookingId": "string", "message": "friendly confirmation"}
      `
    });

    this.runner = new InMemoryRunner({
      appName: 'WasilaOrchestrator',
      agent: agent
    });
  }

  async executeBooking(userConfirmation: string, providerDetails: any) {
    let resultText = "";
    const payload = `User Message: "${userConfirmation}"\nProvider Info: ${JSON.stringify(providerDetails)}`;

    try {
      resultText = await runEphemeralWithRetry(this.runner, {
        userId: 'hackathon-tester',
        newMessage: { role: 'user', parts: [{ text: payload }] }
      });

      const jsonMatch = resultText.match(/\{[\s\S]*\}/);
      return JSON.parse(jsonMatch ? jsonMatch[0] : '{"status": "error"}');
    } catch (error: any) {
      console.error('Action Run Error:', error.message);
      return { status: "error", message: error.message };
    }
  }
}
