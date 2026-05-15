const { BaseAgent } = require('../adk');

/**
 * Agent 6: Follow-Up Agent
 * Responsible for scheduling check-ins and managing service status.
 */
class FollowUpAgent extends BaseAgent {
  constructor() {
    super("Service Follow-Up Agent");
  }

  async run(context) {
    const { bookingStatus, bestMatch } = context.state;

    if (bookingStatus === "SUCCESS") {
      const followUpTime = new Date(Date.now() + 2 * 60 * 60 * 1000).toLocaleString(); // 2 hours later
      
      return { 
        followUpScheduled: true, 
        followUpMessage: `Hum aap sy ${followUpTime} par rabta karein gy ke kya service mukammal ho gayi hai.`
      };
    }

    return { followUpScheduled: false };
  }
}

module.exports = new FollowUpAgent();
