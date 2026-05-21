# 🌐 Wasila — AI-Powered Service Booking Platform

> **Hackathon Submission | Multi-Agent AI System with Real-Time A2A Negotiation**

[![Backend](https://img.shields.io/badge/Backend-Google%20Cloud%20Run-blue)](https://wasila-backend-340241029103.us-central1.run.app)
[![AI](https://img.shields.io/badge/AI-OpenRouter%20%7C%20Gemini%202.5%20Flash-orange)](https://openrouter.ai)
[![Database](https://img.shields.io/badge/Database-Firebase%20Firestore-yellow)](https://firebase.google.com)
[![Mobile](https://img.shields.io/badge/Mobile-Expo%20%7C%20React%20Native-cyan)](https://expo.dev)

---

## 🧭 Overview

**Wasila** is a multilingual AI-powered mobile platform that connects customers with local service providers (plumbers, electricians, AC technicians, etc.) through an intelligent multi-agent system. Unlike traditional booking apps, Wasila features real **Agent-to-Agent (A2A) negotiation** — where a customer-side AI agent negotiates price, time, and availability directly with an AI agent representing the service provider — all in real time.

---

## 🎯 Key Innovations

| Feature | Description |
|---|---|
| **Multi-Agent Orchestration** | 8 specialized AI agents each with a single responsibility |
| **A2A Negotiation** | Real-time agent-to-agent negotiation loop (max 2 turns) |
| **Multilingual Support** | Roman Urdu, Urdu Nastaliq, and English — auto-detected per message |
| **External Search Fallback** | When no local providers match, simulates a Google Maps directory lookup |
| **Dynamic Pricing Engine** | Architecture for Distance Fee + Urgency Multiplier + Demand Surge |
| **Session Persistence** | Full conversation history saved to Firestore, restored on reconnect |
| **Auto Address Learning** | Auto-updates user profile address from chat context |
| **Live Agent Trace UI** | Chat UI shows real-time agent step-by-step thinking logs |

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────┐
│              React Native (Expo) App             │
│         (Customer UI + Provider Dashboard)       │
└──────────────────────┬──────────────────────────┘
                       │ REST API (POST /api/chat)
                       ▼
┌─────────────────────────────────────────────────┐
│           WasilaADK Express Server               │
│             (Google Cloud Run)                   │
│                                                  │
│  ┌───────────┐  ┌──────────────┐  ┌──────────┐  │
│  │  Parser   │→ │  Matchmaker  │→ │ Pricing  │  │
│  │  Agent    │  │    Agent     │  │  Agent   │  │
│  └───────────┘  └──────────────┘  └──────────┘  │
│                        │                         │
│                 A2A Negotiation Loop              │
│            ┌───────────────────────┐             │
│            │  Customer Agent (Svr) │             │
│            │          ⇄           │             │
│            │    SupplierAgent      │             │
│            └───────────────────────┘             │
│                        │                         │
│  ┌───────────┐  ┌──────────────┐  ┌──────────┐  │
│  │ Concierge │  │    Action    │  │External  │  │
│  │   Agent   │  │    Agent     │  │ Search   │  │
│  └───────────┘  └──────────────┘  └──────────┘  │
└──────────────────────┬──────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────┐
│               Firebase Firestore                 │
│  Collections: users | services | bookings | chats│
└─────────────────────────────────────────────────┘
```

---

## 🤖 Agents Developed

### 1. 🧠 ParserAgent
**Role:** Intent extraction from user messages  
**Extracts:** `action`, `category`, `dateTime`, `location`, `confidence`  
**Actions Detected:** `search | book | cancel | view_bookings | chat | dispute`  
**Special Feature:** Recognizes affirmative Urdu responses ("haan", "ji", "ok") as booking confirmations when context shows a provider was offered  

### 2. 🔍 MatchmakerAgent
**Role:** Finds the best available service provider  
**Pipeline:**
1. Fetches all active providers from Firebase `services` collection
2. Fuzzy-matches by category/service name
3. Excludes already-booked providers
4. Uses LLM to rank and select best match
5. Falls back to `ExternalSearchAgent` if no local providers found

### 3. 💲 PricingAgent
**Role:** Dynamic quote calculation  
**Architecture:** Base Price + Distance Fee + Urgency Multiplier + Demand Surge - Loyalty Discount  
**Returns:** `{base, distanceFee, urgencyFee, surgeFee, discount, total, breakdown}`

### 4. 💬 ConciergeAgent
**Role:** Customer-facing conversational AI — the "face" of Wasila  
**Features:**
- Greets user by name on first interaction only
- Strict multilingual matching (Roman Urdu → Roman Urdu reply, never Nastaliq)
- Context-aware, warm and professional tone
- Falls back to intelligent in-code response if LLM is unavailable

### 5. ⚡ ActionAgent
**Role:** Executes real CRUD operations  
**Operations:**
- `executeBooking()` — Creates booking in Firestore `bookings` collection
- `executeCancellation()` — Fetches user's bookings, uses LLM to identify which to cancel, updates status to `'cancelled'`
- Generates multilingual confirmation messages

### 6. 🤝 SupplierAgent *(A2A Negotiation)*
**Role:** AI representative for each service provider  
**Evaluates:** Category, proposed price, date/time, location  
**Decisions:** `accepted | counter_offer | rejected`  
**Custom Instructions:** Each provider can store personalized negotiation guidelines in Firestore  
**Default Rules:** Working hours 9AM–6PM, no Sundays, price ≥ base  

### 7. 🌐 ExternalSearchAgent *(Google Maps Fallback)*
**Role:** When no registered providers match, simulates Google Maps Places search  
**Returns:** External provider card with phone number (`isExternal: true`)  
**UI Behavior:** Shows direct-call card instead of booking flow  

### 8. 📋 PlanningAgent
**Role:** High-level strategic planner  
**Output:** 5-step resolution workplan shown in API response as `workplan[]`

---

## 🔄 A2A Negotiation Flow

```
Customer sends request
         │
         ▼
  ParserAgent extracts intent
         │
         ▼
  MatchmakerAgent finds provider
         │
         ▼
  PricingAgent calculates quote
         │
         ▼
  ┌─ Negotiation Loop (max 2 turns) ──┐
  │                                    │
  │  Customer Agent (server) proposes  │
  │            ⇄                       │
  │  SupplierAgent evaluates:          │
  │  • accepted → booking proceeds     │
  │  • counter_offer → adjust & retry  │
  │  • rejected → final turn forces    │
  │    agreement                       │
  └────────────────────────────────────┘
         │
         ▼
  ActionAgent creates booking
         │
         ▼
  ConciergeAgent generates reply
         │
         ▼
  Session saved to Firestore
```

---

## 🛠️ Tech Stack

### Backend (WasilaADK)
| Component | Technology |
|---|---|
| Runtime | Node.js 20 + TypeScript |
| Framework | Express.js v5 |
| AI Inference | OpenRouter API (multi-model fallback) |
| Primary Model | `google/gemini-2.5-flash` |
| Fallback Models | `meta-llama/llama-3.3-70b-instruct:free` → `llama-3.2-3b-instruct:free` → `openrouter/free` |
| Database | Firebase Firestore |
| Deployment | Google Cloud Run (us-central1) |
| Build Tool | Google Cloud Build + Docker |

### Frontend (Wasila Mobile App)
| Component | Technology |
|---|---|
| Framework | React Native + Expo SDK 55 |
| Navigation | Expo Router (file-based routing) |
| State Management | Zustand |
| Auth | Firebase Auth (Email + Google OAuth) |
| Real-time | Firebase Firestore `onSnapshot` listeners |
| UI | Custom component library with THEME system |
| Animations | React Native Reanimated 4 |
| Maps | React Native Maps |

---

## 🌐 API Reference

### `POST /api/chat`
Main conversational endpoint.

**Request:**
```json
{
  "message": "mujhe AC technician chahiye kal subah",
  "userId": "firebase-uid",
  "userName": "Ali"
}
```

**Response:**
```json
{
  "reply": "Ali bhai, main ne aapke liye ek AC Technician dhoondh liya hai...",
  "traces": [
    {"agent": "ParserAgent", "step": "intent_parsed", "detail": {"action": "search", "category": "AC Technician"}},
    {"agent": "MatchmakerAgent", "step": "match_found", "detail": {"reasoning": "..."}},
    {"agent": "SupplierAgent", "step": "negotiation", "detail": {"status": "accepted"}}
  ],
  "bestMatch": {
    "id": "firestore-doc-id",
    "name": "AC Repair & Gas Filling",
    "providerName": "Hassan Ahmed",
    "rating": 4.5,
    "category": "AC Technician",
    "pricePerHour": 1500,
    "location": "Islamabad"
  },
  "workplan": ["Analyze", "Search", "Match", "Respond"],
  "bookingConfirmed": false,
  "actionStatus": null
}
```

### `POST /api/generate-instructions`
Generates AI-written negotiation guidelines for service providers.

**Request:**
```json
{
  "name": "Hassan's AC Service",
  "category": "AC Technician",
  "price": 1500
}
```

**Response:**
```json
{
  "instructions": "• Accept bookings from 9 AM to 6 PM only\n• Minimum price: Rs. 1200..."
}
```

---

## 🗄️ Firebase Collections

| Collection | Purpose | Key Fields |
|---|---|---|
| `users` | User profiles | `name, email, role, address, lat, lng, photoURL` |
| `services` | Service provider listings | `name, category, providerName, price, rating, isActive, providerInstructions` |
| `bookings` | All bookings | `userId, serviceId, providerId, status, date, price, timestamp` |
| `chats` | AI conversation history | `userId, messages, lastMessage, providerId, category, updatedAt` |

---

## 🔑 Environment Variables

```env
# OpenRouter (AI Inference)
GEMINI_API_KEY=your_openrouter_api_key

# Firebase
EXPO_PUBLIC_FIREBASE_API_KEY=...
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=...
EXPO_PUBLIC_FIREBASE_PROJECT_ID=...
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=...
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
EXPO_PUBLIC_FIREBASE_APP_ID=...
EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID=...

# Optional
PORT=5000
```

---

## 🚀 Local Development

### Backend (WasilaADK)
```bash
cd WasilaADK
npm install
cp .env.example .env   # Fill in your API keys
npm run dev            # Hot-reload development server on port 5000
```

### Frontend (Wasila)
```bash
cd Wasila
npm install
npx expo start         # Scan QR with Expo Go app
```

---

## ☁️ Production Deployment

Backend is deployed on **Google Cloud Run**:

```bash
# Build & push container
cd WasilaADK
gcloud builds submit --tag gcr.io/YOUR_PROJECT/wasila-backend:latest

# Deploy to Cloud Run
gcloud run deploy wasila-backend \
  --image gcr.io/YOUR_PROJECT/wasila-backend:latest \
  --platform managed \
  --allow-unauthenticated \
  --region us-central1 \
  --port 5000
```

**Live Backend URL:** `https://wasila-backend-340241029103.us-central1.run.app`

---

## 📱 Mobile App Features

| Screen | Description |
|---|---|
| **Chat** | AI conversational interface with live agent trace logs |
| **Home** | Service categories, featured providers, quick search |
| **Bookings** | View, track, and cancel bookings in real-time |
| **Profile** | User settings, address management |
| **Provider Dashboard** | Service listings, negotiation logs, booking management |
| **My Services** | Providers can add/edit/manage their service listings |

### Live Agent Thinking UI
While the backend is processing, the chat screen shows a real-time step-by-step trace:
```
✅ ParserAgent     → Parsing request intent...
⚙  MatchmakerAgent → Scanning active providers... (active)
○  PricingAgent    → Pending
○  ConciergeAgent  → Pending
```

---

## 👥 Team

Developed for the **AI Hackathon 2025** using Google Antigravity as the primary AI development assistant for architecture planning, implementation, debugging, and deployment.

---

## 📄 License

MIT License — see [LICENSE](LICENSE) for details.
