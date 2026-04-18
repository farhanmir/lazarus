# Lazarus: Autonomous Clinical R&D Swarm

**HackPrinceton Spring 2026 Strategy**

## 1. The Pitch
The pharmaceutical industry is a graveyard of "near-misses." Biotech firms bleed billions on clinical trials that fail not because of biology, but because of business: funding cuts, strategic pivots, or poor enrollment. These "dead" assets are shelved while patients wait for cures.

**Lazarus** is a sovereign, multi-agent swarm designed to resurrect these assets from the **VALLEY OF DEATH**. It acts as an autonomous, founder-level R&D engine that continuously mines a company’s proprietary clinical pipeline, cross-references it with global biological knowledge graphs, and actively pushes validated, citation-backed repurposing blueprints directly to executives via iMessage. Lazarus doesn't just "search"—it reasons, self-corrects, and executes.

---

## 2. Target Tracks & Bounty Strategy
Lazarus is engineered to sweep the following high-value tracks:

* **🏆 Best Overall Hack:** A bulletproof enterprise narrative combined with low-level systems engineering (Go/Redis).
* **🏥 Best Healthcare Hack:** Addresses drug repurposing and clinical efficiency.
* **🧬 Regeneron - AI & Tech for Clinical Trials ($1,000):** Purpose-built solution for biostatistics and trial asset recovery.
* **🧠 K2 Think V2 - IFM:** Using K2 as the **Skeptic Agent** to execute multi-step biological logic validation.
* **💬 Photon - Agents in iMessage ($700):** Leveraging Spectrum to move the UX from a dashboard to the executive’s pocket.
* **⚙️ Eragon - Build What Actually Runs Monday:** A stateful, internal daemon running over real company stacks.
* **🐳 Dedalus - Best Agent Swarm ($500):** High-concurrency swarm hosted natively on Dedalus Containers.

---

## 3. System Architecture: The Sovereign Backend
Lazarus utilizes a high-concurrency microservices architecture to ensure continuous execution without state drift.

* **Swarm Orchestrator (Go):** Leverages goroutines for intense parallelization, managing 4-5 agents simultaneously without blocking.
* **Context Persistence (Redis + PostgreSQL):**
    * **Redis:** Real-time "Blackboard" for agent broadcasting via pub/sub.
    * **PostgreSQL:** "Truth Ledger" maintaining a durable event log and strict citation chains.
* **Execution Environment:** Hosted on **Dedalus Containers** for enterprise-grade uptime.
* **The Reasoning Engine:** **Gemma 4** (Massive context extraction & Advocate) + **IFM K2 Think V2** (Targeted skeptical logic/verification).

---

## 4. Swarm Logic: The Adversarial Court
Lazarus employs an adversarial reasoning loop to force a "survival of the fittest" for hypotheses:

1.  **The Advocate (Gemma 4):** Mines shelved data and proposes novel hypotheses (e.g., failed Asthma drugs with Lupus potential). Gemma 4 is our primary engine for the **Best Use of Gemini API** track.
2.  **The Skeptic (K2 Think V2):** Used for targeted falsification of hypotheses. We leverage K2 primarily for edge-case mechanistic verification, ensuring it is used with high precision where skeletal logic is most critical.
3.  **The Judge:** Synthesizes the debate into an Executive Blueprint with a **Strict Citation Chain** linking to source PDFs, FAERS data, and PubMed IDs.

---

## 5. The Demo UX (The Sunday Moment)
* **The Scenario:** Lazarus finds a match autonomously.
* **The iMessage:** Judge’s phone buzzes via **Photon**: *"🚨 Lazarus identified an 84% match for RX-782 for Lupus. Reply DRAFT for blueprint."*
* **The Action:** Reply "DRAFT".
* **The Delivery:** Lazarus drops a professionally formatted, cited R&D PDF directly into the iMessage thread.

---

## 6. Execution Roadmap
* **Hours 0–8:** Initialize Dedalus, Go orchestrator, Redis, and Postgres.
* **Hours 8–20:** Implement K2 Think "Skeptic" loop and Gemini PDF pipeline.
* **Hours 20–30:** Integrate Photon Spectrum and PDF generation logic.
* **Hours 30–36:** Pitch lockdown: "We build sovereign participants in clinical R&D."

---

## 7. Vision
Lazarus ensures that the next life-saving cure doesn't die in the **VALLEY OF DEATH** or a digital vault. We are raising the graveyard of medicine.

---

## 💡 The Bio-Nexus Strategy: Winning the Demo
To truly impress judges, we move beyond the "chatbot" and show a sovereign participant working in the background.

### 1. Visualizing the Background Agent
We will implement a secondary **Bio-Nexus Dashboard** (sleek, terminal-style UI) that streams real-time logs of the agent's internal reasoning.
*   **Judge Impact:** It visually proves autonomous R&D analysis beyond simple prompt-response.
*   **Example Logs:** 
    *   `[KnotAPI] Syncing purchase history for Patient_001...`
    *   `[Lazarus] Found pharmacy receipt for "Modafinil" (Category: Performance Enhancement)`
    *   `[Reasoning] Cross-referencing with Lupus clinical trial failure (Asset: RX-782)...`

### 2. Knot API: Proactive Bio-Filtering
We use Knot API’s `TransactionLink` (mocked for MVP reliability) to create a proactive clinical monitoring loop.
*   **The Feature:** A secure login portal where a user/executive can configure their "R&D Focus."
*   **Optimization Layer:** If the user selects **"Performance Enhancement Only,"** the swarm filters out noise (generic pharmacy purchases like band-aids or cough syrup) and narrows its reasoning strictly to high-value assets related to bio-performance and nootropics.

### 3. MVP Mock Data Strategy
To ensure a bulletproof Sunday demo, we use `purchases_mock.json` to simulate diverse financial datasets. This allows us to trigger the adversarial reasoning loop instantly when a "relevant" purchase is detected in the mock stream.