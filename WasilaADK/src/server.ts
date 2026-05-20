import express from 'express';
import cors from 'cors';
import { ParserAgent } from './agents/ParserAgent';
import { PlanningAgent } from './agents/PlanningAgent';
import { MatchmakerAgent } from './agents/MatchmakerAgent';
import { ConciergeAgent } from './agents/ConciergeAgent';
import { ActionAgent } from './agents/ActionAgent';
import { PricingAgent } from './agents/PricingAgent';
import { SupplierAgent } from './agents/SupplierAgent';
import { getUserName, fetchUserBookings, db, saveChatSession, fetchLastChatSession } from './firebase';
import { getDoc, doc, updateDoc } from 'firebase/firestore';
import { callOpenRouter } from './utils/openRouter';

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
    let userAddress = '';
    if (userId && userId !== 'guest' && !userId.startsWith('test-user-')) {
      try {
        const userSnap = await getDoc(doc(db, 'users', userId));
        if (userSnap.exists()) {
          const uData = userSnap.data();
          userName = userName || uData.name || 'Guest User';
          userAddress = uData.address || '';
          console.log(`[User Profile] Resolved UID '${userId}' to Name: '${userName}', Address: '${userAddress || 'None'}'`);
        }
      } catch (err) {
        console.warn(`[User Profile] Failed to fetch user profile for UID: ${userId}`, err);
      }
    }
    if (!userName || userName.trim() === '') {
      userName = await getUserName(userId);
    }

    // Fetch user memory
    let userMemory = chatMemory.get(userId);
    if (!userMemory) {
      // Hydrate from Firestore if server restarted
      const lastSession = await fetchLastChatSession(userId);
      if (lastSession) {
        console.log(`[Session Hydration] Hydrating active session ${lastSession.id} for UID ${userId} from Firestore.`);
        const messages = lastSession.messages || [];
        const history: any[] = [];
        
        // Convert message format back to {user: string, ai: string} history
        for (let i = 0; i < messages.length; i++) {
          if (messages[i].sender === 'user' && messages[i+1]?.sender === 'ai') {
            history.push({
              user: messages[i].text,
              ai: messages[i+1].text
            });
          }
        }
        
        userMemory = {
          history: history.slice(-5), // Keep last 5 turns
          lastProviderId: lastSession.providerId || null,
          chatSessionId: lastSession.id,
          fullMessages: messages,
          currentCategory: lastSession.category || null,
          lastProviderUserId: lastSession.providerId || null,
          lastProviderName: lastSession.providerName || null
        };
      } else {
        userMemory = {
          history: [], 
          lastProviderId: null,
          chatSessionId: null,
          fullMessages: [],
          currentCategory: null,
          lastProviderUserId: null,
          lastProviderName: null
        };
      }
    }

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

    // Auto-update user profile address if not set, but user specified it in chat
    if (userId && userId !== 'guest' && !userId.startsWith('test-user-') && !userAddress && parsed.location) {
      try {
        await updateDoc(doc(db, 'users', userId), {
          address: parsed.location
        });
        console.log(`[User Profile Auto-Update] Automatically updated address to '${parsed.location}' for UID '${userId}'`);
        userAddress = parsed.location;
      } catch (updateErr) {
        console.warn(`[User Profile Auto-Update] Failed to write address for UID '${userId}':`, updateErr);
      }
    }

    // Resolve location: parsed location overrides profile address, falls back to Islamabad
    const resolvedLocation = parsed.location || userAddress || 'Islamabad';

    // Initialize session ID if not exists
    if (!userMemory.chatSessionId) {
      userMemory.chatSessionId = `chat_${userId}_${Date.now()}`;
      userMemory.fullMessages = [];
    }

    // Detect if category changed to start a fresh chat session
    if (parsed.category) {
      if (!userMemory.currentCategory || userMemory.currentCategory !== parsed.category) {
        userMemory.chatSessionId = `chat_${userId}_${Date.now()}`;
        userMemory.fullMessages = [];
        userMemory.currentCategory = parsed.category;
      }
    }

    // Push the user message
    userMemory.fullMessages.push({
      sender: 'user',
      text: message,
      timestamp: new Date().toISOString()
    });

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
              
              // Resolve and store provider user details
              const matchedProviderUserId = serviceData.providerId || matchResult.bestMatch.id;
              const matchedProviderName = serviceData.providerName || matchResult.bestMatch.providerName || matchResult.bestMatch.name;
              
              userMemory.lastProviderUserId = matchedProviderUserId;
              userMemory.lastProviderName = matchedProviderName;
              console.log(`[A2A Negotiation] Resolved provider: ${matchedProviderName} (UID: ${matchedProviderUserId})`);
            }
          } catch (err) {
            console.warn(`[A2A Negotiation] Failed to fetch provider details for service ${matchResult.bestMatch.id}:`, err);
          }

          const proposal = {
            category: parsed.category || matchResult.bestMatch.category || 'General',
            serviceName: matchResult.bestMatch.serviceName || matchResult.bestMatch.name,
            dateTime: parsed.dateTime || 'Tomorrow, 10:00 AM',
            location: resolvedLocation,
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
        userAddress: userAddress,
        bookings: userBookings,
        bestMatch: matchResult?.bestMatch, 
        bookingStatus: parsed.action === 'view_bookings' ? 'LISTING_BOOKINGS' : (matchResult?.bestMatch ? 'PROPOSAL_READY' : 'SEARCHING'),
        history: userMemory.history
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

    // Push the AI message
    userMemory.fullMessages.push({
      sender: 'ai',
      text: finalReply,
      timestamp: new Date().toISOString(),
      traces: matchResult?.bestMatch?.negotiationTraces || [],
      bestMatch: matchResult?.bestMatch || null
    });

    // Save to Firestore
    await saveChatSession(
      userMemory.chatSessionId,
      userId,
      userName,
      userMemory.fullMessages,
      {
        providerId: userMemory.lastProviderUserId || undefined,
        providerName: userMemory.lastProviderName || undefined,
        category: userMemory.currentCategory || undefined,
        lastMessage: finalReply
      }
    );

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

app.post('/api/generate-instructions', async (req, res) => {
  try {
    const { name, category, price } = req.body;
    console.log(`[AI Instructions Generator] Request for: ${name} (Category: ${category}, Price: ${price})`);

    const systemPrompt = `
      You are the Wasila Platform AI assistant.
      Your task is to generate short, clear, and realistic business negotiation guidelines for a service provider's agent.
      These guidelines should be written in English, brief, and format as bullet points (max 3 bullets).

      Rules to generate:
      1. Mention a minimum acceptable price threshold. This must be slightly lower than or equal to the published base price of Rs. ${price} (e.g. minimum Rs. ${Math.round(price * 0.8)} or Rs. ${price}) so that the agent can accept negotiations starting down from the base price.
      2. Suggest daily availability (e.g. Working hours: 9 AM to 6 PM, Sunday holiday).
      3. Suggest some slot preference (e.g. busy tomorrow morning, but free in the afternoon).
      
      Respond with ONLY the bullet points, no chat, no intro, no wrap-up.
    `;

    const userPrompt = `Generate guidelines for: Name="${name}", Category="${category}", Base Price=Rs. ${price}`;
    
    const result = await callOpenRouter(systemPrompt, userPrompt, { isJson: false });
    res.json({ instructions: result.trim() });
  } catch (error: any) {
    console.error("[AI Instructions Generator] Error:", error.message);
    res.status(500).json({ error: "Failed to generate instructions" });
  }
});

app.listen(port, () => {
  console.log(`🚀 Wasila ADK Server is running on http://localhost:${port}`);
  console.log(`Ready to receive requests at POST /api/chat`);
});
