import express from 'express';
import cors from 'cors';
import { ParserAgent } from './agents/ParserAgent';
import { PlanningAgent } from './agents/PlanningAgent';
import { MatchmakerAgent } from './agents/MatchmakerAgent';
import { ConciergeAgent } from './agents/ConciergeAgent';
import { ActionAgent } from './agents/ActionAgent';

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

// --- IN-MEMORY CHAT STATE ---
// Stores the last message and provider for each user session without a database
const chatMemory = new Map();

app.post('/api/chat', async (req, res) => {
  try {
    const { message, history, userId: rawUserId } = req.body;
    const userId = rawUserId || 'guest';
    console.log(`\n--- New API Request: "${message}" (User: ${userId}) ---`);

    // Fetch user memory
    const userMemory = chatMemory.get(userId) || { historyText: "", lastProviderId: null };

    // Inject history context so agents remember the past
    const contextualMessage = `
      [Recent Memory]: ${userMemory.historyText || 'No previous chat'}
      [Current Message]: "${message}"
    `;

    // 1. Parsing Phase (Now memory-aware)
    const parsed = await parser.parse(contextualMessage);
    console.log("Parsed Intent:", parsed);

    let matchResult = null;
    let actionResult = null;
    let finalReply = "";

    // 2. Check if this is a booking confirmation action
    if (parsed.action && parsed.action.toLowerCase() === 'book') {
      // Use memory to know WHO to book if frontend doesn't send it
      const providerId = req.body.providerId || userMemory.lastProviderId; 
      if (providerId) {
        actionResult = await actionAgent.executeBooking(message, { providerId, userId: req.body.userId || 'guest' });
        finalReply = actionResult.message || "Aapki booking mukammal ho gayi hai!";
      } else {
        finalReply = "Maazrat, kis provider ko book karna hai ye samajh nahi aaya.";
      }
    } else {
      // 3. Normal Search / Matchmaking Phase
      if (parsed.category) {
        matchResult = await matchmaker.findMatch(message, parsed.category);
        console.log("Match Found:", matchResult.bestMatch?.name || "None");
      }

      // 4. Concierge Generation Phase
      const state = { 
        bestMatch: matchResult?.bestMatch, 
        bookingStatus: matchResult?.bestMatch ? 'PROPOSAL_READY' : 'SEARCHING' 
      };
      const response = await concierge.reply(message, state);
      finalReply = response.reply;

      // Save the provider ID for the next message (if they say "book it")
      if (matchResult?.bestMatch) {
        userMemory.lastProviderId = matchResult.bestMatch.id;
      }
    }

    // ALWAYS UPDATE MEMORY AFTER EVERY MESSAGE
    userMemory.historyText = `User said: "${message}" | AI replied: "${finalReply}"`;
    chatMemory.set(userId, userMemory);

    // Return the consolidated response EXACTLY matching the legacy format for the mobile app
    res.json({
      workplan: ["Analyze", "Search", "Match", "Respond"],
      reply: finalReply,
      traces: [
        `Plan: Analyze`,
        `Intent: ${parsed.category || 'General'}`,
        `Provider: ${matchResult?.bestMatch?.name || 'None found'}`
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
