# 🧠 Wasila Backend Manual (A-Z)

This file is for the developer connecting the Frontend to the AI Orchestrator.

## 🚀 API Endpoints

### 1. AI Chat & Reasoning (`POST /api/chat`)
**URL**: `http://<IP>:5000/api/chat`  
**Body**: `{ "message": "G-11 mein sasta plumber chahiye" }`

**Response Structure**:
- `reply`: AI's conversational response.
- `traces`: Array of steps (Analyzing, Planning, Ranking, etc.).
- `bestMatch`: Details of the selected provider.
- `bestMatch.pricing`: **Dynamic Pricing Breakdown** (Base + Distance + Urgency).
- `suggestion`: Follow-up question (e.g., "Kya main book kar doon?").

### 2. Booking History (`GET /api/bookings`)
Returns a list of all successful bookings.

---

## 🤖 Multi-Agent Architecture
Wasila uses 7 specialized agents:
1. **Language Parser**: Handles confidence scoring & ambiguous input.
2. **Discovery**: Fetches from providers DB.
3. **Ranking**: 6-factor smart matching.
4. **Dynamic Pricing**: Calculates real-time costs.
5. **Booking Simulator**: Records to history.
6. **Follow-up Manager**: Schedules check-ins.
7. **Dispute Handler**: Manages complaints/cancellations.

---

## 🎨 Frontend Integration Tips (For the Partner)
- **Thinking Traces**: Don't just show the reply. Loop through `data.traces` and show them as a "Reasoning Timeline" to get full marks from judges.
- **Dynamic Pricing**: Use the `data.bestMatch.pricing` object to show the user a transparent breakdown (e.g., Base: 1000 + Travel: 100).
- **Dispute Handling**: When a user types a complaint (e.g., "Too expensive"), show the **Dispute Agent's** response in a special UI color (e.g., Red/Orange).

---

## 🧪 Edge Cases Handled
- **Low Confidence**: AI will ask: "Kya aap batana chahein gy ke aapko kis qisam ki service chahiye?"
- **No Provider**: AI will enter Fallback Mode (Waitlist).
- **Price Dispute**: AI provides a detailed breakdown.
