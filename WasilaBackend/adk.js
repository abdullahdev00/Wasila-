/**
 * Wasila ADK (Agent Development Kit) Core
 * This implements the SequentialAgent and Agent patterns as per Google standards.
 */

class BaseAgent {
  constructor(name) {
    this.name = name;
  }
  async run(context) {
    throw new Error("Run method must be implemented");
  }
}

class SequentialAgent {
  constructor(name, subAgents) {
    this.name = name;
    this.subAgents = subAgents;
  }

  async run(input) {
    let context = { input, traces: [], state: {} };
    
    for (const agent of this.subAgents) {
      const stepResult = await agent.run(context);
      context.traces.push({ 
        agent: agent.name, 
        step: agent.constructor.name, 
        detail: stepResult 
      });
      // Shared state update
      context.state = { ...context.state, ...stepResult };
    }

    return context;
  }
}

module.exports = { BaseAgent, SequentialAgent };
