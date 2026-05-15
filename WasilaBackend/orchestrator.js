const { SequentialAgent } = require('./adk');
const parser = require('./agents/ParserAgent');
const ranker = require('./agents/RankingAgent');
const booker = require('./agents/BookingAgent');
const follower = require('./agents/FollowUpAgent');

/**
 * Wasila Master Orchestrator (Full ADK Sequential Implementation)
 */
class WasilaOrchestrator {
  constructor() {
    // Defining the FULL Sequential Pipeline
    this.brain = new SequentialAgent("Wasila End-to-End Pipeline", [
      parser,
      ranker,
      booker,
      follower
    ]);
  }

  async processRequest(userQuery) {
    // The ADK SequentialAgent handles the execution flow and shared state across ALL agents
    const resultContext = await this.brain.run(userQuery);
    
    const state = resultContext.state;
    const traces = resultContext.traces;

    // Intelligence: Handling Low Confidence from Parser
    if (state.confidence < 60) {
      return { 
        reply: "Maazrat! Mujhy sahi sy samajh nahi aaya. Kya aap apni requirement bata sakty hain?", 
        traces: traces 
      };
    }

    // Intelligence: Handling Successful Booking
    if (state.bookingStatus === "SUCCESS") {
      return {
        reply: `Mubarak ho! ${state.bookingDetails.providerName} ki booking ho gayi hai. ${state.followUpMessage}`,
        booking: state.bookingDetails,
        traces: traces
      };
    }

    // Intelligence: Handling Search Results
    if (state.bestMatch) {
      return {
        reply: `Mujhy ${state.bestMatch.name} mily hain jo ${state.bestMatch.category} ke expert hain. Kya main book kar doon?`,
        bestMatch: state.bestMatch,
        traces: traces
      };
    }

    return { reply: "Maazrat, koi provider available nahi mila.", traces: traces };
  }
}

module.exports = new WasilaOrchestrator();
