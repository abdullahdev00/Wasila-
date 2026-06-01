---
marp: true
theme: gaia
_class: lead
paginate: true
backgroundColor: #0d1117
color: #e6edf3
style: |
  section {
    font-family: 'Inter', sans-serif;
    padding: 40px;
  }
  h1 {
    color: #58a6ff;
  }
  h2 {
    color: #58a6ff;
    border-bottom: 1px solid #30363d;
  }
  footer {
    font-size: 0.5em;
    color: #8b949e;
  }
  code {
    background-color: #161b22;
    color: #ff7b72;
  }
  .highlight {
    color: #ff7b72;
    font-weight: bold;
  }
  .green {
    color: #3fb950;
  }
  .blue {
    color: #58a6ff;
  }
---

# 🌐 Wasila (وسیلہ)
### AI-Powered Service Booking Platform for Pakistan's Informal Economy

**Multi-Agent AI System with Real-Time A2A (Agent-to-Agent) Negotiation**
*Submission for AI Hackathon 2025 | Challenge 2: AI Service Orchestrator*

**Team Lead:** Muhammad Abdullah  
**AI Lead:** Mohammad Ahmad  

**Core Roles:**
- **Muhammad Abdullah (Team Lead):** Frontend & Mobile Lead (Expo, React Native, Firestore Integration)
- **Mohammad Ahmad:** AI & Systems Lead (Multi-Agent Orchestration, Backend, Gemini APIs)


---

## Slide 2: The Problem & The AI Solution

### ❌ The Friction in the Informal Economy
1. **The Bargaining Dilemma:** In Pakistan, static pricing fails. Customers bargain culturally; service providers adjust rates dynamically based on location, distance, and urgency. Phone-based haggling causes a **40%+ drop-off** in booking completion.
2. **Linguistic Barriers:** Traditional apps rely on strict English/Urdu translation menus. Users communicate in **Roman Urdu** (*"ac cooling nhi kr rha, mechanic bhejo"*) or **Urdu Nastaliq script**, which standard databases cannot parse.
3. **Rigid Categorization:** Users don't search by "Sanitary Technician"; they type *"nalka leak ho rha hai"*. Rigid category filters fail to map these to providers.

### 🛡️ The Wasila AI Solution (Multi-Agent Paradigm)
*   **Real-Time A2A Bargaining Loop:** Customer's Agent negotiates pricing with the Provider's AI Representative (**SupplierAgent**) in milliseconds.
*   **Colloquial Script Matcher:** Auto-detects Roman Urdu, Nastaliq, or English and responds in the exact same format to prevent user drop-off.
*   **Conversational Semantic Parsing:** The **ParserAgent** extracts intents and categories directly from casual local slang.

---

## Slide 3: Technical Architecture & Orchestration

```text
                      ┌────────────────────────┐
                      │ ✍️ Customer User Input  │
                      └───────────┬────────────┘
                                  │ (Colloquial Roman Urdu / Nastaliq)
                                  ▼
                      ┌────────────────────────┐
                      │    🤖 ParserAgent      │ ➔ Extracts Intent, Category,
                      └───────────┬────────────┘   Location, proposedPrice
                                  │
                                  ▼
                       /──────────────────\
                      < Action Type Filter >
                       \──────────────────/
                        /        │         \
          Search / Book/         │Cancel    \General Chat
                      /          │           \
                     ▼           ▼            ▼
             ┌───────────┐ ┌───────────┐ ┌────────────┐
             │Matchmaker │ │ActionAgent│ │ Concierge  │
             └─────┬─────┘ └─────┬─────┘ └─────┬──────┘
                   │             │             │
                   ▼             │             │
             ┌───────────┐       │             │
             │ Firestore │       │             │
             │ Services  │       │             │
             └─────┬─────┘       │             │
                   │             │             │
             [Match Found?]      │             │
              /          \       │             │
            No/          Yes\    │             │
             /            \      │             │
            ▼              ▼     ▼             │
     ┌─────────────┐ ┌───────────┐             │
     │  External   │ │  Pricing  │             │
     │ Search Map  │ │   Agent   │             │
     └──────┬──────┘ └─────┬─────┘             │
            │              ▼                   │
            │        ┌───────────┐             │
            │        │  A2A Loop │ ◄────────┐  │
            │        └─────┬─────┘          │  │
            │              │                │  │
            │              ▼                │  │
            │        ┌───────────┐          │  │
            │        │ Supplier  ├──────────┘  │
            │        │   Agent   │ (Negotiation Rules Engine)
            │        └─────┬─────┘             │
            │              │                   │
            ▼              ▼                   ▼
      ┌──────────────────────────────────────────┐
      │          🤖 ConciergeAgent               │ ➔ Colloquial Response Builder
      └────────────────────┬─────────────────────┘
                           │
                           ▼
              ┌────────────────────────┐
              │ 🌐 Express API Response │
              └───────────┬────────────┘
                                  │
                                  ▼
              ┌────────────────────────┐
              │ 📱 Client Mobile App   │ ➔ Renders Chat UI, Ratings &
              └────────────────────────┘   Live Agent Traces Log
```



### ⚙️ Multi-Agent Implementation (8 Coordinated Agents)
1. **ParserAgent:** Performs semantic slot extraction (Intent, Category, proposedPrice, Location).
2. **MatchmakerAgent:** Evaluates category proximity and matches nearby active providers in Firestore.
3. **PricingAgent:** Computes dynamically optimized quotes (base rate + travel distance fee + demand surge).
4. **SupplierAgent (Provider Proxy):** Reads provider's custom rules (e.g., *"minimum Rs. 1,200 for AC"*) and counters or accepts pricing in <500ms.
5. **CustomerNegotiatorAgent:** Advocates for the customer to secure a fair discount.
6. **ConciergeAgent & ActionAgent:** Synthesize colloquial replies and execute DB commits.
7. **ExternalSearchAgent:** Scrapes Google Maps Places directory as a fallback when no direct provider matches.

---

## Slide 4: Market Opportunity & Target Personas

### 📈 Target Market Size & "Why Now?"
*   **The Market:** Over **10M+ daily-wage workers** (plumbers, electricians, painters) in Pakistan operate entirely in the offline informal economy.
*   **High Mobile Penetration:** Rapid expansion of 4G networks and affordable smartphones has connected the blue-collar workforce.
*   **Cost Feasibility via Gemini 2.5 Flash:** Running complex negotiations costs just **$0.00028 per booking** (approx. 0.08 PKR). This enables a micro-transaction business model.

### 👥 User Personas
*   **The Provider (Kamran, 38, Electrician):** Semi-literate, cannot type in English, uses voice notes/Roman Urdu, wants fair pricing without paying high commission fees, forgets schedules.
*   **The Customer (Zainab, 29, Housewife):** Wants a quick service provider, hates making multiple phone calls to bargain, wants transparent pricing in under 5 minutes.

---

## Slide 5: The AI "Wow Factors" & Differentiation

*   **Real-Time A2A Bargaining:** A continuous, autonomous negotiation loop that agrees on prices (e.g., counters Rs. 1,000 with Rs. 1,200) in under a second without requiring provider manual input.
*   **Live Agent Trace UI:** Displays agent thinking steps dynamically on the screen:
    `[ParserAgent: Parsed intent AC Repair] ➔ [Matchmaker: Found Ali] ➔ [SupplierAgent: Negotiating...]`
*   **Firestore Snapshot-Driven Alerts:** Direct real-time client side listeners bypass standard, expensive push notification gateways to display instant job status updates and rating popups.
*   **Proactive Reminders Engine:** Runs a scheduled background audit of pending bookings to prompt user followups automatically.

---

## Slide 6: Future Roadmap & Next Steps

### 🗺️ The 6–12 Month Growth Engine

*   **🎙️ Voice-to-Intent Engine:** 
    Integrating dynamic Speech-to-Text models for Roman Urdu so illiterate providers can navigate, negotiate, and accept bookings using voice notes alone.
*   **💳 Escrow & Digital Wallets:** 
    Integrating local micro-payment networks (JazzCash, EasyPaisa, Nayapay) to hold booking fees in escrow until the client reviews the job.
*   **🛡️ Verification & Trust Layers:** 
    Onboarding verified vocational graduates (from institutes like TEVTA) to build a premium tier of trusted home maintenance workers.
*   **🌍 Nationwide Footprint:** 
    Expanding matchmaking algorithms to support regional languages (Punjabi, Pashto, Sindhi) for custom localized interactions.
