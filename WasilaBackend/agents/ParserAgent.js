/**
 * Agent 1: Language Parser
 * Responsible for understanding English, Urdu, and Roman Urdu.
 * Integration Point: Google Gemini API / Vertex AI.
 */
class ParserAgent {
  parse(query) {
    const q = query.toLowerCase();
    let category = null;
    let action = 'search';
    let confidence = 90;

    // Multilingual Mapping
    if (q.match(/plumber|nalka|pipe|پلمبر/)) category = 'Plumber';
    else if (q.match(/electrician|bijli|light|بجلی/)) category = 'Electrician';
    else if (q.match(/ac|mechanic|fridge|اے سی/)) category = 'AC Mechanic';
    else if (q.match(/tutor|teacher|parhana|استاد/)) category = 'Maths Tutor';
    else confidence = 50; // Ambiguous input

    if (q.match(/book|yes|haan|kar do|confirm/)) action = 'book';
    if (q.match(/shikayat|complaint|dispute|cancel/)) action = 'dispute';

    return { category, action, confidence };
  }
}

module.exports = new ParserAgent();
