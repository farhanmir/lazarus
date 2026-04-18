# Lazarus: Autonomous Clinical R&D Swarm

**HackPrinceton Spring 2026 Strategy**

## 1. The Pitch
The pharmaceutical industry is a graveyard of "near-misses." Biotech firms bleed billions on clinical trials that fail not because of biology, but because of business: funding cuts, strategic pivots, or poor enrollment. These "dead" assets are shelved while patients wait for cures.

Lazarus is an **Internal Clinical R&D Participant** orchestrated as an autonomous AI swarm. It monitors shelved assets in the **VALLEY OF DEATH** and 'resurrects' them by identifying hidden patient sub-groups where the drug actually works. When it finds a billion-dollar match, it pings the executive's iMessage with a ready-to-sign R&D blueprint.

---

## 2. Target Tracks & Bounties
Lazarus is engineered to aggressively capture the following prize pools:

*   **🏆 Best Business and Enterprise / Overall Hack:** Graduating from a "feature-parity research tool" to a "Sovereign R&D Participant" that proves its work with deterministic math.
*   **🧬 Regeneron ($1,000):** Strict biological rigor. Graph nodes must cite real PubMed IDs (PMIDs) avoiding "AI Fluff."
*   **✨ Best Use of Gemini API (MLH):** **The Defibrillator** agent uses Gemini's 2M+ context window to ingest a 500-page FDA clinical briefing in seconds.
*   **🧠 MBZUAI - K2 Think V2:** **The Coroner** executes a strict 10-step biological autopsy (protein-ligand interaction) producing a verifiable "Thinking Trace".
*   **⚙️ Eragon - Build What Actually Runs Monday:** An internal agent for the CTO. This is not an external semantic search app; it governs internal company pipelines.
*   **🐳 Dedalus - Best Agent Swarm ($500):** A natively distributed, multi-VM agent swarm architecture. Each reasoning agent runs on its own dedicated stateful Linux VM, coordinated by the Go Control Plane.
*   **💬 Photon - Agents in iMessage ($700):** **The High Priest** functions as an active participant in a group chat, defending its P-Value calculations natively in the thread.

---

## 3. System Architecture: The Sovereign Backend
Lazarus utilizes a high-concurrency microservices architecture to ensure continuous execution without state drift.

* **Swarm Orchestrator (FastAPI + OpenClaw):** Leverages async Python and the **OpenClaw** framework for stateful, intense parallelization, managing 4 agents simultaneously without blocking.
* **Context Persistence (Redis + PostgreSQL + Neo4j):**
    * **Redis:** Real-time "Blackboard" for agent broadcasting via pub/sub.
    * **PostgreSQL:** "Truth Ledger" maintaining a durable event log, patient data, and historical R&D outcomes.
    * **Neo4j:** "Biological Knowledge Graph" managing complex relationships between Drugs, Targets, Diseases, and Evidence.
* **Execution Environment (Dedalus Containers):** A high-concurrency, containerized environment ensuring zero-lag agent interactions and 24/7 sovereign operation.
* **The Reasoning Engines:**
    * **The Defibrillator (Gemma 4):** Powered by the **Gemini API** for massive context mining.
    * **The Coroner (K2 Think V2):** Powered by **MBZUAI** for deep mechanistic logic.

---

---

## 4. The Sourcing Layer: How Lazarus Mines the Valley
Lazarus operates across three distinct scientific data environments:

*   **Clinical Pipeline Miner (CTG API v2):** Lazarus queries `clinicaltrials.gov` for records marked as `TERMINATED` or `WITHDRAWN` to scrape failure points.
*   **Biological Truth Engine (Knowledge Graphs):** Cross-references drug MOA against PubMed, biobanking data, and pathways in Neo4j.
*   **Bio-Nexus Mirror (NHANES Labs):** Ingests national health datasets (Mocked for MVP) to simulate subgroup analysis using metrics like `LBXGH` (HbA1c) and `LBXCRP` (Inflammation).

---

## 5. Swarm Logic: The Adversarial Court & Logistics
Lazarus employs a multi-agent adversarial reasoning loop, backed by a **Deterministic Biostatistics Engine (Python/SciPy)**. LLMs do not guess statistical significance; they ask the FastAPI backend to calculate actual synthetic P-Values (Fisher's Exact Test / Kaplan-Meier) on sub-cohorts.

1.  **The Mortician (Sourcing):** Scours the **VALLEY OF DEATH** (ClinicalTrials.gov) for terminated assets. 
2.  **The Defibrillator (Gemma - Advocate):** Ingests the full FDA clinical briefing (using 2M+ context). Finds the hidden efficacy spike and relies on Python for the deterministic math validation.
3.  **The Coroner (K2 Think V2 - Skeptic):** Performs the 10-step "Biological Autopsy" to verify if the pulse is real. Its deep "Thinking Trace" explores mechanism of action and synthesis pathways.
4.  **The Quartermaster (Logistics):** Takes the surviving drug query and hits the Overpass API for `amenity=hospital` to map trial sites. Calculates level of effort vs. ROI.
5.  **The Comptroller (Budget):** Calculates the Trial Burn Rate based on geographical trial mapping.
6.  **The High Priest (Judge):** Synthesizes the debate into a heavily cited (PMID) blueprint.
7.  **The Master Control (Follow-Up):** Stays in the loop via iMessage/Email to answer executive follow-up questions post-delivery.

### Execution Circuit Breakers
To prevent demo collapse, the Python backend rigorously enforces these edge cases:
*   **The "Infinite Argument" Deadlock:** If Advocate and Skeptic argue past 3 turns, the orchestrator violently kills the loop and flags the drug as High Risk.
*   **Overpass API Limits:** Postgres pre-caches local hospital coordinates so the Quartermaster doesn't get rate-limited.
*   **Hallucination Trapping (PubMed):** The backend tools include a real PubMed Entrez API ping. Fake citations immediately invalidate the Advocate's thesis.
*   **iMessage Timeout Ping:** Before the PDF is generated, Photon fires back "Acknowledged. Compiling blueprint..." instantly to avoid dead air.

---

## 6. The Demo UX (The Terminal of Truth)
To win, we move beyond static reports to a live "Swarm Visualization."
*   **The UI:** Features a live "Heart Rate Monitor" for the drug asset. It flatlines until the FastAPI backend calculates `P < .05`, then it starts beating.
*   **The Graph:** The Neo4j graph expands dynamically on screen as K2 explores biological relationships.
*   **The Participation:** When the executive answers the iMessage, the agent functions in a *group chat*, defending its biostatistics against skeptics natively in the thread.

---

## 6. Execution Roadmap
* **Hours 0–8:** Initialize Dedalus, FastAPI orchestrator, Redis, and Postgres.
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
We will implement a secondary **Bio-Nexus Dashboard** (sleek, terminal-style UI) that streams real-time logs of the agent's internal reasoning using high-impact "Necromancy" flavor.
*   **Judge Impact:** It visually proves autonomous R&D analysis beyond simple prompt-response.
*   **Example Logs:** 
    *   `[The Mortician] Searching for signs of life in terminated NCT records...`
    *   `[The Mortician] Unearthing shelved Pfizer asset (RX-782)...`
    *   `[The Defibrillator] Applying 1.21 gigawatts to Patient_Cluster_B (Females 65+)...`
    *   `[The Coroner] Verifying heartbeat... Detected CRP-mediated synergy. Resurrection possible.`

### 2. MVP Mock Data Strategy
To ensure a bulletproof Sunday demo, we use `patients_mock.json` to simulate diverse laboratory datasets. This allows us to trigger the adversarial reasoning loop instantly when a "relevant" biological signal is detected in the mock stream.