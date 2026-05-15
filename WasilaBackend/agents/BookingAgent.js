const { BaseAgent } = require('../adk');
const fs = require('fs');
const path = require('path');
const bookingsPath = path.join(__dirname, '../data', 'bookings.json');

/**
 * Agent 5: Booking Agent
 * Handles the actual booking transaction and database update.
 */
class BookingAgent extends BaseAgent {
  constructor() {
    super("Service Booking Agent");
  }

  async run(context) {
    const { action, bestMatch } = context.state;

    if (action === 'book' && bestMatch) {
      const newBooking = {
        id: Date.now(),
        providerName: bestMatch.name,
        category: bestMatch.category,
        date: new Date().toLocaleString(),
        status: "Confirmed"
      };

      // Save to History
      try {
        const history = JSON.parse(fs.readFileSync(bookingsPath, 'utf8') || '[]');
        history.push(newBooking);
        fs.writeFileSync(bookingsPath, JSON.stringify(history, null, 2));
      } catch (e) { console.error(e); }

      return { bookingStatus: "SUCCESS", bookingDetails: newBooking };
    }

    return { bookingStatus: "SKIPPED" };
  }
}

module.exports = new BookingAgent();
