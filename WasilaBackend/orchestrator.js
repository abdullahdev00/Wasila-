const { SequentialAgent } = require('./adk');
const planner = require('./agents/PlanningAgent');
const parser = require('./agents/ParserAgent');
const ranker = require('./agents/RankingAgent');
const booker = require('./agents/BookingAgent');
const follower = require('./agents/FollowUpAgent');

/**
 * Wasila Master Orchestrator (Antigravity Brain Implementation)
 * Compliant with agentrules.md: Planning, Reasoning, and Action simulation.
 */
class WasilaOrchestrator {
  constructor() {
    // The pipeline starts with the Planning Agent as the central brain
    this.brain = new SequentialAgent("Antigravity Core Orchestrator", [
      planner, // Strategic Planning
      parser,  // Multilingual Parsing
      ranker,  // Reasoning & Ranking
      booker,  // Action Execution
      follower // Post-action Management
    ]);
  }

  async processRequest(userQuery) {
    const resultContext = await this.brain.run(userQuery);
    
    const state = resultContext.state;
    const traces = resultContext.traces;

    // Formatting for Frontend Visualization (Winning Edge)
    return {
      workplan: state.workplan, // Explicit Workplan as required by agentrules.md
      reply: this.generateConversationalReply(state),
      traces: traces, // Detailed Reasoning Traces
      bestMatch: state.bestMatch,
      actionStatus: state.bookingStatus || "PENDING",
      agenticEdge: "Logic powered by Google Antigravity reasoning loop."
    };
  }

  generateConversationalReply(state) {
    if (state.confidence < 60) return "Mujhy sahi sy samajh nahi aaya. Kya aap apni requirement bata sakty hain?";
    if (state.bookingStatus === "SUCCESS") return `Mubarak ho! ${state.bookingDetails.providerName} book ho chuky hain.`;
    if (state.bestMatch) return `Mujhy ${state.bestMatch.name} mily hain. Kya main inhein book kar doon?`;
    return "Maazrat, koi matching provider nahi mila.";
  }
}

module.exports = new WasilaOrchestrator();
