const providersData = require('./data/providers.json');

class WasilaOrchestrator {
  constructor() {
    this.providers = providersData;
    this.bookings = []; // Mock database for bookings
  }

  async processRequest(userQuery) {
    const traces = [];
    const q = userQuery.toLowerCase();
    
    traces.push({ step: "Language Detection", detail: "Analyzing query for Urdu/English/Roman Urdu keywords." });

    // 1. Enhanced Intent Extraction (Multilingual)
    const intent = this.extractIntent(userQuery);
    traces.push({ step: "Intent Extraction", detail: `Detected Category: ${intent.category || 'Any'}, Preference: ${intent.preference || 'None'}` });

    // 2. Handling "Booking" Action
    if (intent.action === 'book') {
      return this.handleBooking(intent, traces);
    }

    // 3. Planning & Retrieval
    traces.push({ step: "Planning", detail: "Searching providers knowledge base." });
    let candidates = this.providers.filter(p => !p.isBooked);
    
    if (intent.category) {
      candidates = candidates.filter(p => p.category.toLowerCase().includes(intent.category.toLowerCase()));
    }

    // 4. Reasoning & Ranking
    traces.push({ step: "Reasoning", detail: "Ranking by rating, price, and verification." });
    const ranked = candidates.sort((a, b) => {
      if (intent.preference === 'sasta') return a.pricePerHour - b.pricePerHour;
      return b.rating - a.rating;
    });

    const bestMatch = ranked[0];

    return {
      reply: this.generateResponse(bestMatch, intent),
      bestMatch: bestMatch,
      traces: traces,
      suggestion: bestMatch ? `Kya main ${bestMatch.name} ko book kar doon?` : "Kya main kisi aur area mein dhoondoon?"
    };
  }

  extractIntent(query) {
    const q = query.toLowerCase();
    let category = null;
    let preference = null;
    let action = null;

    // Multilingual Keywords (English, Urdu, Roman Urdu)
    if (q.match(/plumber|nalka|pipe|پلمبر/)) category = 'Plumber';
    if (q.match(/electrician|bijli|light|بجلی/)) category = 'Electrician';
    if (q.match(/ac|mechanic|refrigerator|fridge|اے سی/)) category = 'AC Mechanic';
    if (q.match(/tutor|teacher|maths|parhana|استاد/)) category = 'Maths Tutor';

    if (q.match(/sasta|cheap|low price|kam rate|سستا/)) preference = 'sasta';
    if (q.match(/best|top|accha|high quality|بہترین/)) preference = 'best';

    if (q.match(/book|yes|haan|kar do|confirm|بکنگ/)) action = 'book';

    return { category, preference, action };
  }

  handleBooking(intent, traces) {
    traces.push({ step: "Action Simulation", detail: "Initiating booking process." });
    
    // In a real app, we'd look for the LAST mentioned provider in the session
    // For simulation, we'll pick the top one if category is mentioned
    const provider = this.providers.find(p => p.category === intent.category && !p.isBooked) || this.providers[0];

    if (provider) {
      provider.isBooked = true; // Mock update
      traces.push({ step: "Action Success", detail: `Successfully booked ${provider.name}.` });
      traces.push({ step: "Notification", detail: `[SIMULATION] SMS sent to ${provider.name}: New booking request from User.` });
      
      return {
        reply: `Ji bilkul! Mainy ${provider.name} ki booking confirm kar di hai. Wo 2 ghanty mein aapke location par pohanch jayein gy.`,
        actionTaken: "BOOKING_CONFIRMED",
        provider: provider,
        traces: traces
      };
    }

    return {
      reply: "Maazrat! Filhal koi provider available nahi hai. Kya main kuch dair baad check karoon?",
      traces: traces
    };
  }

  generateResponse(provider, intent) {
    if (!provider) return "Mujhy koi available provider nahi mila. Kya main kisi aur category mein dhoondoon?";
    
    const intro = intent.preference === 'sasta' ? "Sasta aur behtareen option" : "Sub sy behtareen option";
    return `${intro} ${provider.name} hain. Inka rate ${provider.pricePerHour} PKR hai aur rating ${provider.rating} hai. Ye ${provider.location} mein hain. Kya main inhein book kar doon?`;
  }
}

module.exports = new WasilaOrchestrator();
