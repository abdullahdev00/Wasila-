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
import { getUserName, fetchUserBookings, db, saveChatSession, fetchLastChatSession } from './firebase';
import { getDoc, doc, setDoc, updateDoc, collection, getDocs } from 'firebase/firestore/lite';
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
const customerNegotiator = new CustomerNegotiatorAgent();

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
    await setDoc(chatDocRef, {
      userId,
      userName,
      activeTraces: traces,
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

    // Inject history context so agents remember the past
    const historyText = userMemory.history.map((h: any) => `User: "${h.user}" | AI: "${h.ai}"`).join('\n');
    const contextualMessage = `
      [Recent Chat History]:
      ${historyText || 'No previous chat'}
      
      [Current User Message]: "${message}"
    `;

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
      const response = await concierge.reply(msg, state);
      await pushAndBroadcastTrace('ConciergeAgent', 'done', 'Formulating natural language response...', (response as any).thinking);
      return response;
    };

    const callMatchmaker = async (msg: string, category: string, location: string) => {
      await pushAndBroadcastTrace('MatchmakerAgent', 'running', 'Scanning active service providers...');
      const result = await matchmaker.findMatch(msg, category, location);
      // reasoning comes directly from LLM inside MatchmakerAgent — fully dynamic
      const matchThinking = result.reasoning
        ? `${result.reasoning}${result.bestMatch ? ` → Selected: ${result.bestMatch.name || result.bestMatch.providerName} (Rating: ${result.bestMatch.rating})` : ' → No match found'}`
        : undefined;
      await pushAndBroadcastTrace('MatchmakerAgent', 'done', 'Scanning active service providers...', matchThinking);
      return result;
    };

    const callPricing = async (basePrice: number, query: string, location: string) => {
      await pushAndBroadcastTrace('PricingAgent', 'running', 'Evaluating base fee, distance, and surge quote...');
      const result = await pricingAgent.calculateQuote(basePrice, query, location);
      // thinking built from actual quote result — dynamic
      const pricingThinking = `Base: Rs. ${result.base} | Distance fee: Rs. ${result.distanceFee} | Urgency: Rs. ${result.urgencyFee} | Surge: Rs. ${result.surgeFee} | Discount: Rs. ${result.discount} | Total: Rs. ${result.total}`;
      await pushAndBroadcastTrace('PricingAgent', 'done', 'Evaluating base fee, distance, and surge quote...', pricingThinking);
      return result;
    };

    const callSupplier = async (providerName: string, instructions: string, proposal: any, history: string[]) => {
      await pushAndBroadcastTrace('SupplierAgent', 'running', 'Negotiating price and schedule with provider...');
      const result = await supplierAgent.evaluateProposal(providerName, instructions, proposal, history);
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

    // 1. Intent Parsing Phase (Now memory-aware)
    await pushAndBroadcastTrace('ParserAgent', 'running', 'Parsing request intent and category...');
    const parsed = await parser.parse(contextualMessage);
    // thinking is built dynamically inside ParserAgent from actual parsed values
    await pushAndBroadcastTrace('ParserAgent', 'done', 'Parsing request intent and category...', parsed.thinking);
    console.log("Parsed Intent:", parsed);

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
    const resolvedLocation = parsed.location || userAddress || 'Islamabad';
    console.log(`[Location Resolver] Client Payload/Saved Profile Address: '${userAddress || 'None'}', Parsed Intent Location: '${parsed.location || 'None'}' => Resolved Match Location: '${resolvedLocation}'`);

    // Detect if category changed to start a fresh chat session
    if (parsed.category) {
      if (!userMemory.currentCategory || userMemory.currentCategory !== parsed.category) {
        console.log(`[Category Change] Resetting provider memory from category '${userMemory.currentCategory}' to '${parsed.category}'`);
        userMemory.currentCategory = parsed.category;
        userMemory.lastProviderId = null;
        userMemory.lastMatch = null;
        userMemory.lastProviderUserId = null;
        userMemory.lastProviderName = null;
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
                customerProposal,
                negotiationHistory,
                lastSupplierOffer,
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
                    customerProposal,
                    negotiationHistory,
                    lastSupplierOffer,
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
      traces: matchResult?.bestMatch?.negotiationTraces || [],
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
      traces: [
        `Plan: Analyze`,
        `Intent: ${parsed.category || 'General'}`,
        `Provider: ${finalBestMatch?.name || 'None found'}`,
        ...(matchResult?.bestMatch?.negotiationTraces || [])
      ],
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

app.listen(port, () => {
  console.log(`🚀 Wasila ADK Server is running on http://localhost:${port}`);
  console.log(`Ready to receive requests at POST /api/chat`);
});
