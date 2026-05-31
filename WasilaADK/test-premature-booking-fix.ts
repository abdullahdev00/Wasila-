import { ParserAgent } from './src/agents/ParserAgent';
import { MatchmakerAgent } from './src/agents/MatchmakerAgent';
import { SupplierAgent } from './src/agents/SupplierAgent';
import { PricingAgent } from './src/agents/PricingAgent';
import dotenv from 'dotenv';

dotenv.config();

async function runTest() {
  console.log("=== Integration Test: Premature Booking Prevention ===\n");

  const parser = new ParserAgent();
  const matchmaker = new MatchmakerAgent();
  const pricingAgent = new PricingAgent();
  const supplierAgent = new SupplierAgent();

  // Turn 1: Search plumber in Islamabad
  const query1 = "Mujhe plumber chahiye Islamabad me";
  console.log(`[Turn 1] User query: "${query1}"`);
  
  const parsed1 = await parser.parse(query1);
  console.log("Parsed Turn 1:", JSON.stringify(parsed1, null, 2));

  const resolvedLocation = parsed1.location || 'Islamabad';
  const match1 = await matchmaker.findMatch(query1, parsed1.category, resolvedLocation);
  console.log("Match Turn 1:", JSON.stringify(match1.bestMatch, null, 2));

  if (!match1.bestMatch) {
    throw new Error("Expected to match Ahmed Raza Plumber, but matched null.");
  }
  console.log("✔ Plumber matched successfully in Turn 1.\n");

  // Turn 2: Try to negotiate (contains 'krdo' and 'krdya' to test parser / server desync)
  const query2 = "1000 me krdo please apny to 1500 me krdya";
  console.log(`[Turn 2] User query: "${query2}"`);
  
  // Set up recent chat history context to mock real API flow
  const historyText = `User: "${query1}" | AI: "Ahmed Raza (rating 4.8) is available in Islamabad for Rs. 1500. Do you want to confirm?"`;
  const contextualMessage = `
    [Recent Chat History]:
    ${historyText}
    
    [Current User Message]: "${query2}"
  `;

  const parsed2 = await parser.parse(contextualMessage);
  console.log("Parsed Turn 2:", JSON.stringify(parsed2, null, 2));

  // Determine if booking confirmation would be triggered:
  // in server.ts: if (parsed.action === 'book' && !(parsed.proposedPrice && parsed.proposedPrice > 0))
  const isBookingTriggered = parsed2.action === 'book' && !(parsed2.proposedPrice && parsed2.proposedPrice > 0);
  console.log(`\nIs Booking Confirmation Triggered: ${isBookingTriggered} (Expected: false)`);

  if (isBookingTriggered) {
    throw new Error("FAIL: Booking confirmation was triggered prematurely during negotiation!");
  }
  console.log("✔ Premature booking prevention guard passed successfully!");

  // Now verify that category fallback and negotiation runs:
  const resolvedCategory = parsed2.category || parsed1.category; // fallback from memory
  console.log(`Resolved Category from memory: "${resolvedCategory}"`);

  const match2 = await matchmaker.findMatch(query2, resolvedCategory, resolvedLocation);
  
  // Pricing and negotiation simulation:
  const basePrice = match2.bestMatch.pricePerHour || 1500;
  const quote = await pricingAgent.calculateQuote(basePrice, query2, resolvedLocation);

  const proposal = {
    category: resolvedCategory,
    serviceName: match2.bestMatch.name,
    dateTime: parsed2.dateTime || 'Tomorrow, 10:00 AM',
    location: resolvedLocation,
    proposedPrice: (parsed2.proposedPrice && parsed2.proposedPrice > 0) ? parsed2.proposedPrice : quote.total,
    basePrice: basePrice
  };

  console.log("\nStarting A2A Negotiation Loop...");
  const evaluation = await supplierAgent.evaluateProposal(
    "Ahmed Raza",
    "- Working hours: 9:00 AM to 6:00 PM.\n- Saturday is a holiday.\n- Base price is Rs. 1500 per hour. If customer proposes less, never go below Rs. 1200 per hour.",
    proposal,
    [`Customer Agent: Proposed Rs. ${proposal.proposedPrice} at ${proposal.dateTime}`]
  );

  console.log("Ahmed Raza Agent Decision Output:", JSON.stringify(evaluation, null, 2));

  if (evaluation.status !== 'counter_offer') {
    throw new Error(`Expected counter_offer from Ahmed Raza (Rs. 1000 is below minimum Rs. 1200), but got: ${evaluation.status}`);
  }
  if (evaluation.negotiatedPrice !== 1200) {
    throw new Error(`Expected negotiatedPrice counter-offer to be 1200, but got: ${evaluation.negotiatedPrice}`);
  }

  console.log("\n✔ Ahmed Raza Agent correctly counter-offered Rs. 1200 as expected!");
  console.log("✔ Integration test for premature booking fix completed successfully!");
}

runTest().catch(err => {
  console.error("Test failed:", err);
  process.exit(1);
});
