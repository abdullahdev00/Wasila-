const { SequentialAgent } = require('./adk');
const planner = require('./agents/PlanningAgent');
const parser = require('./agents/ParserAgent');
const ranker = require('./agents/RankingAgent');
const booker = require('./agents/BookingAgent');
const replyAgent = require('./agents/ReplyAgent');

class WasilaOrchestrator {
  constructor() {
    this.brain = new SequentialAgent("Wasila Core", [
      planner,
      parser,
      ranker,
      booker,
      replyAgent
    ]);
  }

  async processRequest(userQuery) {
    const resultContext = await this.brain.run(userQuery);
    const state = resultContext.state;
    return {
      workplan: state.workplan,
      reply: state.finalReply,
      traces: resultContext.traces,
      bestMatch: state.bestMatch,
      actionStatus: state.bookingStatus
    };
  }
}

module.exports = new WasilaOrchestrator();
