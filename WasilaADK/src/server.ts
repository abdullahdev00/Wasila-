import express from 'express';
import cors from 'cors';
import { ParserAgent } from './agents/ParserAgent';
import { PlanningAgent } from './agents/PlanningAgent';
import { MatchmakerAgent } from './agents/MatchmakerAgent';
import { ConciergeAgent } from './agents/ConciergeAgent';
import { ActionAgent } from './agents/ActionAgent';
import { PricingAgent } from './agents/PricingAgent';
import { SupplierAgent } from './agents/SupplierAgent';
import { getUserName, fetchUserBookings, db } from './firebase';
import { getDoc, doc } from 'firebase/firestore';

const app = express();
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Initialize AI Agents once for the server
const planner = new PlanningAgent();
const parser = new ParserAgent();
const matchmaker = new MatchmakerAgent();
const concierge = new ConciergeAgent();
const actionAgent = new ActionAgent();
const pricingAgent = new PricingAgent();
const supplierAgent = new SupplierAgent();

// --- IN-MEMORY CHAT STATE ---
// Stores the last message and provider for each user session without a database
const chatMemory = new Map();

app.post('/api/chat', async (req, res) => {
  try {
    const { message, history, userId: rawUserId, userName: rawUserName } = req.body;
    const userId = rawUserId || 'guest';
    console.log(`\n--- New API Request: "${message}" (User: ${userId}) ---`);

    // Fetch user details dynamically from Firebase
    let userName = rawUserName || '';
    if (!userName || userName.trim() === '') {
      userName = await getUserName(userId);
    }
    console.log(`[User Identity] Resolved UID '${userId}' to name: '${userName}'`);

    // Fetch user memory
    const userMemory = chatMemory.get(userId) || { history: [], lastProviderId: null };

    // Inject history context so agents remember the past
    const historyText = userMemory.history.map((h: any) => `User: "${h.user}" | AI: "${h.ai}"`).join('\n');
    const contextualMessage = `
      [Recent Chat History]:
      ${historyText || 'No previous chat'}
      
      [Current User Message]: "${message}"
    `;

    // 1. Intent Parsing Phase (Now memory-aware)
    const parsed = await parser.parse(contextualMessage);
    console.log("Parsed Intent:", parsed);

    let matchResult = null;
    let actionResult = null;
    let finalReply = "";
    let userBookings = null;

    // 2. Check if this is a booking confirmation action
    if (parsed.action && parsed.action.toLowerCase() === 'book') {
      // Use memory to know WHO to book if frontend doesn't send it
      const providerId = req.body.providerId || userMemory.lastProviderId; 
      if (providerId) {
        actionResult = await actionAgent.executeBooking(message, { 
          providerId, 
          userId: req.body.userId || 'guest',
          dateTime: parsed.dateTime 
        });
        finalReply = actionResult.message || "Aapki booking mukammal ho gayi hai!";
      } else {
        finalReply = "Maazrat, kis provider ko book karna hai ye samajh nahi aaya.";
      }
    } else {
      // Fetch bookings if user wants to view them
      if (parsed.action && parsed.action.toLowerCase() === 'view_bookings') {
        userBookings = await fetchUserBookings(userId);
        console.log(`[User Bookings] Fetched ${userBookings.length} booking(s) for UID '${userId}'`);
      }

      if (parsed.category) {
        matchResult = await matchmaker.findMatch(message, parsed.category);
        if (matchResult?.bestMatch) {
          const basePrice = matchResult.bestMatch.pricePerHour || 1000;
          const location = matchResult.bestMatch.location || "Unknown";
          const quote = await pricingAgent.calculateQuote(basePrice, message, location);
          matchResult.bestMatch.pricing = quote;
          
          console.log(`[Pricing Engine] Dynamic quote calculated: ${quote.total} PKR (Base: ${quote.base}, Distance: ${quote.distanceFee}, Urgency: ${quote.urgencyFee})`);

          // --- AGENT-TO-AGENT NEGOTIATION LOOP ---
          let providerInstructions = '';
          try {
            const serviceDoc = await getDoc(doc(db, 'services', matchResult.bestMatch.id));
            if (serviceDoc.exists()) {
              const serviceData = serviceDoc.data();
              providerInstructions = serviceData.providerInstructions || '';
            }
          } catch (err) {
            console.warn(`[A2A Negotiation] Failed to fetch providerInstructions for service ${matchResult.bestMatch.id}:`, err);
          }

          const proposal = {
            category: parsed.category || matchResult.bestMatch.category || 'General',
            serviceName: matchResult.bestMatch.serviceName || matchResult.bestMatch.name,
            dateTime: parsed.dateTime || 'Tomorrow, 10:00 AM',
            location: location,
            proposedPrice: quote.total
          };

          const negotiationHistory: string[] = [];
          const negotiationTraces: string[] = [];
          let currentProposedPrice = proposal.proposedPrice;
          let currentProposedDateTime = proposal.dateTime;
          let currentStatus = 'pending';
          const maxTurns = 2; // Strict limit to prevent infinite loops

          for (let turn = 1; turn <= maxTurns; turn++) {
            console.log(`[A2A Negotiation] Turn ${turn}: Customer Agent proposing Rs. ${currentProposedPrice} at ${currentProposedDateTime}`);
            negotiationTraces.push(`[Negotiation Turn ${turn}] Customer Agent proposed Rs. ${currentProposedPrice} at ${currentProposedDateTime}`);
            negotiationHistory.push(`Customer Agent: Proposed Rs. ${currentProposedPrice} at ${currentProposedDateTime}`);

            const evaluation = await supplierAgent.evaluateProposal(
              matchResult.bestMatch.providerName || matchResult.bestMatch.name,
              providerInstructions,
              {
                ...proposal,
                proposedPrice: currentProposedPrice,
                dateTime: currentProposedDateTime
              },
              negotiationHistory
            );

            console.log(`[A2A Negotiation] Supplier Agent Response:`, evaluation);
            negotiationTraces.push(`[Negotiation Turn ${turn}] ${matchResult.bestMatch.providerName || matchResult.bestMatch.name} Agent: ${evaluation.reasoning} (Decision: ${evaluation.status})`);
            negotiationHistory.push(`${matchResult.bestMatch.providerName || matchResult.bestMatch.name} Agent: Decision=${evaluation.status}, Price=${evaluation.negotiatedPrice}, Time=${evaluation.negotiatedDateTime}`);

            if (evaluation.status === 'accepted') {
              currentStatus = 'accepted';
              currentProposedPrice = evaluation.negotiatedPrice;
              currentProposedDateTime = evaluation.negotiatedDateTime;
              break;
            } else if (evaluation.status === 'counter_offer') {
              currentProposedPrice = evaluation.negotiatedPrice;
              currentProposedDateTime = evaluation.negotiatedDateTime;
              if (turn === maxTurns) {
                currentStatus = 'accepted'; // Force agreement on last turn to avoid hanging
                negotiationTraces.push(`[Negotiation] Customer Agent accepted counter-offer of Rs. ${currentProposedPrice} at ${currentProposedDateTime}`);
                break;
              }
            } else {
              currentStatus = 'rejected';
              break;
            }
          }

          // Update final bestMatch payload with negotiated details
          matchResult.bestMatch.pricePerHour = currentProposedPrice;
          matchResult.bestMatch.negotiatedDateTime = currentProposedDateTime;
          matchResult.bestMatch.negotiatedStatus = currentStatus;
          matchResult.bestMatch.negotiationTraces = negotiationTraces;
        }
      }

      // 4. Concierge Generation Phase
      const state = { 
        userName: userName,
        bookings: userBookings,
        bestMatch: matchResult?.bestMatch, 
        bookingStatus: parsed.action === 'view_bookings' ? 'LISTING_BOOKINGS' : (matchResult?.bestMatch ? 'PROPOSAL_READY' : 'SEARCHING')
      };
      const response = await concierge.reply(message, state);
      finalReply = response.reply;

      // Save the provider ID for the next message (if they say "book it")
      if (matchResult?.bestMatch) {
        userMemory.lastProviderId = matchResult.bestMatch.id;
      }
    }

    // ALWAYS UPDATE MEMORY AFTER EVERY MESSAGE
    if (!userMemory.history) {
      userMemory.history = [];
    }
    userMemory.history.push({ user: message, ai: finalReply });
    if (userMemory.history.length > 5) {
      userMemory.history.shift();
    }
    chatMemory.set(userId, userMemory);

    // Return the consolidated response EXACTLY matching the legacy format for the mobile app
    res.json({
      workplan: ["Analyze", "Search", "Match", "Respond"],
      reply: finalReply,
      traces: [
        `Plan: Analyze`,
        `Intent: ${parsed.category || 'General'}`,
        `Provider: ${matchResult?.bestMatch?.name || 'None found'}`,
        ...(matchResult?.bestMatch?.negotiationTraces || [])
      ],
      bestMatch: matchResult?.bestMatch,
      actionStatus: matchResult?.bestMatch ? 'PROPOSAL_READY' : 'SEARCHING'
    });

  } catch (error: any) {
    console.error("API Error:", error);
    
    // 100% Agentic Fallback (No Hardcoded text!)
    try {
      const errorState = { bestMatch: null, bookingStatus: 'ERROR' };
      const fallbackResponse = await concierge.reply("System encountered an error.", errorState);
      
      res.json({
        workplan: ["Error Recovery"],
        reply: fallbackResponse.reply,
        traces: [`System Error: ${error.message}`],
        bestMatch: null,
        actionStatus: "ERROR"
      });
    } catch (fallbackError) {
      // Ultimate absolute fallback if LLM API is completely down
      res.json({
        workplan: ["Critical Failure"],
        reply: "System is offline.",
        traces: ["LLM API unreachable"],
        bestMatch: null,
        actionStatus: "ERROR"
      });
    }
  }
});

app.listen(port, () => {
  console.log(`🚀 Wasila ADK Server is running on http://localhost:${port}`);
  console.log(`Ready to receive requests at POST /api/chat`);
});
