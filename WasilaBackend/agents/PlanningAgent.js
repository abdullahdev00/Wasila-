const { BaseAgent } = require('../adk');
const { GoogleGenerativeAI } = require("@google/generative-ai");
require('dotenv').config();

/**
 * Agent 0: Dynamic Planning Agent
 * Generates a custom Workplan using Google Gemini.
 */
class PlanningAgent extends BaseAgent {
  constructor() {
    super("Antigravity Planning Agent");
    this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "MOCK");
    this.model = this.genAI.getGenerativeModel({ 
      model: "gemini-1.5-flash",
      generationConfig: { responseMimeType: "application/json" }
    });
  }

  async run(context) {
    const query = context.input;

    try {
      const prompt = `
        You are the Planning Brain of Wasila. Based on the user query: "${query}", 
        generate a 5-step strategic Workplan for the other agents to follow.
        
        Return ONLY a JSON object:
        {
          "workplan": ["Step 1...", "Step 2...", "Step 3...", "Step 4...", "Step 5..."],
          "reasoning": "Brief explanation of why this plan was chosen."
        }
      `;

      const result = await this.model.generateContent(prompt);
      const text = await result.response.text();
      return JSON.parse(text);

    } catch (error) {
      // Fallback if Gemini fails
      return {
        workplan: [
          "Step 1: Parse user intent and category.",
          "Step 2: Filter providers by expertise.",
          "Step 3: Rank using 6-factor algorithm.",
          "Step 4: Generate dynamic fair pricing.",
          "Step 5: Present optimal choice to user."
        ],
        reasoning: "Heuristic plan used as Gemini was unavailable."
      };
    }
  }
}

module.exports = new PlanningAgent();
