# Project Lazarus: Autonomous Clinical R&D Swarm
**HackPrinceton Spring 2026 Proposal**

## 1. The Pitch
Biotech companies bleed billions on clinical trials that fail for non-scientific reasons—funding cuts, poor enrollment, supply chain issues. Meanwhile, the standard "AI hackathon project" is a stateless chatbot that hallucinates biology and forgets its own context after three prompts. 

**Project Lazarus** is a durable, multi-turn autonomous swarm that acts as a tireless founder-level R&D agent. It continuously mines a company’s "dead" asset pipeline, cross-references it with real-time biological knowledge graphs and global literature, and actively pushes highly validated, citation-backed repurposing blueprints directly to executives via iMessage. It doesn't just search; it reasons, corrects itself, and acts.

## 2. Target Tracks & Bounty Strategy
We are engineering this architecture specifically to dominate the main tracks while systematically sniping the highest-value sponsor prizes, without compromising the integrity of the enterprise narrative.

* **🏆 Best Overall Hack:** The ultimate goal. A bulletproof enterprise narrative combined with extreme technical depth.
* **🏥 Best Healthcare Hack / 🏢 Best Business and Enterprise:** Saves lives by finding cures; saves biotech firms billions in sunk R&D costs.
* **🧬 Regeneron - AI & Tech for Clinical Trials ($1000):** A purpose-built solution for clinical trial asset repurposing.
* **🧠 K2 Think V2 - Institute of Foundation Models:** Using K2 not as a wrapper, but as the core "Skeptic Agent" to execute complex, multi-step scientific reasoning and biological logic validation.
* **💬 Photon - Agents in iMessage ($700):** Executives live in iMessage. The swarm pushes alerts and formatted PDF proposals directly to the chat, creating a frictionless, zero-dashboard UX.
* **⚙️ Eragon - Build What Actually Runs Monday (Mac Mini):** Lazarus is a stateful internal daemon that runs autonomously over a company's proprietary stack. It executes real work.
* **🐳 Dedalus - Best Agent Swarm ($500):** The entire microservice architecture is dockerized and hosted natively on Dedalus Containers.

## 3. System Architecture & Tech Stack
To survive continuous execution without state drift, the infrastructure requires absolute precision. We are deploying a high-concurrency microservices architecture, built on the premise that the backend dictates the intelligence.

* **Swarm Orchestrator (Go):** Handles the intense parallelization of managing 9 different agents simultaneously. Go's goroutines ensure the orchestration layer never blocks while waiting for API responses.
* **State & Broadcasting (Redis + PostgreSQL):** To guarantee atomic state management and real-time broadcasting across the swarm, Redis handles the pub/sub agent communication channel. PostgreSQL maintains the durable state, event logs, and the strict citation chain of every decision the swarm makes.
* **Execution Environment:** Hosted on **Dedalus Containers**.
* **The Reasoning Engine:** **K2 Think V2** handles deep biological logic, while **Gemini API** handles unstructured data extraction from clinical trial PDFs.

## 4. The Swarm Logic (The Adversarial Court)
Lazarus utilizes an adversarial reasoning loop to prevent hallucination and ensure absolute citation integrity.

1.  **The Advocate (Gemini):** Mines the data and proposes a novel repurposing hypothesis (e.g., "Drug X failed for Asthma, but works for Lupus").
2.  **The Skeptic (K2 Think V2):** The heavy-lifter. K2 actively tries to destroy the Advocate's hypothesis. It runs the automated repair loop: if it finds a logical gap in the enzyme interaction, it throws a "Compilation Error" back to the Advocate, forcing a loop until the biological logic is flawless.
3.  **The Judge:** Synthesizes the finalized, heavily scrutinized data into an actionable pivot plan. Every single claim is mapped to a strict citation chain directly linking to the source PDFs and FAERS data.

## 5. The Demo UX (The iMessage Integration)
During Sunday's judging, we don't open a generic React dashboard. We open a phone.

* **System Action:** Lazarus has been running in the background. It finds a match.
* **The iMessage:** The judge's phone buzzes with a text from the Photon-powered Lazarus Agent: *"🚨 Lazarus Swarm identified an 84% confidence match: Shelved compound RX-782 shows strong mechanistic viability for early-stage Lupus based on recent FAERS data."*
* **Human-in-the-loop:** You reply in the chat: *"Draft the executive summary with the citation chain."*
* **The Delivery:** The agent drops a fully formatted, scientifically cited PDF right into the text thread. 

## 6. Execution Timeline
* **Friday Night:** Initialize Dedalus containers. Build out the Redis pub/sub system and the PostgreSQL schema for citation tracking. Ensure the Go orchestrator can handle basic message passing.
* **Saturday Morning/Afternoon:** Wire up the K2 Think V2 API for the Skeptic reasoning logic. Build the Gemini extraction pipeline to parse mock clinical trial PDFs. Implement the automated repair loop.
* **Saturday Night:** Integrate Photon's Spectrum framework. Map the final Judge agent's outputs to iMessage payload formats.
* **Sunday Morning:** Lockdown the 2-minute pitch. Focus purely on the enterprise narrative: the financial bleed of clinical trials, the autonomous architecture, and the iMessage delivery.