import { LlmAgent, InMemoryRunner } from '@google/adk';
import * as dotenv from 'dotenv';
dotenv.config();

/**
 * Master Planning Agent using Official Google ADK
 */
export class PlanningAgent {
  private runner: InMemoryRunner;

  constructor() {
    const agent = new LlmAgent({
      name: 'WasilaPlanner',
      description: 'Creates a procedural roadmap for user service requests.',
      model: 'gemini-2.5-flash',
      instruction: `
        You are the Master Planner for Wasila.
        For any user query, create a 5-step plan to resolve it.
        Return ONLY a JSON object: {"workplan": ["step 1", "..."], "strategy": "description"}
      `
    });

    this.runner = new InMemoryRunner({
      appName: 'WasilaOrchestrator',
      agent: agent
    });
  }

  async createPlan(query: string) {
    let resultText = "";
    try {
      const events = this.runner.runEphemeral({
        userId: 'hackathon-tester',
        newMessage: { role: 'user', parts: [{ text: query }] }
      });

      for await (const event of events) {
        if (event.content && event.content.parts && event.author !== 'user') {
          resultText += event.content.parts[0]?.text || "";
        }
      }

      const jsonMatch = resultText.match(/\{[\s\S]*\}/);
      return JSON.parse(jsonMatch ? jsonMatch[0] : '{"workplan": [], "strategy": "Error"}');
    } catch (error: any) {
      console.error('Planning Run Error:', error.message);
      return { workplan: [], strategy: "Fallback" };
    }
  }
}
