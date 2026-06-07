# SkyGrid — AI-Driven Traffic Incident Management System

> **| Smart Transportation Domain |**

SkyGrid is a real-time AI-driven traffic incident management platform for the Gandhinagar/Ahmedabad urban road network. It compresses a 15–25 minute manual operator workflow into an 8–12 second automated analysis cycle by combining live sensor telemetry, multi-agent LLM orchestration, geospatial routing, and multi-channel alert publishing.

---


## What SkyGrid Does

1. Replays timestamped road-segment telemetry from `gandhinagar_traffic_feed.csv` via a background tick loop
2. Detects and tracks incidents (`ACCIDENT`, `ROAD_CLOSED`) in shared in-memory state
3. Computes live diversion candidates using BPR-weighted edge travel times on the Gandhinagar/Ahmedabad OSMnx road graph
4. Runs a three-agent Groq/Llama 3.3 70B orchestration layer producing four structured outputs per incident:
   - `signal_retiming` — phase-level intersection adjustments
   - `diversion_route` — corridor-aware street-level diversion plan
   - `public_alert` — VMS/radio/social-ready concise alert
   - `narrative` — shift-handover incident log
5. Publishes alerts across VMS, radio, and X (Twitter) via Intent URL workflow
6. Accepts voice-triggered incident creation via text or audio (Groq Whisper transcription)
7. Analyses uploaded traffic footage via a BLIP frame captioning pipeline with automated probable-cause reporting

---

## Key Features

- **Real-time CSV feed playback** — 10MB+ traffic CSVs with segment IDs, flow speeds, free-flow baselines, vehicle counts, and incident severity
- **OSMnx + NetworkX geospatial layer** — Gandhinagar/Ahmedabad road graph with emergency node pre-tagging (hospitals, fire stations) excluded from all diversion paths
- **Multi-agent AI orchestration** — strict XML-tagged output contracts per agent; responses parsed and validated before display
- **30-second autonomous co-pilot refresh** — active incidents trigger continuous re-analysis during their lifecycle
- **Voice incident creation** — `POST /incident/voice` (text) and `POST /incident/voice-audio` (Groq Whisper transcription)
- **Video analysis pipeline** — BLIP frame captioning + LLM-generated probable-cause report and frame-level timeline
- **Multi-channel publishing** — VMS, radio, and X (Twitter) Intent URL with official hashtags/emoji; full publish audit log
- **Officer chat** — context-aware Q&A against active incident data via `POST /chat`

---

## Architecture

```
[Traffic Feed CSV] → [FastAPI Ingest] → [OSMnx / NetworkX BPR Graph]
                           ↓                          ↓
                  [Incident Detector]      [K-Shortest Diversion Paths]
                           ↓
          [Groq Llama 3.3 70B Orchestrator] + [Groq Whisper (Voice)]
                    ↓                                  ↓
  [Signal / Diversion / Alert / Narrative]   [BLIP Video Pipeline]
                           ↓
         [React Dashboard] → [Publish: VMS | Radio | X Intent URL]
```

---

## Tech Stack

| Layer | Technologies |
|---|---|
| Frontend | React 18, Vite, Zustand, Tailwind CSS, Lucide Icons |
| Backend | FastAPI (Python), background tick loop, in-memory state, RESTful JSON |
| AI / LLM | Groq SDK — Llama 3.3 70B (generation), Whisper (transcription) |
| Geospatial | OSMnx, NetworkX — BPR travel-time weights, K-shortest-path diversion |
| Data | Pandas — CSV ingestion, segment enrichment, severity computation |
| Video AI | BLIP (Salesforce) — frame captioning, custom probable-cause reporter |
| Publishing | X (Twitter) Intent URL — VMS, radio, and social alert workflow |

---

## Repository Structure

```
final_integ/
  final/
    backend/
      api.py                        # FastAPI app, all endpoints, tick loop
      copilot.py                    # Multi-agent orchestration, Groq prompting
      router.py                     # OSMnx graph, BPR weights, diversion routing
      gandhinagar_traffic_feed.csv  # Primary traffic dataset
      ahmedabad.graphml             # Cached OSMnx road graph
      DEBUGGING_STEPS.md
      test_twitter.py
    frontend/
      package.json
      index.html
      src/
        App.jsx
        config.js
        pages/
          Dashboard.jsx       # Live map, incident panel, AI insights, playback
          Incidents.jsx        # Active/resolved incident command view
          Alerts.jsx           # Multi-channel alert authoring and publishing
          Radio.jsx            # Push-to-talk voice capture and incident creation
          Video.jsx            # Upload and analyse traffic footage
          LandingPage.jsx
        components/
        hooks/
  camera_feed/
    caption_model.py          # BLIP frame captioning
    frame_extractor.py        # Fixed-interval frame extraction
    incident_reporter.py      # Summary, probable causes, timeline generation
    run_video_caption.py      # End-to-end CLI runner (called by /video/analyze)
    requirements.txt
```

> Only `final/backend`, `final/frontend`, and `camera_feed` are part of the main integrated application flow.

---

## Prerequisites

- Python 3.10+ (3.11 recommended)
- Node.js 18+ and npm
- macOS/Linux shell (zsh/bash)
- Groq API key (LLM generation + audio transcription)

**Optional:**
- Twitter/X developer credentials for authenticated social publishing
- CUDA-capable GPU for faster BLIP video inference

---

## Environment Variables

Create `final/backend/.env`:

```env
GROQ_API_KEY=your_groq_api_key
GROQ_MODEL=llama-3.1-8b-instant

# Optional — required only for /publish SOCIAL channel
TWITTER_API_KEY=...
TWITTER_API_SECRET=...
TWITTER_ACCESS_TOKEN=...
TWITTER_ACCESS_SECRET=...
TWITTER_BEARER_TOKEN=...
```

**Frontend API base URL (optional override):**
- `VITE_API_URL` in frontend environment, or
- `SKYGRID_API_BASE_URL` in browser localStorage (configurable from UI profile settings)

---

## Local Setup

### Backend

```bash
cd final/backend
python3 -m venv .venv
source .venv/bin/activate
pip install --upgrade pip
pip install fastapi uvicorn pandas python-dotenv tweepy python-multipart groq osmnx networkx
pip install -r ../../camera_feed/requirements.txt
```

### Frontend

```bash
cd final/frontend
npm install
```

---

## Running the Application

**Terminal 1 — Backend**

> Must be launched from `final/backend` for relative CSV and graph paths to resolve correctly.

```bash
cd final/backend
source .venv/bin/activate
uvicorn api:app --host 0.0.0.0 --port 8000 --reload
```

**Terminal 2 — Frontend**

```bash
cd final/frontend
npm run dev
```

Open `http://localhost:5173` in your browser.

---

## API Reference

### Health & Playback

| Method | Endpoint | Description |
|---|---|---|
| GET | `/health` | Service status |
| GET | `/feed` | Current frame, metrics, and segments |
| GET | `/control?action=play\|pause\|reset\|seek\|speed` | Playback control |

### Incident Operations

| Method | Endpoint | Description |
|---|---|---|
| GET | `/incidents` | Active and resolved incident lists |
| POST | `/incident/trigger` | Manual map-triggered incident |
| POST | `/incident/voice` | Text-driven voice report parsing |
| POST | `/incident/voice-audio` | Audio upload + Whisper transcription + incident creation |

### AI & Routing

| Method | Endpoint | Description |
|---|---|---|
| GET | `/insights/{incident_id}` | Co-pilot outputs + diversion polyline |
| GET | `/diversion/{incident_id}` | Top K diversion route candidates |
| POST | `/chat` | Officer chat Q&A against active incident context |
| GET | `/narrativelog` | Narrative history across incidents |

### Alerts & Publishing

| Method | Endpoint | Description |
|---|---|---|
| POST | `/publish` | Publish to VMS / RADIO / SOCIAL channel |
| GET | `/publish_log` | Full publish audit trail |

### Diagnostics

| Method | Endpoint | Description |
|---|---|---|
| GET | `/debug/verify/{incident_id}` | End-to-end AI and reroute verification |
| GET | `/debug/log?incident_id=...` | Route and LLM process logs |
| GET | `/facilities` | Static emergency facility locations |

### Video

| Method | Endpoint | Description |
|---|---|---|
| POST | `/video/analyze` | Upload clip; returns summary, probable causes, frame timeline |

---

## Frontend Pages

| Route | Page | Description |
|---|---|---|
| `/` | Landing | Product overview |
| `/dashboard` | Dashboard | Live operations map, incident status, AI insights, playback control |
| `/incidents` | Incidents | Active and resolved incident command tracking |
| `/alerts` | Alerts | Multi-channel alert authoring and publish log |
| `/radio` | Radio | Push-to-talk voice command and incident registration |
| `/video` | Video | Upload and analyse traffic footage |

---

## Core Workflows

### Incident Analysis

1. Backend tick loop steps through CSV feed timestamps
2. Incident rows create `ACTIVE` incidents in backend state
3. Co-pilot thread computes diversion routes and calls Groq orchestrator
4. Frontend polls `/feed`, `/incidents`, `/insights/{incident_id}` and updates map/UI
5. Co-pilot auto-refreshes every 30 seconds while incident remains active

### Voice Incident Creation

- Text: `POST /incident/voice` — parses natural language report into incident record
- Audio: `POST /incident/voice-audio` — uploads audio, transcribes via Groq Whisper, creates incident

### Video Analysis

1. Operator uploads clip from the Video page
2. Backend `/video/analyze` writes temp file and invokes `camera_feed/run_video_caption.py` as a subprocess
3. Response returns structured JSON: summary, probable causes, frame-level timeline

### Alert Publishing

1. Operator reviews AI-generated public alert in live textarea (280-character guard active)
2. Clicks Broadcast — alert formatted with `🚦 #Ahmedabad #TrafficAlert`
3. X Intent URL opens pre-filled; operator completes post in one click
4. VMS and radio channels published simultaneously; logged to `/publish_log`

---

## Security & Privacy

- All inputs are anonymised sensor aggregates — no personal vehicle tracking, no ANPR plate capture
- All credentials stored in `final/backend/.env` only; React frontend transmits no secrets
- Backend state is in-memory — no personal data persists beyond a server session
- Rate limiting on `/analyse` endpoint prevents abuse and controls inference cost
- Platform operates outside the scope of India's DPDPA 2023 in current architecture

---

## Scalability

- Stateless FastAPI backend — horizontally scalable via Docker/Kubernetes without session management changes
- OSMnx road graphs cached to `ahmedabad.graphml` after first build — subsequent startups load in under 2 seconds
- Groq hosted inference scales with request volume — no self-hosted GPU infrastructure required
- OSMnx layer is city-agnostic — new city onboarding requires only a CSV schema mapping and one-time graph download

---

## Known Challenges & Solutions

| Challenge | Solution |
|---|---|
| Groq responses mixing free-text and JSON unpredictably | Strict XML-tagged output contracts per agent; dedicated post-processing parser |
| NetworkX routing diversions through hospital/fire station roads | Pre-tagged emergency nodes in OSMnx graph; hard exclusion filter on all path computations |
| 10MB+ CSV files causing 4–6 second load latency | Pandas chunked reads + geographic pre-filter to segments within 2km of incident centroid |
| OSMnx graph cold start (~40 sec rebuild on every startup) | Serialise built graph to `ahmedabad.graphml`; load from disk on subsequent startups (<2 sec) |
| BPR edge weights going stale between tick loop updates | Live edge-weight overlay in `router.py` re-applies current feed frame before every diversion computation |
| BLIP dependencies conflicting with FastAPI virtualenv | Invoked as isolated subprocess via `run_video_caption.py`; structured JSON captured via stdout |
| Incident resolved before async Groq thread returned | Minimum lifetime guard holds incidents in visible transitional state until all AI threads complete |
| OSMnx node IDs not matching CSV segment IDs | Coordinate proximity mapping at graph load time reconciles segment IDs to OSMnx edge keys |

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| Backend fails at startup — missing CSV | Launch server from `final/backend`, not project root |
| Groq features not responding | Check `GROQ_API_KEY` in `final/backend/.env` |
| Video analysis fails with import errors | Run `pip install -r ../../camera_feed/requirements.txt` inside backend venv |
| Frontend shows offline feed | Confirm backend running on `http://localhost:8000`; check API base URL in profile settings |
| Social publish not posting | Verify all five Twitter credentials and app write permissions in `.env` |

See `final/backend/DEBUGGING_STEPS.md` for detailed incident verification steps.

---

## Data Files

| File | Description |
|---|---|
| `final/backend/gandhinagar_traffic_feed.csv` | Primary dataset — 10MB+, anonymised municipal sensor export |
| `final/backend/ahmedabad.graphml` | Cached OSMnx road graph for Gandhinagar/Ahmedabad |

If `ahmedabad.graphml` is missing, `router.py` will build and cache it automatically from the OpenStreetMap query `Gandhinagar, Gujarat, India`.

---

## References & Acknowledgements

- Boeing, G. (2017). OSMnx: New methods for acquiring, constructing, analysing, and visualising complex street networks. *Computers, Environment and Urban Planning*, 65, 126–139.
- OpenStreetMap contributors — road network data
- AETRIX 2026 organising committee — provision of the Gandhinagar traffic dataset
- Groq, Salesforce BLIP, and OSMnx open-source maintainers

---