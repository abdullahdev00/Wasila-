# 🚀 Implementation Plan: AI Service Orchestrator (Informal Economy)

This plan outlines the development of an autonomous AI agent that manages service bookings (plumbers, electricians, tutors) using **Google Antigravity** as the core brain.

---

## 📅 Timeline Summary
- **Selection Deadline:** May 15 (Track 2)
- **Development Window:** May 14 – May 19
- **Submission Deadline:** May 20
- **National Finale:** June 07 (Islamabad)

---

## 🏗️ Phase 1: Foundation & Brain Setup (Day 1)
**Goal:** Initialize the project and connect the Antigravity Orchestrator.

1.  **Project Initialization:**
    - Setup a mobile-first web app (using Vite + React/TS) or Expo.
    - Configure **pnpm** and **Tailwind CSS**.
    - Setup **Firebase** for data storage (Providers list, user bookings).
2.  **Antigravity Core Integration:**
    - Define the System Prompt: Focus on "Service Orchestration" and "Urdu/Roman Urdu" understanding.
    - Implement the **Reasoning Loop**: Input -> Planning -> Tool Selection -> Observation -> Final Action.
3.  **Data Schema:**
    - Create a mock database of 20+ service providers with 6+ metadata points (Price, Rating, Distance, Availability, Experience, Language).

---

## 🧠 Phase 2: Agentic Reasoning & Ranking (Day 2)
**Goal:** Implement the "Intelligence" behind provider selection.

1.  **Roman Urdu Processor:**
    - Fine-tune the agent to handle requests like *"AC sahi karwana hai sasta wala"* or *"Maths tutor chahiye 10th class ke liye near me."*
2.  **The Ranking Engine:**
    - Implement a tool that Antigravity can call to filter and rank providers based on:
        1. Price 2. Rating 3. Distance 4. Response Time 5. Skills 6. Verification Status.
3.  **Traces Implementation:**
    - Build a mechanism to capture and store **Thinking Traces** (Workplan, Reasoning, Decision) for each request.

---

## ⚡ Phase 3: Action Simulation & Tools (Day 3)
**Goal:** Move from "Suggesting" to "Doing" (Mandatory Requirement).

1.  **Action Tools:**
    - **Booking Tool:** Updates Firestore to book a slot.
    - **Notification Tool:** Simulates an SMS/WhatsApp message to the provider.
    - **Conflict Resolver:** Handle cases where a slot is taken (Failure Recovery).
2.  **Workflow Automation:**
    - The agent should automatically follow up: *"Aapka slot book ho gaya hai, mechanic 2 baje pohanch jaye ga."*

---

## 🎨 Phase 4: Premium UI/UX Development (Day 4)
**Goal:** Create a "WOW" factor interface (Visual Excellence).

1.  **Design System:**
    - Dark mode, Glassmorphism, and smooth transitions.
    - Custom icons for different services.
2.  **The "Trace" View:**
    - A dedicated UI section showing the **AI’s Thinking Process** in real-time (e.g., "Analyzing 15 plumbers... Found 3 in G-11... Ranking by lowest price...").
3.  **Interactive Booking Flow:**
    - Chat-like interface for requests, transitioning into a sleek booking confirmation card.

---

## 🎬 Phase 5: Polish & Submission (Day 5)
**Goal:** Documentation and Final Validation.

1.  **Error Handling:** Ensure the system handles API failures or "No providers found" gracefully.
2.  **README/Documentation:**
    - Technical architecture.
    - Cost analysis (Google Cloud).
    - Baseline Comparison (Why this agent is better than a simple search).
3.  **Demo Video:** Record a 3-5 minute walkthrough showing the end-to-end autonomous flow.

---

## 🛠️ Tech Stack & Tools
- **Core:** React (Vite) / Expo
- **Orchestrator:** Google Antigravity
- **Database:** Firebase MCP / Firestore
- **Styling:** Tailwind CSS
- **Interactions:** Framer Motion (for micro-animations)
