const { BaseAgent } = require('../adk');
const { GoogleGenerativeAI } = require("@google/generative-ai");
require('dotenv').config();

class ParserAgent extends BaseAgent {
  constructor() {
    super("Google Gemini Parser");
    this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    this.model = this.genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
  }

  async run(context) {
    const query = context.input;
    try {
      const prompt = `Analyze user query: "${query}". Return JSON with category, action, confidence.`;
      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      return JSON.parse(response.text());
    } catch (error) {
      return { category: null, action: 'search', confidence: 50 };
    }
  }
}

module.exports = new ParserAgent();
