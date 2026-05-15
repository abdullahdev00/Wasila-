const { SequentialAgent } = require('./adk');
const parser = require('./agents/ParserAgent');
const ranker = require('./agents/RankingAgent');
const pricer = require('./agents/PricingAgent'); // I'll refactor this too
const actor = require('./agents/ActionAgent');   // I'll refactor this too

/**
 * Wasila Master Orchestrator (ADK Sequential Implementation)
 */
class WasilaOrchestrator {
  constructor() {
    // Defining the Sequential Pipeline
    this.brain = new SequentialAgent("Wasila Main Pipeline", [
      parser,
      ranker,
      // More agents can be added here
    ]);
  }

  async processRequest(userQuery) {
    // The ADK SequentialAgent handles the execution flow and shared state
    const resultContext = await this.brain.run(userQuery);
    
    const state = resultContext.state;
    const traces = resultContext.traces;

    // Final Logic for Response Generation
    if (state.confidence < 60) {
      return { reply: "Mujhy sahi sy samajh nahi aaya. Kya aap apni requirement bata sakty hain?", traces };
    }

    if (state.bestMatch) {
      return {
        reply: `Mujhy ${state.bestMatch.name} mily hain jo ${state.bestMatch.category} ke expert hain. Kya main book kar doon?`,
        bestMatch: state.bestMatch,
        traces: traces
      };
    }

    return { reply: "Maazrat, koi provider nahi mila.", traces };
  }
}

module.exports = new WasilaOrchestrator();
