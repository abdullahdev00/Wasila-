# Wasila AI Agent "Thinking..." Live Simulator: Implementation Plan

This document outlines the design and implementation steps for displaying a dynamic, step-by-step agent reasoning trace (like Antigravity) in the Chat UI while waiting for the API response.

---

## User Review Required

Please review the proposed approach for simulating the multi-agent steps. Since the backend runs a stateless API over Cloud Run, WebSockets/SSE would introduce networking complexities (e.g., connection drops, timeout buffers). 
**Simulating the sequence on the client using matching intervals** is 100% reliable, responsive, and aligns exactly with our backend architecture (Parser -> Matchmaker -> Pricing -> Concierge).

---

## Proposed Changes

### Wasila (Frontend Mobile App)

#### [MODIFY] [chat.tsx](file:///c:/Users/Mohammad%20Ahmad/.gemini/antigravity/scratch/Wasila-/Wasila/src/app/(tabs)/chat.tsx)
We will implement a custom dynamic loading state inside `ChatScreen` to show a real-time "Thinking Trace Log" that progresses step-by-step:

1. **State Addition:**
   - Introduce `thinkingSteps` array state representing the stages:
     * **ParserAgent:** Parsing user message intent and location parameters.
     * **MatchmakerAgent:** Scanning Firestore and scoring best matching providers.
     * **PricingAgent:** Evaluating distance costs, urgency fee, and surge adjustments.
     * **ConciergeAgent:** Preparing final response and formatting match cards.
   - Introduce `activeStepIndex` to track which step is active.

2. **Timer Integration:**
   - When the user sends a message, we set `isLoading = true` and start a timer that increments `activeStepIndex` every `1.5` seconds to transition smoothly through the stages.

3. **Dynamic Loading UI Render:**
   - While `isLoading` is true, render a temporary message bubble at the bottom of the list with a modern dark/blue glassmorphism box displaying the active step with a pulsing indicator:
     - ⚙️ **ParserAgent:** `[Status: Active... / Done]`
     - ⚙️ **MatchmakerAgent:** `[Status: Queued / Active...]`
   - Use subtle micro-animations (pulsing opacity or scaling spinner).

4. **Final Replacement:**
   - When the server response returns, stop the timer, clear the temporary loading step, and append the actual message with its collapsible traces.

---

## Verification Plan

### Manual Verification
* Run the app via Expo Go.
* Send messages in the chat interface.
* Verify that:
  1. The "Thinking Trace" steps update in real time.
  2. The transitions occur smoothly.
  3. The final response replaces the loading trace and shows the collapsible dropdown containing the actual logs.
