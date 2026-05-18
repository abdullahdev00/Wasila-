import { callOpenRouter } from '../utils/openRouter';

/**
 * Master Planning Agent using OpenRouter
 */
export class PlanningAgent {
  async createPlan(query: string) {
    const instruction = `
      You are the Master Planner for Wasila.
      For any user query, create a 5-step plan to resolve it.
      Return ONLY a JSON object: {"workplan": ["step 1", "..."], "strategy": "description"}
    `;

    try {
      const responseText = await callOpenRouter(instruction, query, { isJson: true });
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      return JSON.parse(jsonMatch ? jsonMatch[0] : '{"workplan": [], "strategy": "Error"}');
    } catch (error: any) {
      console.error('Planning Run Error:', error.message);
      return { workplan: [], strategy: "Fallback", error: error.message };
    }
  }
}
