/**
 * Agent 5 & 7: Action & Dispute Agent
 * Handles bookings, notifications, and customer disputes.
 */
class ActionAgent {
  simulateBooking(provider) {
    return {
      status: "SUCCESS",
      id: Date.now(),
      providerName: provider.name,
      notification: `[SIMULATION] SMS sent to ${provider.name}.`
    };
  }

  handleDispute(query) {
    if (query.includes('expensive')) {
      return "Mainy price breakdown share kar diya hai. Wasila market rates sy 10% sasta hai.";
    }
    return "Aapki request cancel kar di gayi hai. Hum behter provider dhoond rahay hain.";
  }
}

module.exports = new ActionAgent();
