const { BaseAgent } = require('../adk');

/**
 * Agent 0: Planning Agent (The Brain's Architect)
 * Responsible for creating a Workplan before execution.
 */
class PlanningAgent extends BaseAgent {
  constructor() {
    super("Antigravity Planning Agent");
  }

  async run(context) {
    const q = context.input;
    
    // Antigravity Brain creates a logical Workplan
    const workplan = [
      "Step 1: Parse multilingual input and detect intent using Gemini.",
      "Step 2: Access Providers Tool to fetch matching candidates.",
      "Step 3: Execute 6-Factor Ranking to identify optimal provider.",
      "Step 4: Calculate dynamic quote based on distance/urgency.",
      "Step 5: Formulate final suggestion or execute booking action."
    ];

    return { 
      workplan, 
      reasoning: `User query "${q}" requires a sequential search and ranking flow.`
    };
  }
}

module.exports = new PlanningAgent();
