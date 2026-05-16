const { LlmAgent } = require('@google/adk');
require('dotenv').config();

/**
 * Agent: Reply Agent (Powered by Official Google ADK)
 */
class ReplyAgent {
  constructor() {
    this.agent = new LlmAgent({
      name: "WasilaReply",
      description: "Generates the final natural language response for the user.",
      model: "gemini-1.5-flash",
      instruction: `
        You are the final conversational agent for "Wasila".
        Generate a helpful and friendly response in Urdu or Roman Urdu based on the provided system state.
        Do NOT use emojis.
      `
    });
  }

  async run(context) {
    const state = context.state;
    const query = context.input;

    const systemInfo = `
      User Query: "${query}"
      Category Identified: ${state.category || 'None'}
      Best Match Found: ${state.bestMatch ? state.bestMatch.name : 'None'}
      Booking Status: ${state.bookingStatus || 'Searching'}
    `;

    try {
      const result = await this.agent.run(systemInfo);
      return { finalReply: result.text.trim() };
    } catch (error) {
      console.error("ADK Reply Error:", error.message);
      return { finalReply: "Maazrat, system mein masla hai. Baraye meharbani baad mein koshish karein." };
    }
  }
}

module.exports = new ReplyAgent();
