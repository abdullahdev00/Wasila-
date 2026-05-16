const { BaseAgent } = require('../adk');
const { GoogleGenerativeAI } = require("@google/generative-ai");
require('dotenv').config();

class PlanningAgent extends BaseAgent {
  constructor() {
    super("Wasila Planner");
    this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    this.model = this.genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
  }

  async run(context) {
    const userQuery = context.input;
    try {
      const prompt = `Create 5 steps to handle: "${userQuery}". Return JSON {workplan: [], strategy: ""}`;
      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      return JSON.parse(response.text());
    } catch (error) {
      return { workplan: ["Step 1", "Step 2", "Step 3", "Step 4", "Step 5"], strategy: "Fallback" };
    }
  }
}

module.exports = new PlanningAgent();
