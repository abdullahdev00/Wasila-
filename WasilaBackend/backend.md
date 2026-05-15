# 🧠 Wasila AI Backend Documentation

This document records the development progress, architecture, and logic of the Wasila AI Orchestrator.

## 🚀 Current Status: 90% Complete

### ✅ Phase 1: Foundation (Completed)
- Initialized Node.js & Express server.
- Setup environment variables and CORS.
- Organized folder structure (Frontend vs Backend).

### ✅ Phase 2: Knowledge Base (Completed)
- Created `providers.json` with 10+ detailed service profiles.
- Integrated metadata: Category, Price, Rating, Distance, Verification, Experience, and Availability.

### ✅ Phase 3: AI Orchestrator (The Brain) (Completed)
- Implemented `orchestrator.js` using Antigravity reasoning principles.
- **Multilingual Support**: Added keyword recognition for English, Urdu (Script), and Roman Urdu.
- **6-Factor Ranking Engine**: Built a scoring system based on:
  1. Rating
  2. Verification Status
  3. Proximity (Distance)
  4. Experience Years
  5. Price (Budget Optimization)
  6. Availability

### ✅ Phase 4: Action Simulator (Completed)
- Implemented **Booking Tool** to simulate real-world actions.
- Created `bookings.json` to maintain persistent history.
- Added **Notification Simulation** (Mock SMS/Alerts in traces).

### ✅ Phase 5: Testing & Integration (Completed)
- Verified `/api/chat` with Roman Urdu queries.
- Verified Booking Action and persistent history.
- Verified 6-Factor Ranking Engine scores.

---

## 🧪 Test Case Results
| Case | Input | AI Result | Status |
| :--- | :--- | :--- | :--- |
| **Search** | "G-11 sasta plumber" | Selected Ahmed Raza (Score 136.8) | ✅ Pass |
| **Booking** | "Confirm booking" | Booking recorded + SMS Simulated | ✅ Pass |
| **History** | `GET /api/bookings` | Returns saved booking records | ✅ Pass |

---

## 🔌 Frontend Integration Guide (A to Z)

Aapka partner in steps ko follow kar ke backend connect kar sakta hai:

### 1. Base URL
Backend local network par is address par chalay ga (Apna IP address check kar lein):
`http://<YOUR_IP_ADDRESS>:5000`

### 2. Chat API Integration (`POST /api/chat`)
User ka message bhejny ke liye ye function use karein:

```javascript
const sendMessage = async (userMsg) => {
  const response = await fetch('http://localhost:5000/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: userMsg })
  });
  const data = await response.json();
  
  // data.reply -> AI ka jawab
  // data.traces -> AI ki "Soch" (Array of steps)
  // data.bestMatch -> Selected provider ki details
};
```

### 3. Displaying "Thinking Traces" (The WOW Factor) 🌟
Hackathon mein marks lene ke liye AI ki logic dikhana zaroori hai. Traces ko is tarah display karein:
- Ek chota sidebar ya "Thought Bubble" banayein.
- `data.traces` ko map kar ke har step (Analyzing, Reasoning, Decision) ko aik timeline ki tarah dikhayein.

### 4. Handling Actions
Jab `data.actionTaken === "BOOKING_SAVED"` ho, to screen par Success Animation (Lottie ya Motion) dikhayein.

### 5. Booking History (`GET /api/bookings`)
Past bookings dikhany ke liye simple GET request karein aur results ko FlatList mein render karein.

---

## 🏆 Hackathon Winning Tips
1. **Real-time Traces**: Jaise hi user message bhejay, "AI is thinking..." ka loader dikhayein aur phir traces ko aik aik kar ke reveal karein.
2. **Urdu UI**: Frontend mein Urdu fonts (e.g., Jameel Noori) use karein taake localized feel aaye.
3. **Action Cards**: Best match ko aik premium card (Glassmorphism) mein dikhayein.

