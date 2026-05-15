const { BaseAgent } = require('../adk');

/**
 * Agent 1: Language Parser Agent
 * Extends ADK BaseAgent.
 */
class ParserAgent extends BaseAgent {
  constructor() {
    super("Language Understanding Agent");
  }

  async run(context) {
    const q = context.input.toLowerCase();
    let category = null;
    let action = 'search';
    let confidence = 95;

    // Multilingual Mapping
    if (q.match(/plumber|nalka|pipe|پلمبر/)) category = 'Plumber';
    else if (q.match(/electrician|bijli|light|بجلی/)) category = 'Electrician';
    else if (q.match(/ac|mechanic|fridge|اے سی/)) category = 'AC Mechanic';
    else if (q.match(/tutor|teacher|parhana|استاد/)) category = 'Maths Tutor';
    else confidence = 50;

    if (q.match(/book|yes|haan|kar do|confirm/)) action = 'book';
    if (q.match(/shikayat|complaint|dispute|cancel/)) action = 'dispute';

    return { category, action, confidence };
  }
}

module.exports = new ParserAgent();
