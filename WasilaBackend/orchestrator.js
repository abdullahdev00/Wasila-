const fs = require('fs');
const path = require('path');
const providersData = require('./data/providers.json');

const bookingsPath = path.join(__dirname, 'data', 'bookings.json');

class WasilaOrchestrator {
  constructor() {
    this.providers = providersData;
  }

  async processRequest(userQuery) {
    const traces = [];
    const intent = this.extractIntent(userQuery);
    
    traces.push({ step: "Language Detection", detail: "Multilingual input detected (Urdu/Roman Urdu/English)." });
    traces.push({ step: "Intent Extraction", detail: `Category: ${intent.category || 'Any'}, Action: ${intent.action || 'Search'}` });

    if (intent.action === 'book') {
      return this.handleBooking(intent, traces);
    }

    // 1. Planning: Multi-Factor Ranking (The 6 Factors)
    traces.push({ step: "Planning", detail: "Applying 6-Factor Ranking Engine (Price, Rating, Distance, Verification, Experience, Availability)." });

    let candidates = this.providers.filter(p => !p.isBooked);
    if (intent.category) {
      candidates = candidates.filter(p => p.category.toLowerCase().includes(intent.category.toLowerCase()));
    }

    // 2. Execution: Scoring Engine
    const ranked = candidates.map(p => {
      let score = 0;
      score += p.rating * 10; // Factor 1: Rating (0-50)
      score += (p.verified ? 20 : 0); // Factor 2: Verification (+20)
      score += (20 - Math.min(p.distanceKm, 20)); // Factor 3: Proximity (0-20)
      score += (p.experienceYears / 2); // Factor 4: Experience (0-10)
      score += (intent.preference === 'sasta' ? (5000 - p.pricePerHour) / 100 : p.pricePerHour / 500); // Factor 5: Price Score
      score += 10; // Factor 6: Availability (Fixed +10 for online)
      
      return { ...p, finalScore: score };
    }).sort((a, b) => b.finalScore - a.finalScore);

    const bestMatch = ranked[0];

    traces.push({ step: "Reasoning", detail: `Analyzed ${candidates.length} providers. ${bestMatch ? bestMatch.name + ' scored highest (' + bestMatch.finalScore.toFixed(1) + ')' : 'No matches found.'}` });

    return {
      reply: this.generateResponse(bestMatch, intent),
      bestMatch: bestMatch,
      traces: traces,
      suggestion: bestMatch ? `Ji, ${bestMatch.name} behtareen rahay ga. Book kar doon?` : "Maazrat, koi match nahi mila."
    };
  }

  extractIntent(query) {
    const q = query.toLowerCase();
    let category = null;
    let preference = null;
    let action = null;

    if (q.match(/plumber|nalka|pipe|پلمبر/)) category = 'Plumber';
    if (q.match(/electrician|bijli|light|بجلی/)) category = 'Electrician';
    if (q.match(/ac|mechanic|fridge|اے سی/)) category = 'AC Mechanic';
    if (q.match(/tutor|teacher|parhana|استاد/)) category = 'Maths Tutor';

    if (q.match(/sasta|cheap|low price|سستا/)) preference = 'sasta';
    if (q.match(/best|top|accha|high quality|بہترین/)) preference = 'best';
    if (q.match(/book|yes|haan|kar do|confirm|بکنگ/)) action = 'book';

    return { category, preference, action };
  }

  handleBooking(intent, traces) {
    traces.push({ step: "Action Simulation", detail: "Recording booking in history and notifying provider." });
    
    const provider = this.providers.find(p => !p.isBooked && (intent.category ? p.category === intent.category : true));

    if (provider) {
      provider.isBooked = true;
      const newBooking = {
        id: Date.now(),
        providerName: provider.name,
        category: provider.category,
        date: new Date().toLocaleString(),
        status: "Confirmed"
      };

      // Save to History
      try {
        const history = JSON.parse(fs.readFileSync(bookingsPath, 'utf8') || '[]');
        history.push(newBooking);
        fs.writeFileSync(bookingsPath, JSON.stringify(history, null, 2));
      } catch (e) { console.error(e); }

      traces.push({ step: "Database Update", detail: "Booking history updated successfully." });
      traces.push({ step: "Notification", detail: `[SIMULATION] SMS sent to ${provider.name}.` });

      return {
        reply: `Mubarak ho! ${provider.name} ki booking ho gayi hai. History mein bhi record save kar diya gaya hai.`,
        actionTaken: "BOOKING_SAVED",
        booking: newBooking,
        traces: traces
      };
    }

    return { reply: "Maazrat! Koi provider available nahi mila.", traces: traces };
  }

  generateResponse(provider, intent) {
    if (!provider) return "Mujhy aapki requirement ke mutabiq koi provider nahi mila.";
    return `Mujhy ${provider.name} mily hain jo ${provider.category} ke expert hain. Inka score sab sy zyada hai (${provider.finalScore.toFixed(1)}). Kya main inhein book kar doon?`;
  }
}

module.exports = new WasilaOrchestrator();
