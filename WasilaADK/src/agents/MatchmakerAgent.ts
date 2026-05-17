import { LlmAgent, InMemoryRunner } from '@google/adk';
import { runEphemeralWithRetry } from '../utils/retryHelper.js';
import { searchTool } from '../tools/SearchTool.js';
import * as dotenv from 'dotenv';
dotenv.config();

/**
 * Matchmaker Agent using Official Google ADK
 * Now equipped with Firebase SearchTool for autonomy.
 */
export class MatchmakerAgent {
  private runner: InMemoryRunner;

  constructor() {
    const agent = new LlmAgent({
      name: 'WasilaMatchmaker',
      description: 'Finds the best service provider match based on query.',
      model: 'gemini-2.5-flash',
      tools: [searchTool], // Injecting the Firebase tool!
      instruction: `
        You are the Matchmaker for Wasila.
        1. Use the 'search_firebase_providers' tool to find candidates for the given query.
        2. Rank the candidates based on rating and relevance.
        3. Return ONLY a JSON object: {"bestMatch": {"id": "string", "name": "string", "rating": number}, "reasoning": "explanation"}
      `
    });

    this.runner = new InMemoryRunner({
      appName: 'WasilaOrchestrator',
      agent: agent
    });
  }

  async findMatch(query: string, category: string) {
    let resultText = "";
    // Now we just pass the need, the agent handles the searching!
    const payload = `User Need: "${query}" (Category: ${category})`;

    try {
      resultText = await runEphemeralWithRetry(this.runner, {
        userId: 'hackathon-tester',
        newMessage: { role: 'user', parts: [{ text: payload }] }
      });

      const jsonMatch = resultText.match(/\{[\s\S]*\}/);
      return JSON.parse(jsonMatch ? jsonMatch[0] : '{"bestMatch": null}');
    } catch (error: any) {
      console.error('Matchmaking Run Error:', error.message);
      return { bestMatch: null, reasoning: error.message };
    }
  }
}
