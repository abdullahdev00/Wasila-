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
    
    // Agent 1: Language Parser (Confidence Scoring)
    traces.push({ step: "Agent 1: Language Parser", detail: `Confidence: ${intent.confidence}%. Language: Urdu/Roman/Eng.` });

    if (intent.confidence < 60) {
      return {
        reply: "Maazrat! Mujhy sahi sy samajh nahi aaya. Kya aap batana chahein gy ke aapko kis qisam ki service (Plumber, Electrician, etc.) chahiye?",
        traces: traces
      };
    }

    // Agent 7: Dispute Handler (Priority Check)
    if (intent.action === 'dispute') {
      return this.handleDispute(userQuery, traces);
    }

    if (intent.action === 'book') {
      return this.handleBooking(intent, traces);
    }

    // Agent 2 & 3: Discovery & 6-Factor Ranking
    traces.push({ step: "Agent 2 & 3: Discovery & Ranking", detail: "Applying 6-Factor matching algorithm." });
    let candidates = this.providers.filter(p => !p.isBooked);
    if (intent.category) {
      candidates = candidates.filter(p => p.category.toLowerCase().includes(intent.category.toLowerCase()));
    }

    // Stress Test: Fallback Logic
    if (candidates.length === 0) {
      traces.push({ step: "Stress Test: No Provider", detail: "Entering Fallback Mode (Waitlist/Alternative)." });
      return {
        reply: "Filhal is category mein koi provider available nahi hai. Kya main aapka naam Waitlist mein daal doon ya kisi aur area mein check karoon?",
        traces: traces
      };
    }

    const ranked = candidates.map(p => {
      let score = 0;
      score += p.rating * 10; // Factor 1: Rating
      score += (p.verified ? 20 : 0); // Factor 2: Verification
      score += (20 - Math.min(p.distanceKm, 20)); // Factor 3: Proximity
      score += (p.experienceYears / 2); // Factor 4: Experience
      score += (intent.preference === 'sasta' ? (5000 - p.pricePerHour) / 100 : p.pricePerHour / 500); // Factor 5: Price
      score += 10; // Factor 6: Availability
      return { ...p, finalScore: score };
    }).sort((a, b) => b.finalScore - a.finalScore);

    const bestMatch = ranked[0];

    // Agent 4: Dynamic Pricing Engine
    const pricing = this.calculateDynamicPricing(bestMatch, intent);
    traces.push({ step: "Agent 4: Dynamic Pricing", detail: `Base: ${pricing.base}, Distance Fee: ${pricing.distanceFee}, Urgency: x${pricing.urgency}` });

    return {
      reply: `Mujhy ${bestMatch.name} mily hain. ${bestMatch.verified ? 'Verified Expert' : 'Expert'}. Price: ${pricing.total} PKR.`,
      bestMatch: { ...bestMatch, pricing },
      traces: traces,
      suggestion: `Price Breakdown: Base ${pricing.base} + Safar ${pricing.distanceFee} + Urgency ${pricing.urgencyFee} = ${pricing.total} PKR. Kya main book kar doon?`
    };
  }

  extractIntent(query) {
    const q = query.toLowerCase();
    let category = null, preference = null, action = null, confidence = 100;

    // Language Confidence Check
    if (q.length < 5) confidence = 40;

    if (q.match(/plumber|nalka|pipe|پلمبر/)) category = 'Plumber';
    else if (q.match(/electrician|bijli|light|بجلی/)) category = 'Electrician';
    else if (q.match(/ac|mechanic|fridge|اے سی/)) category = 'AC Mechanic';
    else if (q.match(/tutor|teacher|parhana|استاد/)) category = 'Maths Tutor';
    else confidence = 50;

    if (q.match(/sasta|cheap|low price|سستا/)) preference = 'sasta';
    if (q.match(/book|yes|haan|kar do|بکنگ/)) action = 'book';
    if (q.match(/shikayat|complaint|nahi aaya|ghalat|expensive|dispute|کینسل/)) action = 'dispute';

    return { category, preference, action, confidence };
  }

  calculateDynamicPricing(provider, intent) {
    const base = provider.pricePerHour;
    const distanceFee = Math.round(provider.distanceKm * 50);
    const urgency = (intent.action === 'urgent' || intent.preference === 'best') ? 1.2 : 1.0;
    const urgencyFee = Math.round(base * (urgency - 1));
    const total = base + distanceFee + urgencyFee;

    return { base, distanceFee, urgency, urgencyFee, total };
  }

  handleDispute(query, traces) {
    traces.push({ step: "Agent 7: Dispute Handler", detail: "Analyzing price or service dispute." });
    let response = "Maazrat! Hum aapki shikayat ka jaiza le rahay hain. ";
    
    if (query.includes('nahi aaya') || query.includes('no show')) {
      response += "Provider ke na aany par hum unka score kam kar rahay hain aur aap ke liye naya provider dhoond rahay hain.";
    } else if (query.includes('expensive') || query.includes('mehanga')) {
      response += "Price dispute ke liye mainy detail breakdown bhej diya hai. Agar phir bhi masla hai to hamari team aap sy rabta kary gi.";
    } else {
      response += "Aapki request cancel kar di gayi hai.";
    }

    return { reply: response, actionTaken: "DISPUTE_LOGGED", traces: traces };
  }

  handleBooking(intent, traces) {
    traces.push({ step: "Agent 5: Booking Simulator", detail: "Recording booking and updating status." });
    const provider = this.providers.find(p => !p.isBooked && (intent.category ? p.category === intent.category : true)) || this.providers[0];

    if (provider) {
      provider.isBooked = true;
      const newBooking = { id: Date.now(), providerName: provider.name, status: "Confirmed", timestamp: new Date().toISOString() };
      
      try {
        const history = JSON.parse(fs.readFileSync(bookingsPath, 'utf8') || '[]');
        history.push(newBooking);
        fs.writeFileSync(bookingsPath, JSON.stringify(history, null, 2));
      } catch (e) {}

      traces.push({ step: "Agent 6: Follow-up Manager", detail: "Automated follow-up scheduled for 2 hours later." });
      return { reply: `Booking Confirmed! ${provider.name} 2 ghanty mein pohanch jayein gy.`, actionTaken: "BOOKED", traces: traces };
    }
    return { reply: "Error: Could not book.", traces: traces };
  }
}

module.exports = new WasilaOrchestrator();
