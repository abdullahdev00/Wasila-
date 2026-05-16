import { ParserAgent } from './agents/ParserAgent';
import { PlanningAgent } from './agents/PlanningAgent';
import { MatchmakerAgent } from './agents/MatchmakerAgent';
import { ConciergeAgent } from './agents/ConciergeAgent';
import { ActionAgent } from './agents/ActionAgent';

async function main() {
  console.log("=== Wasila Multi-Agent ADK Orchestration System ===");

  const query = "Mujhe sink theek karwane ke liye plumber chahye";
  console.log(`User Query: "${query}"\n`);

  // Initialize Agents
  const planner = new PlanningAgent();
  const parser = new ParserAgent();
  const matchmaker = new MatchmakerAgent();
  const concierge = new ConciergeAgent();
  const actionAgent = new ActionAgent();

  // 1. Planning Phase
  console.log("[Phase 1] Planning Strategy...");
  const plan = await planner.createPlan(query);
  console.log("Plan Steps:", plan.workplan);
  
  // 2. Parsing Phase
  console.log("\n[Phase 2] Parsing Intent...");
  const parsed = await parser.parse(query);
  console.log("Category extracted:", parsed.category);

  // 3. Matchmaking (Autonomous Tool Phase)
  console.log("\n[Phase 3] Matching Service Providers (Autonomous SearchTool)...");
  const match = await matchmaker.findMatch(query, parsed.category);
  console.log("Matched Candidate:", match.bestMatch);
  
  // 4. Conversational Response Phase
  console.log("\n[Phase 4] Concierge Reply Generation...");
  const state = { bestMatch: match.bestMatch, bookingStatus: 'PROPOSAL_READY' };
  const response = await concierge.reply(query, state);
  console.log("-----------------------------------------");
  console.log("Concierge Reply:", response.reply);
  console.log("-----------------------------------------");

  // 5. User Confirmation & Booking Action Phase
  if (match.bestMatch && match.bestMatch.id) {
    const userConfirmation = "Haan, isay book kar do. Mera sink bohot leak ho raha hai.";
    console.log(`\n[User says]: "${userConfirmation}"`);
    console.log("[Phase 5] Executing Booking (Autonomous BookingTool)...");
    
    // Injecting the provider ID into the details so the agent knows WHO to book
    const providerDetails = { 
      providerId: match.bestMatch.id, 
      name: match.bestMatch.name,
      userId: 'test-user-123'
    };
    
    const finalAction = await actionAgent.executeBooking(userConfirmation, providerDetails);
    console.log("Action Status:", finalAction.status);
    console.log("Booking ID:", finalAction.bookingId);
    console.log("Final Message:", finalAction.message);
  }
}

main().catch(console.error);
