import { ParserAgent } from './src/agents/ParserAgent';
import { SupplierAgent } from './src/agents/SupplierAgent';
import dotenv from 'dotenv';

dotenv.config();

async function runTest() {
  console.log("=== Standalone Negotiation Integration Test ===\n");

  const parser = new ParserAgent();
  const supplier = new SupplierAgent();

  const userQuery = "1100 rupee krdo please 100 discount do yr";
  console.log(`Step 1: Running ParserAgent on query: "${userQuery}"`);
  
  // Recent Chat History mock
  const historyText = `User: "AC chalu nahi ho raha" | AI: "Sajid Khan (rating 4.8) F-10 Markaz, Islamabad mein Rs. 1200 mein kal subah 10:00 baje available hain. Kya aap yeh booking confirm karna chahte hain?"`;
  const contextualMessage = `
    [Recent Chat History]:
    ${historyText}
    
    [Current User Message]: "${userQuery}"
  `;

  const parsed = await parser.parse(contextualMessage);
  console.log("Parsed result:", JSON.stringify(parsed, null, 2));

  if (parsed.proposedPrice !== 1100) {
    throw new Error(`Expected proposedPrice to be 1100, but got: ${parsed.proposedPrice}`);
  }
  console.log("✔ ParserAgent correctly extracted proposedPrice as 1100.\n");

  console.log("Step 2: Simulating A2A Negotiation Loop with Sajid Khan...");
  
  const providerInstructions = `
    - Working hours: 10:00 AM to 10:00 PM.
    - Sunday is a holiday. Suggest Saturday or Monday instead if Sunday is asked.
    - Base price is Rs. 1200 per hour. You can offer discount down to Rs. 1000 minimum if they ask for discount.
    - Speak politely in Roman Urdu.
  `;

  const proposal = {
    category: parsed.category || 'Electrician',
    serviceName: 'Wiring & Fan Repairing',
    dateTime: parsed.dateTime || 'Tomorrow, 10:00 AM',
    location: 'F-10 Markaz, Islamabad',
    proposedPrice: parsed.proposedPrice || 1200,
    basePrice: 1200 // Original base price
  };

  const negotiationHistory: string[] = [];
  const negotiationTraces: string[] = [];
  let currentProposedPrice = proposal.proposedPrice;
  let currentProposedDateTime = proposal.dateTime;
  let currentStatus = 'pending';
  const maxTurns = 2;

  for (let turn = 1; turn <= maxTurns; turn++) {
    console.log(`[Turn ${turn}] Customer Agent proposes Rs. ${currentProposedPrice}`);
    negotiationTraces.push(`[Negotiation Turn ${turn}] Customer Agent proposed Rs. ${currentProposedPrice} at ${currentProposedDateTime}`);
    negotiationHistory.push(`Customer Agent: Proposed Rs. ${currentProposedPrice} at ${currentProposedDateTime}`);

    const evaluation = await supplier.evaluateProposal(
      "Sajid Khan",
      providerInstructions,
      {
        ...proposal,
        proposedPrice: currentProposedPrice,
        dateTime: currentProposedDateTime
      },
      negotiationHistory
    );

    console.log(`[Turn ${turn}] Sajid Khan Agent Response:`, JSON.stringify(evaluation, null, 2));
    negotiationTraces.push(`[Negotiation Turn ${turn}] Sajid Khan Agent: ${evaluation.reasoning} (Decision: ${evaluation.status})`);
    negotiationHistory.push(`Sajid Khan Agent: Decision=${evaluation.status}, Price=${evaluation.negotiatedPrice}, Time=${evaluation.negotiatedDateTime}`);

    if (evaluation.status === 'accepted') {
      currentStatus = 'accepted';
      currentProposedPrice = evaluation.negotiatedPrice;
      currentProposedDateTime = evaluation.negotiatedDateTime;
      break;
    } else if (evaluation.status === 'counter_offer') {
      currentProposedPrice = evaluation.negotiatedPrice;
      currentProposedDateTime = evaluation.negotiatedDateTime;
      if (turn === maxTurns) {
        currentStatus = 'accepted';
        negotiationTraces.push(`[Negotiation] Customer Agent accepted counter-offer of Rs. ${currentProposedPrice} at ${currentProposedDateTime}`);
        break;
      }
    } else {
      currentStatus = 'rejected';
      break;
    }
  }

  console.log("\n=== Negotiation Result ===");
  console.log("Status:", currentStatus);
  console.log("Final Price:", currentProposedPrice);
  console.log("Traces:\n", negotiationTraces.join('\n'));

  if (currentStatus !== 'accepted') {
    throw new Error(`Expected negotiation status to be accepted, but got: ${currentStatus}`);
  }
  if (currentProposedPrice !== 1100) {
    throw new Error(`Expected negotiated price to be 1100, but got: ${currentProposedPrice}`);
  }

  console.log("\n✔ Negotiation integration test succeeded successfully!");
}

runTest().catch(err => {
  console.error("Test failed:", err);
  process.exit(1);
});
