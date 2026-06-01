# 🌐 Wasila — AI-Powered Service Booking Platform
## Hackathon Submission | Project Overview & Agentic Solution (Challenge 2)

This document provides a comprehensive breakdown of the project description, the specific problems addressed from **Challenge 2**, the technology stack, the role of each agent, and our unique AI "Wow Factors".

---

## 🎯 The Problem & The AI Solution (Challenge 2)

### The Challenge Defined
Traditional service platforms (like TaskRabbit, local directories, or classifieds) suffer from significant friction points:
1. **Inefficient Price Discovery & Bargaining**: Users want to bargain or obtain customized quotes, but this requires manual back-and-forth communication with providers, leading to booking drops.
2. **Category & Location Desynchronization**: Traditional search filters are brittle. If a user describes a problem ("the tap is leaking" instead of choosing "Plumber") or searches across cities (e.g. Islamabad Markaz vs. Rawalpindi), the matchmaker fails.
3. **Absence of Real-Time Multi-Agent Collaboration**: Existing apps are static databases. They do not simulate the real-world conversation where a customer representative collaborates dynamically with a provider representative to reach a mutual agreement on price and scheduling.

### The Wasila AI Solution
Wasila introduces a **Multi-Agent Orchestrator** backed by Gemini 2.5 Flash. It addresses the challenge by:
- Intelligently translating colloquial description inputs (e.g., "nalka toot gaya") into concrete professional categories ("Plumber") using **ParserAgent**.
- Simulating a real **Agent-to-Agent (A2A) Negotiation Loop** where the Customer's Agent negotiates price, schedule, and details with the Provider's **SupplierAgent** in real-time, matching constraints defined by the provider.
- Implementing real-time **simulated 1-hour appointment reminder popups** and a **completed-job customer 5-star rating system** to update Firestore listings dynamically.

---

## 🏗️ Technical Stack & Architecture

### 1. Backend Core (WasilaADK)
- **Runtime Environment**: Node.js 20 + TypeScript
- **Server Framework**: Express.js (v5)
- **Primary AI Model**: `google/gemini-2.5-flash` (via OpenRouter API for high speed and low latency)
- **Fallback Models**: Meta-Llama models for high reliability during network surge or API limits.
- **Database**: Firebase Firestore (Lite SDK for fast stateless connections)
- **Hosting**: Google Cloud Run (us-central1) with automated Docker compilation via Google Cloud Build.

### 2. Mobile Frontend (Wasila App)
- **Mobile Framework**: React Native + Expo (v55)
- **Routing & Structure**: Expo Router (file-based navigation stack)
- **State Management**: Zustand
- **Real-Time Integration**: Firestore `onSnapshot` listeners to detect booking status changes and push notification documents.
- **Styling**: Harmony CSS theme system. No generic Tailwind overlays to preserve the premium custom layout.

---

## 🤖 The Multi-Agent Orchestration Flow

Wasila splits complex service coordination into 9 specialized agents:

```
                  [Customer Message Input]
                             │
                             ▼
  ┌───────────────┐   [ParserAgent]   ────────────────┐
  │ Parse Intent  │   • category: "Plumber"           │
  │               │   • action: "search/book/cancel"  │
  └───────────────┘   • proposedPrice: Rs. 1200       │
                             │                        │
                             ▼                        ▼
  ┌───────────────┐ [MatchmakerAgent]           [ActionAgent]
  │ Match Provider│ • Ahmed Raza (Islamabad)    • executeBooking()
  └───────────────┘          │                  • executeCancellation()
                             ▼                        ▲
  ┌───────────────┐  [PricingAgent]                   │
  │ Price Quote   │ • Base Price: Rs. 1500            │ Creates Booking
  └───────────────┘          │                        │ in Firestore
                             ▼                        │
         ┌───────────────────┴───────────────────┐    │
         │         A2A Negotiation Loop          │ ───┘
         │  CustomerNegotiatorAgent (Cust AI)    │
         │                  ⇄                    │
         │  SupplierAgent (Ahmed Raza's AI)      │
         │  • Evaluates based on rules           │
         │  • Price limits (Min Rs. 1200)        │
         │  • Decision: Accepted (Rs. 1200)      │
         └───────────────────┬───────────────────┘
                             │
                             ▼
  ┌───────────────┐  [ConciergeAgent]
  │ Friendly Chat │ • Strictly matches Roman Urdu script
  └───────────────┘ • Generates final reply card
```

### Detailed Agent Roles
1. **ParserAgent**: Detects the category of problem, filters out bargaining attempts from premature booking requests, and parses dates/prices.
2. **MatchmakerAgent**: Searches Firestore `services` collection, checks active flags, and ranks the best candidate. If no local matches exist, calls the **ExternalSearchAgent** to scrape nearby listings from Google Maps.
3. **PricingAgent**: Programmatically computes travel fees, urgency premiums, and surge multiples to create a starting quote.
4. **CustomerNegotiatorAgent**: Represents the customer in A2A negotiations. Aims to get a strategic discount (targeting 15-20% off) and dynamically evaluates and counters Supplier counter-offers.
5. **SupplierAgent**: Acts as the service provider's AI representative. Reads Firestore instructions (e.g., *"Never accept below Rs. 1200"*) and negotiates/counters based on guidelines.
6. **ActionAgent**: Modifies the Firestore database. Creates bookings, processes cancellations, and coordinates status states (`pending`, `accepted`, `completed`, `cancelled`).
7. **ConciergeAgent**: Synthesizes responses in Roman Urdu or Urdu Nastaliq script, greeting users once, and rendering the matching UI cards.
8. **PlanningAgent**: Displays a step-by-step resolution roadmap on the frontend chat trace logs.

---

## 🌟 AI "Wow Factors" (Why Wasila stands out)

- **Real-Time A2A Bargaining**: The customer does not wait for the provider to wake up and reply. The provider's SupplierAgent instantly evaluates proposals and counter-offers, agreeing to Rs. 1200 instead of Rs. 1500 in milliseconds.
- **Dynamic Local Push Notifications via Firestore Snapshots**: Standard Expo push notifications require Apple/Google APNS keys. Wasila implements a pure real-time listener on the Firestore `notifications` collection inside `_layout.tsx` to instantly pop up native warning modal alerts when the reminders engine `/api/reminders` runs.
- **Colloquial Pakistani Roman Urdu/Nastaliq Script Recognition**: The agents natively match the language style of the user. If the user writes Roman Urdu, the AI replies in Roman Urdu, making it highly accessible.
- **Automated Rating Modal Popups on Job Completion**: When a provider changes a booking to `'completed'`, the customer's app immediately detects the state change, displaying an interactive 5-star yellow rating scale to update Firestore provider metrics.
