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

## 🏗️ Technical Architecture
Wasila follow karta hai **Decoupled Agentic Architecture**:
- **Frontend**: React Native (Expo) - Sirf UI aur Traces dikhany ke liye.
- **Backend Orchestrator**: Node.js - Jahan Antigravity "Brain" reside karta hai.
- **Reasoning Loop**: Input -> Intent Extraction -> Multi-Factor Ranking -> Action Simulation -> Final Trace.

## 💰 Cost Analysis (Google Cloud)
Project ko scale karny ke liye estimated monthly costs:
1. **Cloud Run (Compute)**: ~$5 - $10 (Based on high traffic).
2. **Firestore (Database)**: Free Tier initially, then ~$0.18/GB.
3. **Vertex AI / Antigravity API**: ~$0.01 per 1k characters (Reasoning cost).
**Total Estimated Baseline**: ~$15 - $20 / month for 10,000+ users.

## ⚖️ Baseline Comparison: Why Wasila?
| Feature | Standard Search Apps | Wasila AI (Antigravity) |
| :--- | :--- | :--- |
| **Language** | Sirf English keywords. | Urdu, Roman Urdu, aur English (Multilingual). |
| **Decision** | User ko khud list dekhni parti hai. | AI 6 factors par khud behtareen match dhoondta hai. |
| **Action** | Sirf phone number milta hai. | AI actual booking aur notification simulate karta hai. |
| **Transparency** | Black box (Kuch pata nahi chalta). | **Thinking Traces** sy user ko puri logic nazar aati hai. |

---

## 🛠️ Error Handling & Robustness
- **Empty/Unknown Requests**: AI polite response deta hai agar request service category sy match na ho.
- **No Provider Available**: System "No Match Found" handle karta hai aur alternatives suggest karta hai.
- **Validation**: Sirf verified providers ko high score deta hai taake user trust barhay.

