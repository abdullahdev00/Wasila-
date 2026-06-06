import express from 'express';
import cors from 'cors';
import { ParserAgent } from './agents/ParserAgent';
import { PlanningAgent } from './agents/PlanningAgent';
import { MatchmakerAgent } from './agents/MatchmakerAgent';
import { ConciergeAgent } from './agents/ConciergeAgent';
import { ActionAgent } from './agents/ActionAgent';
import { PricingAgent } from './agents/PricingAgent';
import { SupplierAgent } from './agents/SupplierAgent';
import { CustomerNegotiatorAgent } from './agents/CustomerNegotiatorAgent';
import { DisputeAgent } from './agents/DisputeAgent';
import { getUserName, fetchUserBookings, db, saveChatSession, fetchLastChatSession, createBooking, releaseBookingPayment, refundBookingPayment, logTransaction, createDispute } from './firebase';
import { getDoc, doc, setDoc, updateDoc, collection, getDocs, addDoc, query, where } from 'firebase/firestore/lite';
import { callOpenRouter } from './utils/openRouter';
import { parseBookingDateToTimestamp } from './utils/dateParser';
import { deepSanitize, sanitizeText } from './utils/privacyFilter';
import { hookGlobalConsole } from './utils/logger';
import { checkContentSafety } from './utils/contentGuard';

// Hook the global console methods to redact sensitive PII and secrets in all logs automatically
hookGlobalConsole();


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
const customerNegotiator = new CustomerNegotiatorAgent();
const disputeAgent = new DisputeAgent();

// --- IN-MEMORY CHAT STATE ---
// Stores the last message and provider for each user session without a database
const chatMemory = new Map();

async function broadcastAgentTrace(
  sessionId: string,
  userId: string,
  userName: string,
  traces: Array<{ agent: string; status: 'running' | 'done' | 'failed'; detail: string; thinking?: string }>
) {
  if (!sessionId) return;
  try {
    const chatDocRef = doc(db, 'chats', sessionId);
    // Sanitize agent traces before saving to Firestore so that judges see the masked data on the mobile UI!
    const sanitizedTraces = deepSanitize(traces);
    await setDoc(chatDocRef, {
      userId,
      userName,
      activeTraces: sanitizedTraces,
      updatedAt: new Date().toISOString()
    }, { merge: true });
    console.log(`[Trace Broadcast] Session ${sessionId}: ${traces[traces.length - 1]?.agent} is ${traces[traces.length - 1]?.status}`);
  } catch (err: any) {
    console.warn(`[Trace Broadcast] Failed for session ${sessionId}:`, err.message);
  }
}

app.post('/api/chat', async (req, res) => {
  try {
    const { 
      message, 
      history, 
      userId: rawUserId, 
      userName: rawUserName,
      location: clientLocation,
      latitude: clientLatitude,
      longitude: clientLongitude
    } = req.body;
    const userId = rawUserId || 'guest';
    console.log(`\n--- New API Request: "${message}" (User: ${userId}) ---`);

    // --- CONTENT SAFETY GUARDRAIL CHECK ---
    const safetyCheck = checkContentSafety(message);
    if (safetyCheck.blocked) {
      console.log(`[Safety Block] Query blocked: "${message}" | Reason: ${safetyCheck.reason}`);
      
      const blockedTraces = [
        {
          agent: 'PrivacyGuardrail',
          status: 'failed' as const,
          detail: `❌ Blocked: ${safetyCheck.reason === 'profanity' ? 'Abusive Content' : safetyCheck.reason === 'injection' ? 'Security Threat' : 'Off-Topic Content'}`,
          thinking: `Content guardrail blocked message due to safety guidelines.`
        }
      ];
      if (req.body.sessionId) {
        await broadcastAgentTrace(req.body.sessionId, rawUserId || 'guest', rawUserName || 'User', blockedTraces);
      }
      
      return res.json({
        workplan: ["Analyze", "Block"],
        reply: safetyCheck.reply,
        traces: blockedTraces,
        bestMatch: null,
        actionStatus: 'BLOCKED',
        bookingConfirmed: false
      });
    }

    // Fetch user details dynamically from Firebase
    let userName = rawUserName || '';
    let userAddress = clientLocation || '';
    let userLatitude = clientLatitude || null;
    let userLongitude = clientLongitude || null;

    if (userId && userId !== 'guest' && !userId.startsWith('test-user-')) {
      try {
        const userSnap = await getDoc(doc(db, 'users', userId));
        if (userSnap.exists()) {
          const uData = userSnap.data();
          userName = userName || uData.name || 'Guest User';
          if (!userAddress) {
            userAddress = uData.address || '';
          }
          if (userLatitude === null || userLatitude === undefined) {
            userLatitude = uData.latitude || null;
          }
          if (userLongitude === null || userLongitude === undefined) {
            userLongitude = uData.longitude || null;
          }
          console.log(`[User Profile] Resolved UID '${userId}' to Name: '${userName}', Address: '${userAddress || 'None'}', Lat: ${userLatitude}, Lng: ${userLongitude}`);
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
    const clientSessionId = req.body.sessionId;

    if (clientSessionId) {
      // If the active session in memory is different from the requested one, force re-hydration
      if (!userMemory || userMemory.chatSessionId !== clientSessionId) {
        console.log(`[Session Switch] Client requested session ${clientSessionId}. Syncing/Hydrating.`);
        try {
          const chatDocRef = doc(db, 'chats', clientSessionId);
          const chatSnap = await getDoc(chatDocRef);
          if (chatSnap.exists()) {
            const lastSession = chatSnap.data();
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
            
            let lastMatch = null;
            for (let i = messages.length - 1; i >= 0; i--) {
              if (messages[i].sender === 'ai' && messages[i].bestMatch) {
                lastMatch = messages[i].bestMatch;
                break;
              }
            }

            userMemory = {
              history: history.slice(-5),
              lastProviderId: lastSession.serviceId || (lastMatch ? lastMatch.id : null),
              lastMatch: lastMatch,
              chatSessionId: clientSessionId,
              fullMessages: messages,
              currentCategory: lastSession.category || null,
              lastProviderUserId: lastSession.providerId || null,
              lastProviderName: lastSession.providerName || null
            };
          } else {
            // New session requested that doesn't exist in Firestore yet
            userMemory = {
              history: [],
              lastProviderId: null,
              lastMatch: null,
              chatSessionId: clientSessionId,
              fullMessages: [],
              currentCategory: null,
              lastProviderUserId: null,
              lastProviderName: null
            };
          }
          chatMemory.set(userId, userMemory);
        } catch (err) {
          console.error(`[Session Switch Error] Failed to hydrate ${clientSessionId}:`, err);
        }
      }
    }

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
        
        let lastMatch = null;
        for (let i = messages.length - 1; i >= 0; i--) {
          if (messages[i].sender === 'ai' && messages[i].bestMatch) {
            lastMatch = messages[i].bestMatch;
            break;
          }
        }

        userMemory = {
          history: history.slice(-5), // Keep last 5 turns
          lastProviderId: lastSession.serviceId || (lastMatch ? lastMatch.id : null),
          lastMatch: lastMatch,
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
          lastMatch: null,
          chatSessionId: null,
          fullMessages: [],
          currentCategory: null,
          lastProviderUserId: null,
          lastProviderName: null
        };
      }
      chatMemory.set(userId, userMemory);
    }

    // Initialize session ID if not exists
    if (!userMemory.chatSessionId) {
      userMemory.chatSessionId = `chat_${userId}_${Date.now()}`;
      userMemory.fullMessages = [];
    }

    // Fetch user bookings to build active bookings context
    const bookings = await fetchUserBookings(userId);
    const activeBookings = bookings.filter((b: any) => 
      ['pending', 'accepted', 'arrived', 'completed', 'rescheduled', 'disputed_no_show'].includes(b.status?.toLowerCase())
    );

    const bookingsSummary = activeBookings.map((b: any) => 
      `Booking ID: ${b.id} | Provider Name: ${b.providerName || 'Professional'} | Status: ${b.status} | Scheduled Time: ${b.date || 'unknown'}`
    ).join('\n');

    // Inject history context so agents remember the past
    const historyText = userMemory.history.map((h: any) => `User: "${h.user}" | AI: "${h.ai}"`).join('\n');
    const contextualMessage = deepSanitize(`
      [Active Bookings Context]:
      ${bookingsSummary || 'No active bookings'}

      [Recent Chat History]:
      ${historyText || 'No previous chat'}
      
      [Current User Message]: "${message}"
    `);

    const activeTraces: Array<{ agent: string; status: 'running' | 'done' | 'failed'; detail: string; thinking?: string }> = [];
    const pushAndBroadcastTrace = async (agent: string, status: 'running' | 'done' | 'failed', detail: string, thinking?: string) => {
      const existingIdx = activeTraces.findIndex(t => t.agent === agent);
      if (existingIdx !== -1) {
        activeTraces[existingIdx].status = status;
        activeTraces[existingIdx].detail = detail;
        if (thinking !== undefined) {
          activeTraces[existingIdx].thinking = thinking;
        }
      } else {
        const traceObj: any = { agent, status, detail };
        if (thinking !== undefined) {
          traceObj.thinking = thinking;
        }
        activeTraces.push(traceObj);
      }
      await broadcastAgentTrace(userMemory.chatSessionId, userId, userName, activeTraces);
    };

    const callConcierge = async (msg: string, state: any) => {
      await pushAndBroadcastTrace('ConciergeAgent', 'running', 'Formulating natural language response...');
      const response = await concierge.reply(deepSanitize(msg), deepSanitize(state));
      await pushAndBroadcastTrace('ConciergeAgent', 'done', 'Formulating natural language response...', (response as any).thinking);
      return response;
    };

    const callMatchmaker = async (msg: string, category: string, location: string) => {
      await pushAndBroadcastTrace('MatchmakerAgent', 'running', 'Scanning active service providers...');
      const result = await matchmaker.findMatch(deepSanitize(msg), deepSanitize(category), deepSanitize(location));
      // reasoning comes directly from LLM inside MatchmakerAgent — fully dynamic
      const matchThinking = result.reasoning
        ? `${result.reasoning}${result.bestMatch ? ` → Selected: ${result.bestMatch.name || result.bestMatch.providerName} (Rating: ${result.bestMatch.rating})` : ' → No match found'}`
        : undefined;
      await pushAndBroadcastTrace('MatchmakerAgent', 'done', 'Scanning active service providers...', matchThinking);
      return result;
    };

    const callPricing = async (basePrice: number, query: string, location: string) => {
      await pushAndBroadcastTrace('PricingAgent', 'running', 'Evaluating base fee, distance, and surge quote...');
      const result = await pricingAgent.calculateQuote(basePrice, deepSanitize(query), deepSanitize(location));
      // thinking built from actual quote result — dynamic
      const pricingThinking = `Base: Rs. ${result.base} | Distance fee: Rs. ${result.distanceFee} | Urgency: Rs. ${result.urgencyFee} | Surge: Rs. ${result.surgeFee} | Discount: Rs. ${result.discount} | Total: Rs. ${result.total}`;
      await pushAndBroadcastTrace('PricingAgent', 'done', 'Evaluating base fee, distance, and surge quote...', pricingThinking);
      return result;
    };

    const callSupplier = async (providerName: string, instructions: string, proposal: any, history: string[]) => {
      await pushAndBroadcastTrace('SupplierAgent', 'running', 'Negotiating price and schedule with provider...');
      const result = await supplierAgent.evaluateProposal(deepSanitize(providerName), deepSanitize(instructions), deepSanitize(proposal), deepSanitize(history));
      // reasoning comes from LLM inside SupplierAgent — fully dynamic
      const supplierThinking = result.reasoning
        ? `${result.reasoning} | Decision: ${result.status} | Price: Rs. ${result.negotiatedPrice} | Time: ${result.negotiatedDateTime}`
        : undefined;
      await pushAndBroadcastTrace('SupplierAgent', 'done', 'Negotiating price and schedule with provider...', supplierThinking);
      return result;
    };

    const callActionBooking = async (msg: string, details: any) => {
      await pushAndBroadcastTrace('ActionAgent', 'running', 'Executing database booking transaction...');
      const result = await actionAgent.executeBooking(msg, details);
      await pushAndBroadcastTrace('ActionAgent', 'done', 'Executing database booking transaction...', (result as any).thinking);
      return result;
    };

    const callActionCancellation = async (msg: string, details: any) => {
      await pushAndBroadcastTrace('ActionAgent', 'running', 'Cancelling booking in database...');
      const result = await actionAgent.executeCancellation(msg, details);
      await pushAndBroadcastTrace('ActionAgent', 'done', 'Cancelling booking in database...', (result as any).thinking);
      return result;
    };

    const callFetchBookings = async (uid: string) => {
      await pushAndBroadcastTrace('ActionAgent', 'running', 'Fetching bookings from database...');
      const result = await fetchUserBookings(uid);
      const fetchThinking = `Fetched ${Array.isArray(result) ? result.length : 0} booking(s) for user ${uid}`;
      await pushAndBroadcastTrace('ActionAgent', 'done', 'Fetching bookings from database...', fetchThinking);
      return result;
    };

    // --- PRIVACY GUARDRAIL SCAN ---
    const rawQuery = message || '';
    const hasCnic = /\b\d{5}-\d{7}-\d\b|\b\d{13}\b/.test(rawQuery);
    const hasPhone = /\b\d{9,12}\b|(?:\+?92[- ]?|0)?[- ]?3\d{2}[- ]?\d{7}\b/.test(rawQuery);
    const hasEmail = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/.test(rawQuery);

    if (hasCnic || hasPhone || hasEmail) {
      const redactedItems = [];
      if (hasCnic) redactedItems.push("CNIC");
      if (hasPhone) redactedItems.push("Phone Number");
      if (hasEmail) redactedItems.push("Email");
      
      await pushAndBroadcastTrace(
        'PrivacyGuardrail', 
        'done', 
        `🛡️ Redacted sensitive PII: ${redactedItems.join(', ')}`,
        `Privacy Shield automatically identified and masked user's ${redactedItems.join(', ')} to prevent leakage to OpenRouter/Gemini APIs.`
      );
    } else {
      await pushAndBroadcastTrace(
        'PrivacyGuardrail', 
        'done', 
        `🔒 Active: Scanned, no raw PII detected`,
        `No sensitive personal data (CNIC, Phone, Email) found in the user query.`
      );
    }

    // 1. Intent Parsing Phase (Now memory-aware)
    await pushAndBroadcastTrace('ParserAgent', 'running', 'Parsing request intent and category...');
    const parsed = await parser.parse(contextualMessage, message);
    // thinking is built dynamically inside ParserAgent from actual parsed values
    await pushAndBroadcastTrace('ParserAgent', 'done', 'Parsing request intent and category...', parsed.thinking);
    console.log("Parsed Intent:", parsed);

    // --- INTELLIGENT CONTENT SAFETY BLOCK (Layer 2 LLM Guardrail) ---
    if (parsed.safetyViolation) {
      const reason = parsed.safetyViolation;
      console.log(`[Safety Block LLM] Query blocked: "${message}" | Reason: ${reason}`);
      
      const isUrduScript = /[\u0600-\u06FF]/.test(message || '');
      let reply = "";
      if (reason === 'profanity') {
        reply = isUrduScript 
          ? "براہِ مہربانی، اخلاقیات کا دھیان رکھیں اور غلط الفاظ کا استعمال نہ کریں۔"
          : "Bara-e-meharbani, ikhlaqiat ka dhyan rakhein aur ghalat alfaz ka istemal na karein.";
      } else if (reason === 'off_topic') {
        const isPolitics = /imran|nawaz|pti|pmln|election|siasat/i.test(message || '');
        if (isPolitics) {
          reply = isUrduScript
            ? "وسیلہ صرف پروفیشنل سروسز (AC Repair, Plumber, etc.) کے لیے ہے۔ میں اس موضوع پر بات نہیں کر سکتا۔"
            : "Wasila sirf professional services (AC Repair, Plumber, etc.) ke liye hai. Main is topic par baat nahi kar sakta.";
        } else {
          reply = isUrduScript
            ? "وسیلہ صرف پروفیشنل سروسز کے لیے ہے۔ میں غیر متعلقہ موضوعات پر بات نہیں کر سکتا۔"
            : "Wasila sirf professional services ke liye hai. Main inappropriate ya off-topic subjects par baat nahi kar sakta.";
        }
      } else {
        reply = isUrduScript
          ? "سسٹم سیکیورٹی ایکٹو ہے۔ آپ کا ایکشن بلاک کر دیا گیا ہے۔"
          : "System security active hai. Aap ka action block kar diya gaya hai.";
      }

      const blockedTraces = [
        {
          agent: 'PrivacyGuardrail',
          status: 'failed' as const,
          detail: `❌ Blocked: ${reason === 'profanity' ? 'Abusive Content' : reason === 'injection' ? 'Security Threat' : 'Off-Topic Content'}`,
          thinking: `LLM safety scanner detected a policy violation: ${reason}.`
        }
      ];
      if (req.body.sessionId) {
        await broadcastAgentTrace(req.body.sessionId, rawUserId || 'guest', rawUserName || 'User', blockedTraces);
      }
      
      return res.json({
        workplan: ["Analyze", "Block"],
        reply: reply,
        traces: blockedTraces,
        bestMatch: null,
        actionStatus: 'BLOCKED',
        bookingConfirmed: false
      });
    }

    // Auto-update user profile address if not set, but user specified it in chat
    if (userId && userId !== 'guest' && !userId.startsWith('test-user-') && !userAddress && parsed.location) {
      try {
        await setDoc(doc(db, 'users', userId), {
          address: parsed.location
        }, { merge: true });
        console.log(`[User Profile Auto-Update] Automatically updated address to '${parsed.location}' for UID '${userId}'`);
        userAddress = parsed.location;
      } catch (updateErr) {
        console.warn(`[User Profile Auto-Update] Failed to write address for UID '${userId}':`, updateErr);
      }
    }

    // Resolve location: parsed location overrides profile address, falls back to Islamabad
    const cleanAddress = (userAddress && userAddress.toLowerCase() !== 'none') ? userAddress : '';
    const resolvedLocation = parsed.location || cleanAddress || 'Islamabad';
    console.log(`[Location Resolver] Client Payload/Saved Profile Address: '${userAddress || 'None'}', Parsed Intent Location: '${parsed.location || 'None'}' => Resolved Match Location: '${resolvedLocation}'`);

    // Detect if category changed to start a fresh chat session
    if (parsed.category) {
      const currentLower = (userMemory.currentCategory || '').toLowerCase();
      const parsedLower = parsed.category.toLowerCase();
      // Only reset memory if the category is completely different (not a substring of each other)
      const isSameOrSubcategory = currentLower && (currentLower.includes(parsedLower) || parsedLower.includes(currentLower));

      if (!userMemory.currentCategory || (!isSameOrSubcategory && userMemory.currentCategory !== parsed.category)) {
        console.log(`[Category Change] Resetting provider memory from category '${userMemory.currentCategory}' to '${parsed.category}'`);
        userMemory.currentCategory = parsed.category;
        userMemory.lastProviderId = null;
        userMemory.lastMatch = null;
        userMemory.lastProviderUserId = null;
        userMemory.lastProviderName = null;
      } else if (isSameOrSubcategory) {
        // Keep the more specific category in memory if they are related
        if (currentLower.length < parsedLower.length) {
          userMemory.currentCategory = parsed.category;
        }
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
    let finalBestMatch: any = null;

    // 2. Check if this is a booking confirmation action (and NOT a price negotiation)
    if (parsed.action && parsed.action.toLowerCase() === 'book' && !(parsed.proposedPrice && parsed.proposedPrice > 0)) {
      // Use memory to know WHO to book if frontend doesn't send it
      const providerId = req.body.providerId || userMemory.lastProviderId; 
      
      if (providerId) {
        finalBestMatch = userMemory.lastMatch || null;
        // Check if time is specified in this message, or fall back to previous negotiated time
        const resolvedTime = parsed.dateTime || (userMemory.lastMatch ? userMemory.lastMatch.negotiatedDateTime : null);
        if (resolvedTime) {
          const resolvedPrice = userMemory.lastMatch ? userMemory.lastMatch.pricePerHour : null;
          
          let scheduleValid = true;
          let evaluation: any = null;
          
          // Only validate if a new time was proposed in the current turn
          if (parsed.dateTime) {
            let providerInstructions = '';
            let providerName = 'Professional';
            try {
              const serviceDoc = await getDoc(doc(db, 'services', providerId));
              if (serviceDoc.exists()) {
                const serviceData = serviceDoc.data();
                providerInstructions = serviceData.providerInstructions || '';
                providerName = serviceData.providerName || serviceData.name || 'Professional';
              }
            } catch (err) {
              console.warn(`[Booking Validation] Failed to fetch service instructions:`, err);
            }
            
            const basePrice = finalBestMatch?.pricing?.base || finalBestMatch?.pricePerHour || 1000;
            evaluation = await supplierAgent.evaluateProposal(
              providerName,
              providerInstructions,
              {
                category: parsed.category || finalBestMatch?.category || 'General',
                serviceName: finalBestMatch?.serviceName || finalBestMatch?.name || 'Service',
                dateTime: resolvedTime,
                location: resolvedLocation,
                proposedPrice: resolvedPrice || basePrice,
                basePrice: basePrice
              },
              []
            );
            
            if (evaluation.status !== 'accepted') {
              scheduleValid = false;
            }
          }
          
          if (scheduleValid) {
            actionResult = await callActionBooking(message, { 
              providerId, 
              userId: req.body.userId || 'guest',
              dateTime: resolvedTime,
              price: resolvedPrice
            });
            finalReply = actionResult.message || "Aapki booking mukammal ho gayi hai!";
          } else {
            console.log(`[Booking Validation] Time rejected/countered by Supplier:`, evaluation);
            
            if (userMemory.lastMatch) {
              userMemory.lastMatch.negotiatedDateTime = evaluation.negotiatedDateTime;
              userMemory.lastMatch.negotiatedStatus = evaluation.status;
            }
            finalBestMatch = userMemory.lastMatch;
            
            const state = { 
              userName, userAddress, 
              bestMatch: finalBestMatch,
              bookingStatus: 'PROPOSAL_READY', history: userMemory.history
            };
            const response = await callConcierge(message, state);
            finalReply = response.reply;
          }
        } else {
          // Provider exists but no time. Ask the user for the time!
          const state = { 
            userName, userAddress, 
            bestMatch: finalBestMatch,
            bookingStatus: 'NEED_TIME', history: userMemory.history
          };
          const response = await callConcierge(message, state);
          finalReply = response.reply;
        }
      } else {
        // No provider in memory — auto-find best match
        const categoryToSearch = parsed.category || userMemory.currentCategory;
        
        if (categoryToSearch) {
          console.log(`[Auto-Book Flow] No provider in memory. Auto-finding best match for category: ${categoryToSearch}`);
          matchResult = await callMatchmaker(message, categoryToSearch, resolvedLocation);
          
          if (matchResult?.bestMatch) {
            finalBestMatch = matchResult.bestMatch;
            let providerInstructions = '';
            if (matchResult.bestMatch.isExternal) {
              matchResult.bestMatch.negotiatedDateTime = parsed.dateTime || 'Today';
              matchResult.bestMatch.negotiatedStatus = 'accepted';
              matchResult.bestMatch.negotiationTraces = [
                `[Google Maps Search] Found nearby business listing: ${matchResult.bestMatch.name}`,
                `[External Directory] Retrieved contact details: ${matchResult.bestMatch.phone}`,
                `[Status] Direct calling active.`
              ];
              userMemory.lastProviderId = matchResult.bestMatch.id;
              userMemory.lastMatch = matchResult.bestMatch;
              userMemory.currentCategory = categoryToSearch;
            } else {
              // Run negotiation first
              const basePrice = matchResult.bestMatch.pricePerHour || 1000;
              const location = matchResult.bestMatch.location || "Unknown";
              const quote = await callPricing(basePrice, message, location);
              matchResult.bestMatch.pricing = quote;

              providerInstructions = '';
              try {
                const serviceDoc = await getDoc(doc(db, 'services', matchResult.bestMatch.id));
                if (serviceDoc.exists()) {
                  const serviceData = serviceDoc.data();
                  providerInstructions = serviceData.providerInstructions || '';
                  userMemory.lastProviderUserId = serviceData.providerId || matchResult.bestMatch.id;
                  userMemory.lastProviderName = serviceData.providerName || serviceData.name || 'Professional';
                }
              } catch (err) {
                console.warn(`[Auto-Book] Failed to fetch service details:`, err);
              }

              // Update match details for the response card
              matchResult.bestMatch.pricePerHour = quote.total;
              matchResult.bestMatch.negotiatedDateTime = parsed.dateTime || 'Tomorrow, 10:00 AM';
              matchResult.bestMatch.negotiatedStatus = 'accepted';

              userMemory.lastProviderId = matchResult.bestMatch.id;
              userMemory.lastMatch = matchResult.bestMatch;
              userMemory.currentCategory = categoryToSearch;
            }

            if (parsed.dateTime && !matchResult.bestMatch.isExternal) {
              // Validate upfront time using the SupplierAgent
              const basePrice = matchResult.bestMatch.pricing?.base || 1000;
              const evaluation = await supplierAgent.evaluateProposal(
                userMemory.lastProviderName || 'Professional',
                providerInstructions,
                {
                  category: categoryToSearch,
                  serviceName: matchResult.bestMatch.name || 'Service',
                  dateTime: parsed.dateTime,
                  location: resolvedLocation,
                  proposedPrice: matchResult.bestMatch.pricePerHour,
                  basePrice: basePrice
                },
                []
              );

              if (evaluation.status === 'accepted') {
                console.log(`[Auto-Book Flow] Time accepted by Supplier. Creating booking...`);
                actionResult = await callActionBooking(message, {
                  providerId: matchResult.bestMatch.id,
                  userId: userId,
                  dateTime: parsed.dateTime,
                  price: matchResult.bestMatch.pricePerHour
                });
                finalReply = actionResult.message || "Aapki booking mukammal ho gayi hai!";
              } else {
                console.log(`[Auto-Book Flow] Time rejected/countered by Supplier:`, evaluation);
                
                // Update match details with countered details
                matchResult.bestMatch.negotiatedDateTime = evaluation.negotiatedDateTime;
                matchResult.bestMatch.negotiatedStatus = evaluation.status;
                finalBestMatch = matchResult.bestMatch;
                
                // Set state and ask Concierge to explain schedule issues
                const state = { 
                  userName, userAddress, 
                  bestMatch: finalBestMatch,
                  bookingStatus: 'PROPOSAL_READY', history: userMemory.history
                };
                const response = await callConcierge(message, state);
                finalReply = response.reply;
              }
            } else if (parsed.dateTime && matchResult.bestMatch.isExternal) {
              // External listings are booked directly
              actionResult = await callActionBooking(message, {
                providerId: matchResult.bestMatch.id,
                userId: userId,
                dateTime: parsed.dateTime,
                price: matchResult.bestMatch.pricePerHour
              });
              finalReply = actionResult.message || "Aapki booking mukammal ho gayi hai!";
            } else {
              // No time specified upfront. Ask the user for the time!
              console.log(`[Auto-Book Flow] Best match found but NO time specified. Asking user for time...`);
              const state = { 
                userName, userAddress, 
                bestMatch: finalBestMatch,
                bookingStatus: 'NEED_TIME', history: userMemory.history
              };
              const response = await callConcierge(message, state);
              finalReply = response.reply;
            }
          } else {
            // No provider found for this category
            finalBestMatch = null;
            const state = { 
              userName, userAddress, bestMatch: null,
              bookingStatus: 'NO_MATCH', history: userMemory.history
            };
            const response = await callConcierge(message, state);
            finalReply = response.reply;
          }
        } else {
          // No category and no provider — ask the user what they want
          finalBestMatch = null;
          const state = { 
            userName, userAddress, bestMatch: null,
            bookingStatus: 'NO_PROVIDER', history: userMemory.history
          };
          const response = await callConcierge(message, state);
          finalReply = response.reply;
        }
      }
    } else if (parsed.action && parsed.action.toLowerCase() === 'dispute') {
      console.log(`[Dispute Chat Flow] Resolving dispute query in chat: "${message}"`);
      
      let booking: any = null;
      // Search for any word in message that looks like a booking ID (length 15 to 25 alphanumeric)
      const words = message.split(/[\s,.;!?()]+/);
      for (const word of words) {
        if (word.length >= 15 && word.length <= 25 && /^[a-zA-Z0-9_-]+$/.test(word)) {
          try {
            const bSnap = await getDoc(doc(db, 'bookings', word));
            if (bSnap.exists()) {
              booking = { id: bSnap.id, ...bSnap.data() };
              console.log(`[Dispute Chat Flow] Extracted booking ID from chat: ${booking.id}`);
              break;
            }
          } catch (e) {}
        }
      }

      // Fallback to activeBookings[0] if no valid ID was found in the message
      if (!booking) {
        const disputeCandidates = bookings.filter((b: any) => 
          ['pending', 'accepted', 'arrived', 'completed', 'rescheduled'].includes(b.status?.toLowerCase())
        );
        if (disputeCandidates.length > 0) {
          booking = disputeCandidates[0];
          console.log(`[Dispute Chat Flow] Fallback to most recent active booking: ${booking.id}`);
        }
      }

      if (!booking) {
        finalReply = "Maazrat, Hamein aap ki koi active ya completed booking nahi mili jiske liye shikayat darj ki ja sakay.";
      } else {
        const bookingRef = doc(db, 'bookings', booking.id);
        const issueType = parsed.issueType || 'no_show';
        const serviceId = booking.serviceId;

        if (issueType === 'no_show') {
          const scheduledTimestamp = booking.scheduledTimestamp || 0;
          if (scheduledTimestamp && Date.now() < scheduledTimestamp) {
            console.log(`[Dispute Chat Flow] Rejecting premature no_show dispute in chat.`);
            finalReply = `Maazrat, aap ki booking ka scheduled time abhi nahi aaya (Scheduled: ${booking.date || 'unknown'}). Bara-e-meharbani scheduled time guzarne ka intezar karein.`;
          } else if (['pending', 'accepted', 'rescheduled'].includes(booking.status?.toLowerCase())) {
            console.log(`[Dispute Chat Flow] Intercepting no_show. Triggering provider response check...`);

            // A. Update booking status to disputed_no_show
            await retryDb(() => updateDoc(bookingRef, {
              status: 'disputed_no_show',
              disputedAt: Date.now()
            }));

            // B. Create a pending dispute document in Firestore `/disputes`
            await createDispute(
              booking.id,
              'no_show',
              message,
              'pending_provider_response',
              0,
              "Shikayat darj kar li gayi hai. Hum provider se confirm kar rahe hain ke wo aa rahe hain ya nahi.",
              'pending_provider_response'
            );

            // C. Create a notification for the provider to alert them in their dashboard
            const providerUserId = booking.providerId;
            if (providerUserId) {
              const notifCol = collection(db, 'notifications');
              await retryDb(() => addDoc(notifCol, {
                userId: providerUserId,
                title: "No-Show Report",
                message: `Customer ne report kiya hai ke aap abhi tak nahi pohanche. Kya aap ja rahe hain ya nahi?`,
                type: 'no_show_alert',
                bookingId: booking.id,
                timestamp: new Date().toISOString(),
                read: false
              }));
            }

            finalReply = "Aap ki shikayat (No-Show) darj kar li gayi hai. Hum provider se confirm kar rahe hain ke wo aa rahe hain ya nahi. Jaise hi unka reply aaye ga, aap ko notify kar diya jaye ga.";
          } else {
            // Already completed or arrived, evaluate using DisputeAgent
            await pushAndBroadcastTrace('DisputeAgent', 'running', 'Evaluating dispute evidence via AI...');
            const decision = await disputeAgent.evaluateDispute('no_show', message, booking);
            
            if (decision.isValid) {
              await retryDb(() => updateDoc(bookingRef, {
                status: 'cancelled_by_dispute',
                disputedAt: Date.now()
              }));
              await refundBookingPayment(booking.userId, booking.id, booking.price || 0, booking.serviceId, booking.providerName || 'Professional');
              
              // Penalize provider
              const serviceRef = doc(db, 'services', booking.serviceId);
              const serviceSnap = await retryDb(() => getDoc(serviceRef));
              if (serviceSnap.exists()) {
                const serviceData = serviceSnap.data();
                const cancellations = (serviceData.cancellations || 0) + 1;
                const penaltyDeduction = decision.providerPenalty || 15;
                const newScore = Math.max(0, (serviceData.reliabilityScore !== undefined ? serviceData.reliabilityScore : 100) - penaltyDeduction);
                await retryDb(() => updateDoc(serviceRef, { cancellations, reliabilityScore: newScore }));
              }
            }

            await createDispute(booking.id, 'no_show', message, decision.action, decision.refundAmount, decision.verdictSummary);
            await pushAndBroadcastTrace('DisputeAgent', 'done', 'Evaluating dispute evidence via AI...', decision.verdictSummary);
            finalReply = decision.verdictSummary;
          }
        } else if (issueType === 'overcharge') {
          // Trigger Overcharge evaluation using DisputeAgent
          await pushAndBroadcastTrace('DisputeAgent', 'running', 'Evaluating overcharge dispute evidence via AI...');
          const decision = await disputeAgent.evaluateDispute('overcharge', message, booking);

          if (decision.isValid) {
            if (decision.action === 'refund_difference') {
              await retryDb(() => updateDoc(bookingRef, {
                paymentStatus: 'refunded_partially',
                disputedAt: Date.now()
              }));

              // Deduct from provider
              const providerUserId = booking.providerId;
              if (providerUserId && providerUserId !== 'guest') {
                const providerUserRef = doc(db, 'users', providerUserId);
                const providerUserSnap = await retryDb(() => getDoc(providerUserRef));
                let providerWalletBalance = 0;
                if (providerUserSnap.exists()) {
                  providerWalletBalance = providerUserSnap.data().walletBalance !== undefined ? providerUserSnap.data().walletBalance : 0;
                }
                const newProviderWalletBalance = providerWalletBalance - decision.refundAmount;
                await retryDb(() => setDoc(providerUserRef, { walletBalance: newProviderWalletBalance }, { merge: true }));
                
                await logTransaction(providerUserId, booking.providerName || 'Professional', 'customer', booking.userName || 'Customer', booking.id, decision.refundAmount, 'penalty', `Rs. ${decision.refundAmount} deducted due to overcharge dispute`);
                
                await addDoc(collection(db, 'notifications'), {
                  userId: providerUserId,
                  title: "Overcharge Penalty Alert",
                  message: `Customer ke dispute ki wajah se aap ke wallet se Rs. ${decision.refundAmount} deduct kar liye gaye hain.`,
                  type: 'dispute_penalty',
                  bookingId: booking.id,
                  timestamp: new Date().toISOString(),
                  read: false
                });
              }

              // Deduct service earnings
              const serviceRef = doc(db, 'services', serviceId);
              const serviceSnap = await retryDb(() => getDoc(serviceRef));
              if (serviceSnap.exists()) {
                const serviceData = serviceSnap.data();
                const currentEarnings = serviceData.earnings || 0;
                await retryDb(() => updateDoc(serviceRef, { earnings: Math.max(0, currentEarnings - decision.refundAmount) }));
              }

              // Refund customer
              const customerUserRef = doc(db, 'users', booking.userId);
              const customerUserSnap = await retryDb(() => getDoc(customerUserRef));
              let customerWalletBalance = 0;
              if (customerUserSnap.exists()) {
                customerWalletBalance = customerUserSnap.data().walletBalance !== undefined ? customerUserSnap.data().walletBalance : 0;
              }
              const newCustomerWalletBalance = customerWalletBalance + decision.refundAmount;
              await retryDb(() => setDoc(customerUserRef, { walletBalance: newCustomerWalletBalance }, { merge: true }));

              await logTransaction(booking.userId, booking.userName || 'Customer', booking.serviceId, booking.providerName || 'Professional', booking.id, decision.refundAmount, 'refund', `Rs. ${decision.refundAmount} refunded due to overcharge dispute`);
            } else if (decision.action === 'refund_full') {
              // Cancel and refund full
              await retryDb(() => updateDoc(bookingRef, { status: 'cancelled_by_dispute', disputedAt: Date.now() }));
              await refundBookingPayment(booking.userId, booking.id, booking.price || 0, booking.serviceId, booking.providerName || 'Professional');
              
              // Penalize provider
              const serviceRef = doc(db, 'services', booking.serviceId);
              const serviceSnap = await retryDb(() => getDoc(serviceRef));
              if (serviceSnap.exists()) {
                const serviceData = serviceSnap.data();
                const cancellations = (serviceData.cancellations || 0) + 1;
                const penaltyDeduction = decision.providerPenalty || 15;
                const newScore = Math.max(0, (serviceData.reliabilityScore !== undefined ? serviceData.reliabilityScore : 100) - penaltyDeduction);
                await retryDb(() => updateDoc(serviceRef, { cancellations, reliabilityScore: newScore }));
              }
            }
          }

          await createDispute(booking.id, 'overcharge', message, decision.action, decision.refundAmount, decision.verdictSummary);
          await pushAndBroadcastTrace('DisputeAgent', 'done', 'Evaluating overcharge dispute evidence via AI...', decision.verdictSummary);
          finalReply = decision.verdictSummary;
        } else {
          finalReply = "Maazrat, main abhi is tarah ki shikayat ko process nahi kar sakta.";
        }
      }
    } else if (parsed.action && parsed.action.toLowerCase() === 'cancel') {
      console.log(`[Cancel Flow] Executing cancellation for query: "${message}"`);
      actionResult = await callActionCancellation(message, {
        userId,
        category: parsed.category
      });
      if (actionResult.status === 'success') {
        userMemory.lastProviderId = null;
        userMemory.lastMatch = null;
      }
      finalReply = actionResult.message || "Aapki booking cancel ho gayi hai!";
      finalBestMatch = null;
    } else if (parsed.action && parsed.action.toLowerCase() === 'chat') {
      // Pure casual conversation — skip matchmaking entirely
      finalBestMatch = null;
      const state = { 
        userName: userName,
        userAddress: userAddress,
        bookings: null,
        bestMatch: null,
        bookingStatus: 'CHATTING',
        history: userMemory.history
      };
      const response = await callConcierge(message, state);
      finalReply = response.reply;
    } else if (parsed.action && parsed.action.toLowerCase() === 'chat_provider') {
      const providerId = userMemory.lastProviderId;
      const providerUserId = userMemory.lastProviderUserId;
      const providerName = userMemory.lastProviderName || 'Provider';

      if (providerId && providerUserId) {
        console.log(`[Direct Chat Activation] Activating direct chat for session ${userMemory.chatSessionId} with provider ${providerName} (${providerUserId})`);
        
        // 1. Update chat document in Firestore
        try {
          const chatDocRef = doc(db, 'chats', userMemory.chatSessionId);
          await retryDb(() => updateDoc(chatDocRef, {
            directChatActive: true,
            providerId: providerUserId,
            providerName: providerName,
            updatedAt: new Date().toISOString()
          }));
        } catch (err: any) {
          console.error(`[Direct Chat Activation Error] Failed to update chat doc:`, err.message);
        }

        // 2. Create notification document in Firestore for the provider
        try {
          const notificationsCol = collection(db, 'notifications');
          const notificationData = {
            userId: providerUserId, // Target the provider
            title: "Direct Chat Request",
            message: `${userName} aap se direct baat karna chahte hain. Chat tab me ja kar reply karein!`,
            type: 'direct_chat',
            sessionId: userMemory.chatSessionId,
            timestamp: new Date().toISOString(),
            read: false
          };
          await retryDb(() => addDoc(notificationsCol, notificationData));
          console.log(`[Direct Chat Activation] Provider notification created successfully for ${providerUserId}`);
        } catch (err: any) {
          console.error(`[Direct Chat Notification Error] Failed to create notification:`, err.message);
        }

        const isUrduScript = /[\u0600-\u06FF]/.test(message || '');
        finalReply = isUrduScript
          ? `جی بالکل، میں آپ کی بات براہِ راست ${providerName} سے کروا رہا ہوں۔ اب آپ ان سے براہِ راست چیٹ کر سکتے ہیں۔`
          : `Ji bilkul, main aap ki direct chat ${providerName} se connect kar raha hoon. Ab aap unse direct guftagu kar sakte hain.`;
        
        finalBestMatch = userMemory.lastMatch;
      } else {
        const isUrduScript = /[\u0600-\u06FF]/.test(message || '');
        finalReply = isUrduScript
          ? "براہِ مہربانی، پہلے کسی سروس فراہم کنندہ کو سرچ یا سلیکٹ کریں تاکہ میں آپ کی بات کروا سکوں۔"
          : "Bara-e-meharbani, pehle kisi service provider ko search ya select karein taake main aap ki baat karwa sakoon.";
        
        finalBestMatch = null;
      }
    } else {
      // Fetch bookings if user wants to view them
      if (parsed.action && parsed.action.toLowerCase() === 'view_bookings') {
        userBookings = await callFetchBookings(userId);
        console.log(`[User Bookings] Fetched ${userBookings.length} booking(s) for UID '${userId}'`);
      }

      const resolvedCategory = parsed.category || userMemory.currentCategory;
      if (resolvedCategory) {
        matchResult = await callMatchmaker(message, resolvedCategory, resolvedLocation);
        if (matchResult?.bestMatch) {
          if (matchResult.bestMatch.isExternal) {
            // Bypass negotiation for external Google Maps directory providers!
            matchResult.bestMatch.negotiatedDateTime = parsed.dateTime || 'Today';
            matchResult.bestMatch.negotiatedStatus = 'accepted';
            matchResult.bestMatch.negotiationTraces = [
              `[Google Maps Search] Found nearby business listing: ${matchResult.bestMatch.name}`,
              `[External Directory] Retrieved contact details: ${matchResult.bestMatch.phone}`,
              `[Status] Direct calling active.`
            ];
          } else {
            const basePrice = matchResult.bestMatch.pricePerHour || 1000;
            const location = matchResult.bestMatch.location || "Unknown";
            const quote = await callPricing(basePrice, message, location);
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
                const matchedProviderName = serviceData.providerName || matchResult.bestMatch.providerName || matchResult.bestMatch.name || 'Professional';
                
                userMemory.lastProviderUserId = matchedProviderUserId;
                userMemory.lastProviderName = matchedProviderName;
                console.log(`[A2A Negotiation] Resolved provider: ${matchedProviderName} (UID: ${matchedProviderUserId})`);
              }
            } catch (err) {
              console.warn(`[A2A Negotiation] Failed to fetch provider details for service ${matchResult.bestMatch.id}:`, err);
            }

            const customerProposal = {
              category: parsed.category || matchResult.bestMatch.category || 'General',
              serviceName: matchResult.bestMatch.serviceName || matchResult.bestMatch.name,
              dateTime: parsed.dateTime || 'Tomorrow, 10:00 AM',
              location: resolvedLocation,
              quoteTotal: quote.total,
              proposedPrice: (parsed.proposedPrice && parsed.proposedPrice > 0) ? parsed.proposedPrice : null
            };

            const negotiationHistory: string[] = [];
            const negotiationTraces: string[] = [];
            let currentProposedPrice = quote.total;
            let currentProposedDateTime = customerProposal.dateTime;
            let currentStatus = 'pending';
            let lastSupplierOffer: any = null;
            const maxTurns = 2; // Strict limit to prevent infinite loops

            for (let turn = 1; turn <= maxTurns; turn++) {
              // Call Customer Agent
              await pushAndBroadcastTrace('CustomerNegotiatorAgent', 'running', 'Negotiator formulating offer...');
              const custOffer = await customerNegotiator.generateOffer(
                deepSanitize(customerProposal),
                deepSanitize(negotiationHistory),
                deepSanitize(lastSupplierOffer),
                turn,
                maxTurns
              );
              
              await pushAndBroadcastTrace('CustomerNegotiatorAgent', 'done', 'Negotiator formulated offer...', custOffer.reasoning);

              if (custOffer.status === 'accepted') {
                currentStatus = 'accepted';
                break;
              } else if (custOffer.status === 'rejected') {
                currentStatus = 'rejected';
                break;
              }

              currentProposedPrice = custOffer.negotiatedPrice;
              currentProposedDateTime = custOffer.negotiatedDateTime;

              console.log(`[A2A Negotiation] Turn ${turn}: Customer Agent proposing Rs. ${currentProposedPrice} at ${currentProposedDateTime}`);
              negotiationTraces.push(`[Negotiation Turn ${turn}] Customer Agent proposed Rs. ${currentProposedPrice}: "${custOffer.reasoning}"`);
              negotiationHistory.push(`Customer Agent: Proposed Rs. ${currentProposedPrice} at ${currentProposedDateTime}`);

              // Call Supplier Agent
              const evaluation = await callSupplier(
                userMemory.lastProviderName || 'Professional',
                providerInstructions,
                {
                  category: customerProposal.category,
                  serviceName: customerProposal.serviceName,
                  dateTime: currentProposedDateTime,
                  location: customerProposal.location,
                  proposedPrice: currentProposedPrice,
                  basePrice: basePrice
                },
                negotiationHistory
              );

              lastSupplierOffer = {
                status: evaluation.status,
                price: evaluation.negotiatedPrice,
                time: evaluation.negotiatedDateTime,
                reasoning: evaluation.reasoning
              };

              console.log(`[A2A Negotiation] Supplier Agent Response:`, evaluation);
              negotiationTraces.push(`[Negotiation Turn ${turn}] ${userMemory.lastProviderName || 'Provider'} Agent: "${evaluation.reasoning}" (Decision: ${evaluation.status})`);
              negotiationHistory.push(`${userMemory.lastProviderName || 'Provider'} Agent: Decision=${evaluation.status}, Price=${evaluation.negotiatedPrice}, Time=${evaluation.negotiatedDateTime}`);

              if (evaluation.status === 'accepted') {
                currentStatus = 'accepted';
                currentProposedPrice = evaluation.negotiatedPrice;
                currentProposedDateTime = evaluation.negotiatedDateTime;
                break;
              } else if (evaluation.status === 'counter_offer') {
                currentProposedPrice = evaluation.negotiatedPrice;
                currentProposedDateTime = evaluation.negotiatedDateTime;
                if (turn === maxTurns) {
                  // Final decision by Customer Agent
                  await pushAndBroadcastTrace('CustomerNegotiatorAgent', 'running', 'Negotiator evaluating final counter-offer...');
                  const finalDecision = await customerNegotiator.generateOffer(
                    deepSanitize(customerProposal),
                    deepSanitize(negotiationHistory),
                    deepSanitize(lastSupplierOffer),
                    turn + 1,
                    maxTurns
                  );
                  await pushAndBroadcastTrace('CustomerNegotiatorAgent', 'done', 'Negotiator evaluated final counter-offer...', finalDecision.reasoning);

                  if (finalDecision.status === 'rejected') {
                    currentStatus = 'rejected';
                  } else {
                    currentStatus = 'accepted'; // Force agreement on last turn to avoid hanging if they didn't reject
                    negotiationTraces.push(`[Negotiation] Customer Agent accepted counter-offer of Rs. ${currentProposedPrice}`);
                  }
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
          finalBestMatch = matchResult.bestMatch;
        } else {
          finalBestMatch = null;
        }
      } else {
        if (parsed.action === 'book' || (parsed.action === 'search' && !parsed.category)) {
          finalBestMatch = userMemory.lastMatch || null;
        } else {
          finalBestMatch = null;
        }
      }

      // 4. Concierge Generation Phase
      const state = { 
        userName: userName,
        userAddress: userAddress,
        bookings: userBookings,
        bestMatch: finalBestMatch, 
        bookingStatus: parsed.action === 'view_bookings' ? 'LISTING_BOOKINGS' : (finalBestMatch ? 'PROPOSAL_READY' : (resolvedCategory ? 'NO_MATCH' : 'SEARCHING')),
        history: userMemory.history
      };
      const response = await callConcierge(message, state);
      finalReply = response.reply;

      // Save the provider ID and full match for the next message (if they say "book it" or "hmm")
      if (matchResult?.bestMatch) {
        userMemory.lastProviderId = matchResult.bestMatch.id;
        userMemory.lastMatch = matchResult.bestMatch;
      }
    }

    // Sanitize any PII in the final reply before saving and sending
    finalReply = sanitizeText(finalReply);

    // ALWAYS UPDATE MEMORY AFTER EVERY MESSAGE
    if (!userMemory.history) {
      userMemory.history = [];
    }
    userMemory.history.push({ user: message, ai: finalReply });
    if (userMemory.history.length > 5) {
      userMemory.history.shift();
    }

    const bookingConfirmed = !!(parsed.action?.toLowerCase() === 'book' && actionResult && actionResult.status === "success");

    // Push the AI message
    userMemory.fullMessages.push({
      sender: 'ai',
      text: finalReply,
      timestamp: new Date().toISOString(),
      traces: activeTraces,
      bestMatch: finalBestMatch,
      bookingConfirmed: bookingConfirmed
    });

    // Save to Firestore
    await saveChatSession(
      userMemory.chatSessionId,
      userId,
      userName,
      userMemory.fullMessages,
      {
        serviceId: userMemory.lastProviderId || undefined,
        providerId: userMemory.lastProviderUserId || undefined,
        providerName: userMemory.lastProviderName || undefined,
        category: userMemory.currentCategory || undefined,
        lastMessage: finalReply
      }
    );

    chatMemory.set(userId, userMemory);

    res.json({
      workplan: ["Analyze", "Search", "Match", "Respond"],
      reply: finalReply,
      traces: activeTraces,
      bestMatch: finalBestMatch,
      actionStatus: bookingConfirmed ? 'CONFIRMED' : (matchResult?.bestMatch ? 'PROPOSAL_READY' : 'SEARCHING'),
      bookingConfirmed: bookingConfirmed
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

    const minSuggestedPrice = Math.round(price * 0.8);
    const systemPrompt = `
      You are the Wasila Platform AI assistant.
      Your task is to generate short, clear, and realistic business negotiation guidelines for a service provider's agent.
      These guidelines should be written in English, brief, and formatted as bullet points (max 3 bullets).

      CRITICAL PRICING RULE:
      The minimum acceptable price threshold MUST be exactly Rs. ${minSuggestedPrice} (which is 80% of the base price of Rs. ${price}). 
      You MUST NEVER set a minimum price higher than Rs. ${price}. Setting a minimum price higher than the base price of Rs. ${price} is strictly forbidden.
      Example: "- Minimum acceptable price: Rs. ${minSuggestedPrice}"

      Other Rules:
      1. Mention that negotiations can go down to Rs. ${minSuggestedPrice} from the base price of Rs. ${price}.
      2. Suggest daily availability (e.g. Working hours: 9 AM to 6 PM, Sunday holiday).
      3. Suggest some slot preference (e.g. busy tomorrow morning, but free in the afternoon).
      
      Respond with ONLY the bullet points, no chat, no intro, no wrap-up.
    `;

    const userPrompt = `Generate guidelines for: Name="${name}", Category="${category}", Base Price=Rs. ${price}, Min Allowed Price=Rs. ${minSuggestedPrice}`;
    
    const result = await callOpenRouter(systemPrompt, userPrompt, { isJson: false });
    res.json({ instructions: result.trim() });
  } catch (error: any) {
    console.error("[AI Instructions Generator] Error:", error.message);
    res.status(500).json({ error: "Failed to generate instructions" });
  }
});

app.post('/api/reminders', async (req, res) => {
  try {
    console.log(`[Reminders Engine] Running periodic reminder check...`);
    const bookingsCol = collection(db, 'bookings');
    const bookingsSnap = await getDocs(bookingsCol);
    const alertLogs: string[] = [];

    const now = new Date();
    
    for (const d of bookingsSnap.docs) {
      const bookingData = d.data();
      const status = bookingData.status || '';
      const reminderSent = bookingData.reminderSent || false;

      // In our simulation, we check for accepted/rescheduled bookings that haven't received reminders yet
      if ((status === 'accepted' || status === 'rescheduled') && !reminderSent) {
        // Update booking document
        await updateDoc(doc(db, 'bookings', d.id), {
          reminderSent: true,
          reminderTimestamp: now.toISOString()
        });

        // Simulate sending reminders (creating notifications logs in Firestore)
        const notificationsCol = collection(db, 'notifications');
        const alertMsg = `[1-Hour Reminder Alert] Hi ${bookingData.userName || 'Client'}, your service request for "${bookingData.serviceName}" with provider ${bookingData.providerName || 'Professional'} is scheduled for "${bookingData.date}". The provider is on their way!`;
        
        await setDoc(doc(notificationsCol, `reminder_${d.id}`), {
          bookingId: d.id,
          userId: bookingData.userId,
          providerId: bookingData.providerId,
          message: alertMsg,
          timestamp: now.toISOString(),
          type: 'reminder'
        });

        console.log(`[Reminders Engine] Sent reminder alert for Booking ID: ${d.id}`);
        alertLogs.push(`Sent reminder for booking ${d.id} (${bookingData.serviceName}) to client ${bookingData.userName} and provider ${bookingData.providerName}`);
      }
    }

    res.json({
      success: true,
      message: `Checked bookings. Sent ${alertLogs.length} reminder(s).`,
      alerts: alertLogs
    });
  } catch (error: any) {
    console.error("[Reminders Engine] Error:", error.message);
    res.status(500).json({ error: "Failed to run reminders engine" });
  }
});

// --- PROVIDER ACTION ENDPOINTS (RELIABILITY UPDATES) ---

// Helper function to retry Firestore operations in case of transient network drops
async function retryDb<T>(operation: () => Promise<T>, maxRetries = 4, delayMs = 1500): Promise<T> {
  for (let i = 1; i <= maxRetries; i++) {
    try {
      return await operation();
    } catch (err: any) {
      console.warn(`[Firestore Server Retry] Attempt ${i}/${maxRetries} failed: ${err.message}. Retrying in ${delayMs}ms...`);
      if (i === maxRetries) throw err;
      await new Promise(r => setTimeout(r, delayMs));
    }
  }
  throw new Error("Retry failed");
}

// 1. Arrived Endpoint: Marks provider arrival and calculates if late
app.post('/api/bookings/:id/arrived', async (req, res) => {
  try {
    const bookingId = req.params.id;
    const bookingRef = doc(db, 'bookings', bookingId);
    const bookingSnap = await retryDb(() => getDoc(bookingRef));

    if (!bookingSnap.exists()) {
      return res.status(404).json({ error: "Booking not found" });
    }

    const bookingData = bookingSnap.data();
    const serviceId = bookingData.serviceId;

    if (!serviceId) {
      return res.status(400).json({ error: "Booking does not have a valid serviceId" });
    }

    const now = Date.now();
    const scheduledTime = bookingData.scheduledTimestamp || parseBookingDateToTimestamp(bookingData.date || 'Tomorrow, 10:00 AM');
    
    // Grace period is 15 minutes (15 * 60 * 1000 ms)
    const isLate = now > (scheduledTime + 15 * 60 * 1000);

    // Update booking status
    await retryDb(() => updateDoc(bookingRef, {
      status: 'arrived',
      arrivalTimestamp: now,
      isLate: isLate
    }));

    // Create notification document in Firestore for the customer (user)
    try {
      const notificationsCol = collection(db, 'notifications');
      const providerName = bookingData.providerName || 'Provider';
      const notificationData = {
        userId: bookingData.userId, // Target the customer
        title: "Provider Arrived",
        message: `Aap ke provider ${providerName} location par pahunch chuke hain.`,
        type: 'provider_arrived',
        bookingId: bookingId,
        timestamp: new Date().toISOString(),
        read: false
      };
      await retryDb(() => addDoc(notificationsCol, notificationData));
      console.log(`[Provider Arrived Notification] Notification created for customer ${bookingData.userId}`);
    } catch (err: any) {
      console.error(`[Provider Arrived Notification Error] Failed to create notification:`, err.message);
    }

    // Fetch and update provider's metrics in the services collection
    const serviceRef = doc(db, 'services', serviceId);
    const serviceSnap = await retryDb(() => getDoc(serviceRef));

    if (serviceSnap.exists()) {
      const serviceData = serviceSnap.data();
      const lateArrivals = (serviceData.lateArrivals || 0) + (isLate ? 1 : 0);
      const cancellations = serviceData.cancellations || 0;
      
      // Calculate reliability score: Starts at 100%, deducts 5% per late arrival, 10% per cancellation
      const newScore = Math.max(0, 100 - (lateArrivals * 5) - (cancellations * 10));

      await retryDb(() => updateDoc(serviceRef, {
        lateArrivals: lateArrivals,
        reliabilityScore: newScore
      }));

      console.log(`[Provider Arrived] Booking ID: ${bookingId} | Late: ${isLate} | New Reliability Score: ${newScore}%`);
      return res.json({
        success: true,
        isLate,
        reliabilityScore: newScore,
        message: isLate ? "Provider marked arrived but arrived LATE. Reliability score updated." : "Provider marked arrived ON TIME."
      });
    }

    res.json({ success: true, isLate, message: "Booking updated, but provider service profile not found." });
  } catch (error: any) {
    console.error("[Arrived Route] Error:", error.message);
    res.status(500).json({ error: "Failed to mark arrival" });
  }
});

// 2. Cancellation Endpoint: Cancel booking from provider side with heavy penalties
app.post('/api/bookings/:id/provider-cancel', async (req, res) => {
  try {
    const bookingId = req.params.id;
    const bookingRef = doc(db, 'bookings', bookingId);
    const bookingSnap = await retryDb(() => getDoc(bookingRef));

    if (!bookingSnap.exists()) {
      return res.status(404).json({ error: "Booking not found" });
    }

    const bookingData = bookingSnap.data();
    const serviceId = bookingData.serviceId;

    if (!serviceId) {
      return res.status(400).json({ error: "Booking does not have a valid serviceId" });
    }

    const isPending = bookingData.status === 'pending';

    // Update booking status
    await retryDb(() => updateDoc(bookingRef, {
      status: isPending ? 'declined' : 'cancelled_by_provider',
      cancelledAt: Date.now()
    }));

    // Trigger refunding payment escrow
    try {
      await refundBookingPayment(
        bookingData.userId,
        bookingId,
        bookingData.price || 0,
        serviceId,
        bookingData.providerName || 'Professional'
      );
    } catch (escrowErr: any) {
      console.warn(`[Provider Cancel Route] Escrow refund failed for booking ${bookingId}:`, escrowErr.message);
    }

    // Fetch provider's metrics in the services collection
    const serviceRef = doc(db, 'services', serviceId);
    const serviceSnap = await retryDb(() => getDoc(serviceRef));

    let originalProviderName = bookingData.providerName || 'Professional';
    let newReliabilityScore = 100;
    let newRating = 4.5;

    if (serviceSnap.exists()) {
      const serviceData = serviceSnap.data();
      originalProviderName = serviceData.providerName || serviceData.name || originalProviderName;
      newReliabilityScore = serviceData.reliabilityScore !== undefined ? serviceData.reliabilityScore : 100;
      newRating = serviceData.rating !== undefined ? serviceData.rating : 4.5;

      if (!isPending) {
        const lateArrivals = serviceData.lateArrivals || 0;
        const cancellations = (serviceData.cancellations || 0) + 1;
        
        // Calculate reliability score: deducts 10% per cancellation
        const newScore = Math.max(0, 100 - (lateArrivals * 5) - (cancellations * 10));
        // Penalize public rating by 0.2 points (e.g. from 4.8 to 4.6)
        const currentRating = serviceData.rating !== undefined ? serviceData.rating : 4.5;
        const calculatedRating = Math.max(1.0, Math.round((currentRating - 0.2) * 10) / 10);

        newReliabilityScore = newScore;
        newRating = calculatedRating;

        await retryDb(() => updateDoc(serviceRef, {
          cancellations: cancellations,
          reliabilityScore: newScore,
          rating: calculatedRating
        }));

        console.log(`[Provider Cancel] Booking ID: ${bookingId} | New Reliability Score: ${newScore}% | New Rating: ${calculatedRating}`);
      } else {
        console.log(`[Provider Decline] Booking ID: ${bookingId} is pending. Skipping reliability penalty for ${originalProviderName}.`);
      }
    }

    // --- PROACTIVE RECOVERY AGENT WORKFLOW ---
    const userId = bookingData.userId || 'guest';
    const category = bookingData.category || '';
    const bookingDate = bookingData.date || 'Tomorrow, 10:00 AM';

    // 1. Resolve user location and details
    let userAddress = 'Islamabad';
    let userName = 'Guest User';
    try {
      const userSnap = await retryDb(() => getDoc(doc(db, 'users', userId)));
      if (userSnap.exists()) {
        const userData = userSnap.data();
        userAddress = userData.address || 'Islamabad';
        userName = userData.name || 'Guest User';
      }
    } catch (err: any) {
      console.warn(`[Recovery Flow] Failed to fetch user profile:`, err.message);
    }

    // 1b. Proactively hydrate user session from memory or Firestore
    let userMemory = chatMemory.get(userId);
    let activeSessionId = `chat_${userId}_${Date.now()}`;
    let fullMessages: any[] = [];
    let history: any[] = [];

    try {
      console.log(`[Debug Recovery] Hydrating session for userId: "${userId}"`);
      const allChatsSnap = await getDocs(collection(db, 'chats'));
      console.log(`[Debug Recovery] Total chat documents in Firestore chats collection: ${allChatsSnap.docs.length}`);
      allChatsSnap.forEach(d => {
        console.log(`- Chat Doc ID: "${d.id}" | userId: "${d.data().userId}" | updatedAt: "${d.data().updatedAt}"`);
      });

      const lastSession = await fetchLastChatSession(userId);
      console.log(`[Debug Recovery] fetchLastChatSession result:`, lastSession ? lastSession.id : 'null');
      if (lastSession) {
        activeSessionId = lastSession.id;
        fullMessages = lastSession.messages || [];
        for (let i = 0; i < fullMessages.length; i++) {
          if (fullMessages[i].sender === 'user' && fullMessages[i+1]?.sender === 'ai') {
            history.push({
              user: fullMessages[i].text,
              ai: fullMessages[i+1].text
            });
          }
        }
      }
    } catch (hydrateErr: any) {
      console.warn(`[Recovery Flow] Failed to hydrate last session:`, hydrateErr.message);
    }

    if (!userMemory || userMemory.chatSessionId !== activeSessionId) {
      userMemory = {
        history: history.slice(-5),
        lastProviderId: null,
        lastMatch: null,
        chatSessionId: activeSessionId,
        fullMessages: fullMessages,
        currentCategory: category,
        lastProviderUserId: null,
        lastProviderName: null
      };
    }

    // 2. Find next-best provider (excluding the cancelled service doc ID)
    console.log(`[Recovery Flow] Proactively seeking next-best provider for category '${category}' in '${userAddress}' (excluding service ID: ${serviceId})...`);
    
    let matchResult: any = null;
    if (category) {
      try {
        matchResult = await matchmaker.findMatch(
          deepSanitize(`Mujhe ${category} chahiye ${userAddress} me`),
          deepSanitize(category),
          deepSanitize(userAddress),
          serviceId // exclude the cancelled provider
        );
      } catch (matchErr: any) {
        console.error(`[Recovery Flow] Matchmaking error:`, matchErr.message);
      }
    }

    let recoveryNotificationMsg = '';
    let recoveryState: any = null;

    if (matchResult && matchResult.bestMatch) {
      console.log(`[Recovery Flow] Next-best provider found: ${matchResult.bestMatch.providerName} (ID: ${matchResult.bestMatch.id})`);
      
      // Calculate dynamic pricing quote for this provider
      let pricingQuote = { total: matchResult.bestMatch.pricePerHour || 1000, base: matchResult.bestMatch.pricePerHour || 1000, distanceFee: 0, urgencyFee: 0, surgeFee: 0, discount: 0 };
      try {
        pricingQuote = await pricingAgent.calculateQuote(
          matchResult.bestMatch.pricePerHour || 1000,
          deepSanitize(`Mujhe ${category} chahiye ${userAddress} me`),
          deepSanitize(matchResult.bestMatch.location || userAddress)
        );
      } catch (priceErr: any) {
        console.warn(`[Recovery Flow] Pricing error:`, priceErr.message);
      }

      const finalPrice = pricingQuote.total;
      matchResult.bestMatch.pricing = pricingQuote;
      matchResult.bestMatch.pricePerHour = finalPrice; // Standard rate saved to memory
      matchResult.bestMatch.negotiatedDateTime = bookingDate;
      matchResult.bestMatch.negotiatedStatus = 'accepted';
      matchResult.bestMatch.negotiationTraces = [
        `[Recovery Agent] Original booking cancelled by ${originalProviderName}`,
        `[Matchmaker] Auto-selected next-best provider: ${matchResult.bestMatch.providerName}`
      ];

      // Automatically create the new recovery booking in Firestore
      let autoBookingId = "";
      try {
        autoBookingId = await createBooking(userId, matchResult.bestMatch.id, {
          price: finalPrice,
          date: bookingDate,
          notes: `[Auto Recovery] Alternate booking created automatically after original booking ${bookingId} was cancelled/declined by ${originalProviderName}.`
        });
        console.log(`[Recovery Flow] Successfully created automatic alternate booking ID: ${autoBookingId}`);
      } catch (bookErr: any) {
        console.error(`[Recovery Flow] Failed to create automatic alternate booking:`, bookErr.message);
      }

      // Proactively update user's session memory
      userMemory.lastProviderId = matchResult.bestMatch.id;
      userMemory.lastMatch = {
        ...matchResult.bestMatch,
        bookingId: autoBookingId
      };
      userMemory.currentCategory = category;

      // Call Concierge Agent in RECOVERY state to generate the natural language apology and recommendation
      recoveryState = {
        userName,
        userAddress,
        bestMatch: {
          ...matchResult.bestMatch,
          bookingId: autoBookingId
        },
        originalProviderName: originalProviderName,
        bookingStatus: 'RECOVERY',
        history: userMemory.history
      };

      let conciergeReply = `${originalProviderName} ne booking cancel krdi ha. Hum ne ${matchResult.bestMatch.providerName} select kiya ha. Humne aapke liye automatic booking confirm krdi ha!`;
      try {
        const replyObj = await concierge.reply("Mera provider cancel hogya", deepSanitize(recoveryState));
        conciergeReply = replyObj.reply;
      } catch (replyErr: any) {
        console.warn(`[Recovery Flow] Concierge reply error:`, replyErr.message);
      }

      // Save this conversational message directly to chat session messages
      userMemory.fullMessages.push({
        sender: 'ai',
        text: conciergeReply,
        timestamp: new Date().toISOString(),
        bestMatch: {
          ...matchResult.bestMatch,
          bookingId: autoBookingId
        },
        bookingConfirmed: true,
        traces: [
          { agent: 'ParserAgent', status: 'done', detail: 'System alert: Provider cancellation event detected.' },
          { agent: 'MatchmakerAgent', status: 'done', detail: 'Auto-found next-best provider.', thinking: `Cancelled: ${originalProviderName} | Selected: ${matchResult.bestMatch.providerName}` },
          { agent: 'PricingAgent', status: 'done', detail: 'Retrieved pricing quote.', thinking: `Price: Rs. ${finalPrice}` },
          { agent: 'ConciergeAgent', status: 'done', detail: 'Formulated recovery recommendation.' }
        ]
      });

      // Save chat session to Firestore
      try {
        await saveChatSession(
          userMemory.chatSessionId,
          userId,
          userName,
          userMemory.fullMessages,
          {
            serviceId: matchResult.bestMatch.id,
            category: category,
            lastMessage: conciergeReply
          }
        );
      } catch (saveErr: any) {
        console.warn(`[Recovery Flow] Failed to save chat session:`, saveErr.message);
      }

      chatMemory.set(userId, userMemory);

      // Define notification message
      recoveryNotificationMsg = `[Recovery Alert] Hum maazrat chahtey hain, ${originalProviderName} ne aapki booking cancel kar di hai. Humne aapke liye automatically next-best provider ${matchResult.bestMatch.providerName} ko book kar diya hai! Booking ID: ${autoBookingId}`;

    } else {
      // CASE B: No backup provider found
      console.log(`[Recovery Flow] No backup provider found in category '${category}' in '${userAddress}'`);
      
      userMemory.lastProviderId = null;
      userMemory.lastMatch = null;

      recoveryState = {
        userName,
        userAddress,
        bestMatch: null,
        originalProviderName: originalProviderName,
        bookingStatus: 'RECOVERY_NO_MATCH',
        history: userMemory.history
      };

      let conciergeReply = `Hum maazrat chahtey hain, ${originalProviderName} ne booking cancel kar di hai. Is waqt koi aur provider available nahi hai.`;
      try {
        const replyObj = await concierge.reply("Mera provider cancel hogya aur koi aur nahi mila", deepSanitize(recoveryState));
        conciergeReply = replyObj.reply;
      } catch (replyErr: any) {
        console.warn(`[Recovery Flow] Concierge reply error:`, replyErr.message);
      }

      userMemory.fullMessages.push({
        sender: 'ai',
        text: conciergeReply,
        timestamp: new Date().toISOString(),
        bestMatch: null,
        bookingConfirmed: false,
        traces: [
          { agent: 'ParserAgent', status: 'done', detail: 'System alert: Provider cancellation event detected.' },
          { agent: 'MatchmakerAgent', status: 'done', detail: 'No other active providers available in this city.', thinking: `Cancelled: ${originalProviderName} | Backup: None` },
          { agent: 'ConciergeAgent', status: 'done', detail: 'Formulated cancellation response.' }
        ]
      });

      // Save chat session to Firestore
      try {
        await saveChatSession(
          userMemory.chatSessionId,
          userId,
          userName,
          userMemory.fullMessages,
          {
            category: category,
            lastMessage: conciergeReply
          }
        );
      } catch (saveErr: any) {
        console.warn(`[Recovery Flow] Failed to save chat session:`, saveErr.message);
      }

      chatMemory.set(userId, userMemory);

      // Define notification message
      recoveryNotificationMsg = `[Recovery Alert] Hum maazrat chahtey hain, ${originalProviderName} ne booking cancel kar di hai. Is waqt koi aur back-up provider available nahi hai.`;
    }

    // 3. Write Recovery Notification Document to Firestore (type: 'recovery')
    try {
      const notificationsCol = collection(db, 'notifications');
      const docId = `recovery_${bookingId}_${Date.now()}`;
      await retryDb(() => setDoc(doc(notificationsCol, docId), {
        bookingId: bookingId,
        userId: userId,
        message: recoveryNotificationMsg,
        timestamp: new Date().toISOString(),
        type: 'recovery'
      }));
      console.log(`[Recovery Flow] Proactive push notification saved successfully for user UID: ${userId}`);
    } catch (notifErr: any) {
      console.warn(`[Recovery Flow] Failed to save recovery notification:`, notifErr.message);
    }

    return res.json({
      success: true,
      reliabilityScore: newReliabilityScore,
      rating: newRating,
      recoveryMatch: matchResult?.bestMatch || null,
      message: isPending
        ? "Booking declined by provider. Penalty skipped. Proactive recovery triggered."
        : "Booking cancelled by provider. Reliability score and rating penalized. Proactive recovery triggered."
    });

  } catch (error: any) {
    console.error("[Provider Cancel Route] Error:", error.message);
    res.status(500).json({ error: "Failed to process cancellation" });
  }
});

// 3. Complete Endpoint: Marks booking as successfully completed
app.post('/api/bookings/:id/complete', async (req, res) => {
  try {
    const bookingId = req.params.id;
    const bookingRef = doc(db, 'bookings', bookingId);
    const bookingSnap = await retryDb(() => getDoc(bookingRef));

    if (!bookingSnap.exists()) {
      return res.status(404).json({ error: "Booking not found" });
    }

    const bookingData = bookingSnap.data();
    const serviceId = bookingData.serviceId;

    if (!serviceId) {
      return res.status(400).json({ error: "Booking does not have a valid serviceId" });
    }

    // Update booking status
    await retryDb(() => updateDoc(bookingRef, {
      status: 'completed',
      completedAt: Date.now()
    }));

    // Trigger releasing payment escrow
    try {
      await releaseBookingPayment(
        bookingData.userId,
        bookingId,
        bookingData.price || 0,
        serviceId,
        bookingData.providerName || 'Professional'
      );
    } catch (escrowErr: any) {
      console.warn(`[Complete Route] Escrow release failed for booking ${bookingId}:`, escrowErr.message);
    }

    // Update completed bookings count
    const serviceRef = doc(db, 'services', serviceId);
    const serviceSnap = await retryDb(() => getDoc(serviceRef));

    if (serviceSnap.exists()) {
      const serviceData = serviceSnap.data();
      const completedCount = (serviceData.totalCompletedBookings || 0) + 1;

      await retryDb(() => updateDoc(serviceRef, {
        totalCompletedBookings: completedCount
      }));

      console.log(`[Booking Completed] Booking ID: ${bookingId} | Total Completed Bookings: ${completedCount}`);
      return res.json({
        success: true,
        totalCompletedBookings: completedCount,
        message: "Booking marked as successfully completed."
      });
    }

    res.json({ success: true, message: "Booking completed, but provider service profile not found." });
  } catch (error: any) {
    console.error("[Complete Route] Error:", error.message);
    res.status(500).json({ error: "Failed to mark completion" });
  }
});

app.post('/api/users/:id/deposit', async (req, res) => {
  try {
    const userId = req.params.id;
    const { amount } = req.body;
    
    if (!amount || typeof amount !== 'number' || amount <= 0) {
      return res.status(400).json({ error: "Invalid deposit amount" });
    }

    const userRef = doc(db, 'users', userId);
    const userSnap = await retryDb(() => getDoc(userRef));
    
    let walletBalance = 0;
    let userName = 'Guest User';

    if (userSnap.exists()) {
      const data = userSnap.data();
      walletBalance = data.walletBalance !== undefined ? data.walletBalance : 0;
      userName = data.name || userName;
    }

    const newWalletBalance = walletBalance + amount;

    await retryDb(() => updateDoc(userRef, {
      walletBalance: newWalletBalance
    }));

    // Log transaction
    try {
      await logTransaction(
        userId,
        userName,
        'system',
        'Wasila Platform',
        'deposit_simulation',
        amount,
        'deposit',
        `Rs. ${amount.toLocaleString()} deposited via simulation card`
      );
    } catch (logErr: any) {
      console.warn(`[Deposit Simulation Route] Transaction log skipped/failed:`, logErr.message);
    }

    console.log(`[Deposit Simulation] Deposited Rs. ${amount} to user ${userId}. New balance: Rs. ${newWalletBalance}`);
    
    return res.json({
      success: true,
      walletBalance: newWalletBalance,
      message: `Successfully deposited Rs. ${amount.toLocaleString()}.`
    });
  } catch (error: any) {
    console.error("[Deposit Simulation Route] Error:", error.message);
    res.status(500).json({ error: "Failed to simulate deposit" });
  }
});

app.post('/api/bookings/:bookingId/dispute-response', async (req, res) => {
  try {
    const { bookingId } = req.params;
    const { response } = req.body; // 'coming' | 'no_go'

    console.log(`\n[Dispute Response Endpoint] Booking: ${bookingId} | Response: ${response}`);

    const bookingRef = doc(db, 'bookings', bookingId);
    const bookingSnap = await retryDb(() => getDoc(bookingRef));

    if (!bookingSnap.exists()) {
      return res.status(404).json({ error: "Booking not found" });
    }

    const bookingData = bookingSnap.data();
    const serviceId = bookingData.serviceId;
    const userId = bookingData.userId;
    const providerId = bookingData.providerId;

    const disputesCol = collection(db, 'disputes');
    const disputesSnap = await retryDb(() => getDocs(query(disputesCol, where('bookingId', '==', bookingId))));
    let disputeDocRef = null;
    if (!disputesSnap.empty) {
      const firstDispute = disputesSnap.docs[0];
      disputeDocRef = doc(db, 'disputes', firstDispute.id);
    }

    if (response === 'coming') {
      // 1. Restore booking status to 'accepted'
      await retryDb(() => updateDoc(bookingRef, {
        status: 'accepted',
        disputeResponse: 'coming',
        timestamp: new Date().toISOString()
      }));

      // 2. Create notification for customer
      const notifCol = collection(db, 'notifications');
      await retryDb(() => addDoc(notifCol, {
        userId: userId,
        title: "Provider Coming",
        message: `${bookingData.providerName || 'Provider'} ne confirm kiya hai ke wo aa rahe hain aur late hone par mazrat ki hai. Aap un ka wait kar sakte hain.`,
        type: 'provider_coming',
        bookingId: bookingId,
        timestamp: new Date().toISOString(),
        read: false
      }));

      // 3. Update dispute document to resolved/closed with coming status
      if (disputeDocRef) {
        await retryDb(() => updateDoc(disputeDocRef, {
          status: 'resolved',
          resolutionAction: 'provider_coming',
          verdictSummary: "Provider ne confirm kiya hai ke wo aa rahe hain aur late hone par mazrat ki hai."
        }));
      }

      return res.json({
        success: true,
        message: "Status updated back to accepted. Customer has been notified."
      });

    } else if (response === 'no_go') {
      // 1. Update booking status to 'cancelled_by_dispute'
      await retryDb(() => updateDoc(bookingRef, {
        status: 'cancelled_by_dispute',
        disputeResponse: 'no_go',
        disputedAt: Date.now()
      }));

      // 2. Escrow refund back to the customer's wallet
      try {
        await refundBookingPayment(
          userId,
          bookingId,
          bookingData.price || 0,
          serviceId || '',
          bookingData.providerName || 'Professional'
        );
      } catch (escrowErr: any) {
        console.warn(`[Dispute Response] Refund failed for booking ${bookingId}:`, escrowErr.message);
      }

      // 3. Penalize provider reliability score (-15%)
      if (serviceId) {
        const serviceRef = doc(db, 'services', serviceId);
        const serviceSnap = await retryDb(() => getDoc(serviceRef));

        if (serviceSnap.exists()) {
          const serviceData = serviceSnap.data();
          const cancellations = (serviceData.cancellations || 0) + 1;
          const newScore = Math.max(0, (serviceData.reliabilityScore !== undefined ? serviceData.reliabilityScore : 100) - 15);

          await retryDb(() => updateDoc(serviceRef, {
            cancellations: cancellations,
            reliabilityScore: newScore
          }));
        }
      }

      // 4. Update dispute document
      if (disputeDocRef) {
        await retryDb(() => updateDoc(disputeDocRef, {
          status: 'resolved',
          resolutionAction: 'refund_full',
          verdictSummary: "Provider ne aane se inkar kar diya. Booking cancel kar di gai hai aur full payment customer ke wallet mein refund kar di gai hai."
        }));
      }

      // 5. Trigger Recovery Agent Workflow with Apology
      let apologyMessage = `Hum bohot mazrat chahte hain ke ${bookingData.providerName || 'Provider'} nahi aa sake. `;
      let backupSuccess = false;
      let backupProviderName = '';
      let backupPrice = 0;

      try {
        const matchResult = await matchmaker.findMatch(
          `plumber AC Electrician repair`,
          bookingData.category || 'General',
          bookingData.location || 'Islamabad',
          serviceId || undefined
        );

        if (matchResult?.bestMatch) {
          const backupMatch = matchResult.bestMatch;
          backupProviderName = backupMatch.name || backupMatch.providerName || 'Professional';
          
          const basePrice = backupMatch.pricePerHour || 1000;
          const quote = await pricingAgent.calculateQuote(basePrice, "booking", backupMatch.location || "Islamabad");
          backupPrice = quote.total;

          const userRef = doc(db, 'users', userId);
          const userSnap = await getDoc(userRef);
          if (userSnap.exists()) {
            const userData = userSnap.data();
            const walletBalance = userData.walletBalance || 0;
            const holdingBalance = userData.holdingBalance || 0;

            if (walletBalance >= backupPrice) {
              const newBookingId = await createBooking(userId, backupMatch.id, {
                price: backupPrice,
                date: bookingData.date || 'Today',
                notes: 'Auto-booked backup service after provider cancellation'
              });

              await logTransaction(
                userId,
                userData.name || 'Customer',
                backupMatch.id,
                backupProviderName,
                newBookingId,
                backupPrice,
                'payment_hold',
                `Rs. ${backupPrice} held in Escrow for backup booking with ${backupProviderName}`
              );

              await updateDoc(userRef, {
                walletBalance: walletBalance - backupPrice,
                holdingBalance: holdingBalance + backupPrice
              });

              backupSuccess = true;
              apologyMessage += `Lekin pareshan na hon, humne aapke liye ek naye provider, ${backupProviderName}, ke saath backup booking bana di hai. Unka rate Rs. ${backupPrice} hai aur booking confirm ho chuki hai.`;
            } else {
              apologyMessage += `Humne backup provider ki koshish ki lekin aapke wallet mein balance kam tha (Required: Rs. ${backupPrice}). Bara-e-meharbani wallet reload kar ke dobara book karein.`;
            }
          }
        } else {
          apologyMessage += `Humne backup provider search kiya lekin us waqt koi aur provider available nahi tha. Aap hamari service list se dobara search kar sakte hain.`;
        }
      } catch (recoveryErr: any) {
        console.error("[Recovery Engine Error]:", recoveryErr.message);
        apologyMessage += `Hum backup provider connect nahi kar sake. Bara-e-meharbani hamari main screen se naya provider search karein.`;
      }

      // 6. Update user's chat session doc history
      try {
        const lastSession = await fetchLastChatSession(userId);
        if (lastSession) {
          const chatDocRef = doc(db, 'chats', lastSession.id);
          const currentMessages = lastSession.messages || [];
          currentMessages.push({
            sender: 'ai',
            text: apologyMessage,
            timestamp: new Date().toISOString()
          });
          await updateDoc(chatDocRef, {
            messages: currentMessages,
            updatedAt: new Date().toISOString()
          });
        }
      } catch (chatErr: any) {
        console.error("[Dispute Response] Failed to write apology to chat session:", chatErr.message);
      }

      // 7. Write push notification
      const notifCol = collection(db, 'notifications');
      await retryDb(() => addDoc(notifCol, {
        userId: userId,
        title: "Booking Cancelled",
        message: apologyMessage,
        type: 'recovery',
        timestamp: new Date().toISOString(),
        read: false
      }));

      return res.json({
        success: true,
        message: "Booking cancelled, customer refunded, reliability penalized, and recovery process completed."
      });
    }

  } catch (error: any) {
    console.error("[Dispute Response Route Error]:", error.message);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/disputes', async (req, res) => {
  try {
    const { bookingId, issueType, details } = req.body;

    if (!bookingId || !issueType || !details) {
      return res.status(400).json({ error: "Missing required dispute fields (bookingId, issueType, details)" });
    }

    console.log(`\n[Dispute Endpoint] Processing dispute for booking: ${bookingId} | Issue: ${issueType}...`);

    // 1. Fetch booking details
    const bookingRef = doc(db, 'bookings', bookingId);
    const bookingSnap = await retryDb(() => getDoc(bookingRef));

    if (!bookingSnap.exists()) {
      return res.status(404).json({ error: "Booking not found" });
    }

    const bookingData = bookingSnap.data();

    // Check for premature no-show complaints
    if (issueType === 'no_show') {
      const scheduledTimestamp = bookingData.scheduledTimestamp || 0;
      if (scheduledTimestamp && Date.now() < scheduledTimestamp) {
        console.log(`[Dispute Endpoint] Premature no_show dispute rejected. Scheduled time: ${bookingData.date}`);
        return res.json({
          success: true,
          isValid: false,
          verdict: `Maazrat, aap ki booking ka scheduled time abhi nahi aaya (Scheduled: ${bookingData.date || 'unknown'}). Bara-e-meharbani scheduled time guzarne ka intezar karein.`,
          refundAmount: 0,
          action: "rejected"
        });
      }
    }

    const serviceId = bookingData.serviceId;

    if (!serviceId) {
      return res.status(400).json({ error: "Booking does not have a valid serviceId" });
    }

    // Intercept check for interactive No-Show flow
    if (issueType === 'no_show' && ['pending', 'accepted', 'rescheduled'].includes(bookingData.status?.toLowerCase())) {
      console.log(`[Dispute Endpoint] Intercepting no_show dispute. Booking status is '${bookingData.status}'. Triggering provider response check flow...`);

      // A. Update booking status to disputed_no_show
      await retryDb(() => updateDoc(bookingRef, {
        status: 'disputed_no_show',
        disputedAt: Date.now()
      }));

      // B. Create a pending dispute document in Firestore `/disputes`
      await createDispute(
        bookingId,
        issueType,
        details,
        'pending_provider_response',
        0,
        "Shikayat darj kar li gayi hai. Hum provider se confirm kar rahe hain ke wo aa rahe hain ya nahi.",
        'pending_provider_response'
      );

      // C. Create a notification for the provider to alert them in their dashboard
      const providerUserId = bookingData.providerId;
      if (providerUserId) {
        const notifCol = collection(db, 'notifications');
        await retryDb(() => addDoc(notifCol, {
          userId: providerUserId,
          title: "No-Show Report",
          message: `Customer ne report kiya hai ke aap abhi tak nahi pohanche. Kya aap ja rahe hain ya nahi?`,
          type: 'no_show_alert',
          bookingId: bookingId,
          timestamp: new Date().toISOString(),
          read: false
        }));
      }

      return res.json({
        success: true,
        isValid: true,
        pendingProviderResponse: true,
        verdict: "Shikayat darj kar li gayi hai. Hum provider se confirm kar rahe hain ke wo aa rahe hain ya nahi. Aap ko jald hi notification mil jae ga.",
        refundAmount: 0,
        action: "pending_provider_response"
      });
    }

    // 2. Run DisputeAgent to evaluate the claim
    const decision = await disputeAgent.evaluateDispute(issueType, details, {
      id: bookingSnap.id,
      ...bookingData
    });

    console.log(`[Dispute Agent Decision]:`, decision);

    if (decision.isValid) {
      // Execute Resolution Actions
      if (decision.action === 'refund_full') {
        // A. Update booking status in database
        await retryDb(() => updateDoc(bookingRef, {
          status: 'cancelled_by_dispute',
          disputedAt: Date.now()
        }));

        // B. Trigger full escrow refund back to the customer's wallet
        try {
          await refundBookingPayment(
            bookingData.userId,
            bookingId,
            bookingData.price || 0,
            serviceId,
            bookingData.providerName || 'Professional'
          );
        } catch (escrowErr: any) {
          console.warn(`[Dispute Route] Refund failed for booking ${bookingId}:`, escrowErr.message);
        }

        // C. Fetch and penalize provider's reliability score in the services collection
        const serviceRef = doc(db, 'services', serviceId);
        const serviceSnap = await retryDb(() => getDoc(serviceRef));

        if (serviceSnap.exists()) {
          const serviceData = serviceSnap.data();
          const lateArrivals = serviceData.lateArrivals || 0;
          const cancellations = (serviceData.cancellations || 0) + 1; // Count as a cancellation
          
          // Apply custom penalty (reliability penalty, e.g. -15%)
          const penaltyDeduction = decision.providerPenalty || 15;
          const newScore = Math.max(0, (serviceData.reliabilityScore !== undefined ? serviceData.reliabilityScore : 100) - penaltyDeduction);

          await retryDb(() => updateDoc(serviceRef, {
            cancellations: cancellations,
            reliabilityScore: newScore
          }));
          console.log(`[Dispute Penalty] Deducted ${penaltyDeduction}% from provider reliability. New Score: ${newScore}%`);
        }
      } else if (decision.action === 'refund_difference') {
        // A. Update booking payment status
        await retryDb(() => updateDoc(bookingRef, {
          paymentStatus: 'refunded_partially',
          disputedAt: Date.now()
        }));

        // B. Deduct overcharge from provider wallet
        const providerUserId = bookingData.providerId;
        if (providerUserId && providerUserId !== 'guest') {
          const providerUserRef = doc(db, 'users', providerUserId);
          const providerUserSnap = await retryDb(() => getDoc(providerUserRef));
          let providerWalletBalance = 0;
          if (providerUserSnap.exists()) {
            providerWalletBalance = providerUserSnap.data().walletBalance !== undefined ? providerUserSnap.data().walletBalance : 0;
          }
          const newProviderWalletBalance = providerWalletBalance - decision.refundAmount;
          await retryDb(() => setDoc(providerUserRef, {
            walletBalance: newProviderWalletBalance
          }, { merge: true }));

          // Log provider transaction (penalty)
          try {
            await logTransaction(
              providerUserId,
              bookingData.providerName || 'Professional',
              'customer',
              bookingData.userName || 'Customer',
              bookingId,
              decision.refundAmount,
              'penalty',
              `Rs. ${decision.refundAmount.toLocaleString()} deducted due to overcharge dispute resolution for booking with client ${bookingData.userName || 'Customer'}`
            );
          } catch (logErr: any) {
            console.warn(`[Dispute Route] Provider transaction log failed:`, logErr.message);
          }

          // Create notification warning for provider
          try {
            const notifCol = collection(db, 'notifications');
            await retryDb(() => addDoc(notifCol, {
              userId: providerUserId,
              title: "Overcharge Penalty Alert",
              message: `Customer ke dispute ki wajah se aap ke wallet se Rs. ${decision.refundAmount} deduct kar liye gaye hain. Bara-e-meharbani agreed price par hi kaam kiya karein.`,
              type: 'dispute_penalty',
              bookingId: bookingId,
              timestamp: new Date().toISOString(),
              read: false
            }));
          } catch (notifErr: any) {
            console.warn(`[Dispute Route] Provider notification failed:`, notifErr.message);
          }
        }

        // C. Deduct earnings from services collection
        const serviceRef = doc(db, 'services', serviceId);
        const serviceSnap = await retryDb(() => getDoc(serviceRef));
        if (serviceSnap.exists()) {
          const serviceData = serviceSnap.data();
          const currentEarnings = serviceData.earnings || 0;
          await retryDb(() => updateDoc(serviceRef, {
            earnings: Math.max(0, currentEarnings - decision.refundAmount)
          }));
        }

        // D. Refund difference to customer wallet
        const customerUserRef = doc(db, 'users', bookingData.userId);
        const customerUserSnap = await retryDb(() => getDoc(customerUserRef));
        let customerWalletBalance = 0;
        if (customerUserSnap.exists()) {
          customerWalletBalance = customerUserSnap.data().walletBalance !== undefined ? customerUserSnap.data().walletBalance : 0;
        }
        const newCustomerWalletBalance = customerWalletBalance + decision.refundAmount;
        await retryDb(() => setDoc(customerUserRef, {
          walletBalance: newCustomerWalletBalance
        }, { merge: true }));

        // Log customer transaction (refund)
        try {
          await logTransaction(
            bookingData.userId,
            bookingData.userName || 'Customer',
            serviceId,
            bookingData.providerName || 'Professional',
            bookingId,
            decision.refundAmount,
            'refund',
            `Rs. ${decision.refundAmount.toLocaleString()} refunded due to overcharge dispute resolution for booking with ${bookingData.providerName || 'Professional'}`
          );
        } catch (logErr: any) {
          console.warn(`[Dispute Route] Customer transaction log failed:`, logErr.message);
        }
      }

      // 3. Save the resolved dispute record in Firestore `/disputes`
      await createDispute(
        bookingId,
        issueType,
        details,
        decision.action,
        decision.refundAmount,
        decision.verdictSummary
      );

      return res.json({
        success: true,
        isValid: true,
        verdict: decision.verdictSummary,
        refundAmount: decision.refundAmount,
        action: decision.action
      });

    } else {
      // Reject Dispute
      await createDispute(
        bookingId,
        issueType,
        details,
        'rejected',
        0,
        decision.verdictSummary
      );

      return res.json({
        success: true,
        isValid: false,
        verdict: decision.verdictSummary,
        refundAmount: 0,
        action: 'rejected'
      });
    }

  } catch (error: any) {
    console.error("[Dispute API Route Error]:", error.message);
    res.status(500).json({ error: `Failed to evaluate dispute: ${error.message}` });
  }
});

app.listen(port, () => {
  console.log(`🚀 Wasila ADK Server is running on http://localhost:${port}`);
  console.log(`Ready to receive requests at POST /api/chat`);
});
