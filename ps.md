PS-3  ·  LLM Traffic Incident Co-Pilot  ·  Ahmedabad   *|   GitHub Copilot Shared Context*

**PS-3**

**LLM Traffic Incident Co-Pilot**

*Ahmedabad, Gujarat  ·  Groq API  ·  Streamlit  ·  OSMnx*


**Purpose of this document**

This document is the single shared context for all three workstream sub-groups and their GitHub Copilot agents. It defines the complete project structure, every file that must be created, which sub-group owns each file, all inter-module contracts, the CSV data schema, the Groq prompt design, and the Streamlit dashboard layout. Every developer and every Copilot session must begin by reading this document in full.

## **Workstream quick reference**

|**Workstream**|**Group**|**Core technology**|**Colour tag**|
| :- | :- | :- | :- |
|WS-1  Data pipeline & road network|Group 1  (2 people)|pandas · OSMnx · NetworkX · threading|Green|
|WS-2  Groq AI layer|Group 2  (1 person)|Groq SDK · llama-3.3-70b · JSON parsing|Purple|
|WS-3  Streamlit dashboard|Group 3  (2 people)|Streamlit · Folium · streamlit-folium|Blue|
|SHARED  Integration glue|Group 3 leads, all review|session\_state wiring · main.py|Amber|


# **1.  Complete project file structure**
Every file in the repository is listed below with its owner. GitHub Copilot should treat the owner column as the authoritative source of truth for who writes and merges changes to that file.

|**File path**|**Owner**|**Description**|
| :- | :- | :- |
|traffic\_copilot/  (root)||Project root|
|├── main.py|**WS-3**|Streamlit entry point — wires all three modules|
|├── requirements.txt|**SHARED**|All Python dependencies pinned to versions|
|├── .env  (gitignored)|**SHARED**|GROQ\_API\_KEY — never commit to git|
|├── .gitignore|**SHARED**|Ignore .env, \_\_pycache\_\_, data/\*.graphml|
|├── data/||Simulation data and graph cache|
|│   ├── ahmedabad\_feed.csv|**WS-1**|80-row traffic simulation arc (see Section 2)|
|│   └── ahmedabad.graphml|**WS-1**|OSMnx road graph cache — generated once, committed|
|├── pipeline/||WS-1 package — data and routing|
|│   ├── \_\_init\_\_.py|**WS-1**|Empty package init|
|│   ├── feed\_simulator.py|**WS-1**|pandas CSV replayer with threading|
|│   ├── road\_network.py|**WS-1**|OSMnx graph load, graphml cache, A\* routing|
|│   └── event\_detector.py|**WS-1**|Threshold logic — decides when to call Groq|
|├── ai/||WS-2 package — Groq AI layer|
|│   ├── \_\_init\_\_.py|**WS-2**|Empty package init|
|│   ├── groq\_client.py|**WS-2**|Groq SDK wrapper, rate limiter, retry logic|
|│   ├── prompt\_builder.py|**WS-2**|Structured incident prompt template|
|│   ├── response\_parser.py|**WS-2**|Extracts four output types from Groq JSON response|
|│   └── chat\_handler.py|**WS-2**|Multi-turn conversation history manager|
|└── dashboard/||WS-3 package — Streamlit UI|
|`    `├── \_\_init\_\_.py|**WS-3**|Empty package init|
|`    `├── map\_layer.py|**WS-3**|Folium map builder — speed colour coding|
|`    `├── sidebar.py|**WS-3**|Incident card, signal and diversion panels|
|`    `└── chat\_ui.py|**WS-3**|Officer chat panel with conversation history|


# **2.  CSV schema  —  ahmedabad\_feed.csv**
`  `**Owner: WS-1  ·  Group 1**  

The CSV is the simulation backbone. Every column is consumed by at least two modules — do not rename or reorder without updating all consumers. Commit this file to the repo immediately after creation so WS-2 and WS-3 can write tests against real data.

|**Column**|**Type**|**Example**|**Consumed by**|**Purpose**|
| :- | :- | :- | :- | :- |
|timestamp|string|2024-03-15 08:00:00|WS-1 replayer|Replay clock — rows fire in order|
|segment\_id|string|SEG\_042|WS-1, WS-3 map|Unique road segment ID|
|street\_name|string|SG Highway nr Prahladnagar|WS-2 prompt, WS-3 sidebar|Real name injected into Groq prompt|
|lat|float|23\.0225|WS-3 Folium|Segment midpoint latitude|
|lng|float|72\.5714|WS-3 Folium|Segment midpoint longitude|
|speed\_kmh|int|12|WS-1 detector, WS-3 colour|Core signal — drives colour and trigger|
|free\_flow\_speed|int|60|WS-1 detector|Baseline for percentage drop calculation|
|incident\_type|string|ACCIDENT|WS-1 detector, WS-2 prompt|ACCIDENT / CONGESTION / CLEAR / ROAD\_CLOSED|
|severity|int|3|WS-1 detector|1 = minor  ·  2 = moderate  ·  3 = major|
|vehicle\_count|int|84|WS-2 prompt|Traffic density context for LLM reasoning|
|direction|string|NORTHBOUND|WS-2 prompt, WS-3 sidebar|Signal re-timing context for LLM|
|nearby\_intersection|string|SG Hwy x Sindhu Bhavan Rd|WS-2 prompt|Named cross-road for signal suggestion|

### **Narrative arc — how the 80 rows must be structured**

|**Rows**|**Phase**|**speed\_kmh**|**incident\_type**|**severity**|**Effect**|
| :- | :- | :- | :- | :- | :- |
|1 – 20|Normal|45 – 65|CLEAR|1|Map updates only — no Groq call fired|
|21 – 25|Build-up|20 – 40|CONGESTION|2|Map shifts to amber — no Groq call yet|
|26|TRIGGER|8 – 14|ACCIDENT|3|Event detector fires — Groq generates all 4 outputs|
|27 – 50|Ripple|10 – 30|CONGESTION|2 – 3|Adjacent segments slow — secondary Groq calls|
|51 – 70|Recovery|30 – 50|CONGESTION|1 – 2|Speeds recovering — narrative updates|
|71 – 80|Clear|55 – 65|CLEAR|1|Full recovery — incident narrative closes|

### **Ahmedabad road segments to use**
Use only these real roads — Groq will reference them by name in its recommendations:

- SG Highway (Sarkhej–Gandhinagar Highway) near Prahladnagar and Bodakdev
- CG Road (Chimanlal Girdharlal Road) — Navrangpura to Paldi corridor
- Ashram Road — riverfront corridor, Nehru Bridge junction
- SP Ring Road — near Iscon Cross Road and Bopal junction
- Sindhu Bhavan Road — Bodakdev high-density commercial strip
- Swami Vivekanand Road — Shahibaug, near Civil Hospital
- NH-48 (old NH-8) — Vastral connector toward Nadiad
- BRTS Corridor — Naroda to Lambha via Narol


# **3.  WS-1  —  Data pipeline & road network**
`  `**Group 1  ·  2 people  ·  Files: pipeline/\*.py  +  data/\***  
## **3.1  feed\_simulator.py**
Owns the threading replayer. Fires each CSV row to two callbacks on every tick: on\_tick for every row (map update), and on\_event only when event\_detector fires. The speed\_multiplier parameter accelerates the feed for demo purposes.

\# pipeline/feed\_simulator.py

import pandas as pd, threading, time

from typing import Callable

class FeedSimulator:

`    `def \_\_init\_\_(self, csv\_path: str, tick\_seconds: float = 5.0,

`                 `speed\_multiplier: float = 1.0):

`        `self.df = pd.read\_csv(csv\_path)

`        `self.tick = tick\_seconds / speed\_multiplier

`        `self.\_stop = threading.Event()

`    `def start(self, on\_tick: Callable[[dict], None],

`              `on\_event: Callable[[dict], None]) -> None:

`        `from pipeline.event\_detector import should\_trigger

`        `def \_run():

`            `for \_, row in self.df.iterrows():

`                `if self.\_stop.is\_set(): break

`                `d = row.to\_dict()

`                `on\_tick(d)

`                `if should\_trigger(d):

`                    `on\_event(d)

`                `time.sleep(self.tick)

`        `threading.Thread(target=\_run, daemon=True).start()

`    `def stop(self) -> None:

`        `self.\_stop.set()

## **3.2  road\_network.py**
Loads the Ahmedabad OSMnx graph. On first run it fetches from OpenStreetMap and saves to data/ahmedabad.graphml. Every subsequent run loads from the cache file — the network fetch never runs again. Exposes get\_route() which returns a list of human-readable street names for injection into the WS-2 prompt.

\# pipeline/road\_network.py

import osmnx as ox, networkx as nx

from pathlib import Path

GRAPHML = Path('data/ahmedabad.graphml')

CITY    = 'Ahmedabad, Gujarat, India'

def load\_graph() -> nx.MultiDiGraph:

`    `if GRAPHML.exists():

`        `return ox.load\_graphml(GRAPHML)

`    `G = ox.graph\_from\_place(CITY, network\_type='drive')

`    `ox.save\_graphml(G, GRAPHML)

`    `return G

def get\_route(G, o\_lat, o\_lng, d\_lat, d\_lng) -> list[str]:

`    `"""Return ordered street names for diversion route."""

`    `orig = ox.nearest\_nodes(G, o\_lng, o\_lat)

`    `dest = ox.nearest\_nodes(G, d\_lng, d\_lat)

`    `path = nx.astar\_path(G, orig, dest, weight='length')

`    `names = []

`    `for u, v in zip(path[:-1], path[1:]):

`        `name = G[u][v][0].get('name', 'Unnamed road')

`        `if isinstance(name, list): name = name[0]

`        `if not names or names[-1] != name:

`            `names.append(name)

`    `return names

## **3.3  event\_detector.py**
Single pure function — no state, no imports from other workstreams. Keep isolated so WS-2 and WS-3 can mock it trivially during parallel development.

\# pipeline/event\_detector.py

SPEED\_DROP\_THRESHOLD = 0.50   # 50 percent below free-flow

SEVERITY\_TRIGGER     = 3

TRIGGER\_TYPES        = {'ACCIDENT', 'ROAD\_CLOSED'}

def should\_trigger(row: dict) -> bool:

`    `drop = 1.0 - (row['speed\_kmh'] / row['free\_flow\_speed'])

`    `return (

`        `row['incident\_type'] in TRIGGER\_TYPES or

`        `int(row['severity']) >= SEVERITY\_TRIGGER or

`        `drop >= SPEED\_DROP\_THRESHOLD

`    `)


# **4.  WS-2  —  Groq AI layer**
`  `**Group 2  ·  1 person  ·  Files: ai/\*.py**  
## **4.1  groq\_client.py**
Thin wrapper around the Groq SDK. Enforces a 10-second minimum gap between automatic incident calls to protect the rate limit during demo. Chat calls from the officer panel are never rate-limited.

\# ai/groq\_client.py

import os, time

from groq import Groq

from dotenv import load\_dotenv

load\_dotenv()

\_client    = Groq(api\_key=os.getenv('GROQ\_API\_KEY'))

\_last\_call = 0.0

MIN\_GAP    = 10.0

MODEL      = 'llama-3.3-70b-versatile'

def call(messages: list[dict], rate\_limited: bool = True) -> str:

`    `global \_last\_call

`    `if rate\_limited:

`        `elapsed = time.time() - \_last\_call

`        `if elapsed < MIN\_GAP:

`            `time.sleep(MIN\_GAP - elapsed)

`        `\_last\_call = time.time()

`    `resp = \_client.chat.completions.create(

`        `model=MODEL, messages=messages, max\_tokens=1000

`    `)

`    `return resp.choices[0].message.content

## **4.2  prompt\_builder.py**
Assembles the structured incident prompt. The system message instructs the model to return strict JSON with exactly four keys. Test the prompt output directly in the Groq playground before wiring it into the app — this is the most important validation step in WS-2.

\# ai/prompt\_builder.py

SYSTEM = '''You are a traffic incident co-pilot for Ahmedabad, India.

When given live incident data, respond ONLY with valid JSON.

No preamble. No markdown. No text outside the JSON object.

Return exactly this structure:

{

`  `"signal\_retiming": "specific intersection names and phase changes",

`  `"diversion\_route": "ordered street names with activation sequence",

`  `"public\_alert":    "ready-to-publish text for VMS/radio/social media",

`  `"narrative":       "running situation summary for officer queries"

}'''

def build\_incident\_prompt(row: dict, route: list[str]) -> list[dict]:

`    `user = f'''

`    `INCIDENT REPORT

`    `Location     : {row['street\_name']}

`    `Coordinates  : {row['lat']}, {row['lng']}

`    `Type         : {row['incident\_type']}  (severity {row['severity']}/3)

`    `Speed        : {row['speed\_kmh']} km/h  (free-flow {row['free\_flow\_speed']})

`    `Direction    : {row['direction']}

`    `Vehicles     : {row['vehicle\_count']} detected

`    `Intersection : {row['nearby\_intersection']}

`    `Diversion    : {' to '.join(route) if route else 'calculating'}

`    `Generate the four-part JSON response now.

`    `'''

`    `return [

`        `{'role': 'system', 'content': SYSTEM},

`        `{'role': 'user',   'content': user}

`    `]

## **4.3  response\_parser.py**
Safely parses Groq JSON output. Never assumes clean JSON — always returns a usable fallback dict so the dashboard never crashes on a bad response.

\# ai/response\_parser.py

import json, re

FALLBACK = {

`    `'signal\_retiming': 'Signal recommendations unavailable.',

`    `'diversion\_route': 'Diversion route unavailable.',

`    `'public\_alert':    'Incident detected. Expect delays on affected roads.',

`    `'narrative':       'Incident in progress. Situation data unavailable.',

}

def parse(raw: str) -> dict:

`    `try:

`        `clean = re.sub(r'```json|```', '', raw).strip()

`        `return json.loads(clean)

`    `except Exception:

`        `return FALLBACK.copy()

## **4.4  chat\_handler.py**
Manages the officer multi-turn conversation. History lives in Streamlit session\_state (managed by WS-3) and is passed in on every call. This module never stores state — it only adds system context and calls Groq.

\# ai/chat\_handler.py

from ai.groq\_client import call

CHAT\_SYSTEM = '''You are a traffic incident co-pilot for Ahmedabad.

Answer officer questions concisely based on the active incident context.

Always reference real Ahmedabad road names.

If uncertain about safety-critical information, say so clearly.'''

def chat(message: str, history: list[dict],

`         `incident\_context: str = '') -> str:

`    `messages = [{'role': 'system', 'content': CHAT\_SYSTEM}]

`    `if incident\_context:

`        `messages.append({

`            `'role': 'system',

`            `'content': f'Active incident context: {incident\_context}'

`        `})

`    `messages += history

`    `messages.append({'role': 'user', 'content': message})

`    `return call(messages, rate\_limited=False)


# **5.  WS-3  —  Streamlit dashboard**
`  `**Group 3  ·  2 people  ·  Files: dashboard/\*.py  +  main.py**  
## **5.1  map\_layer.py**
Builds the Folium map centred on Ahmedabad. Road segments are drawn as CircleMarkers coloured green/amber/red by speed ratio. When an incident fires, the computed diversion route is overlaid as an orange polyline.

\# dashboard/map\_layer.py

import folium

AHM = [23.0225, 72.5714]

def speed\_color(speed: int, free\_flow: int) -> str:

`    `r = speed / free\_flow

`    `if r > 0.75: return '#2ECC71'   # green

`    `if r > 0.40: return '#F39C12'   # amber

`    `return '#E74C3C'                 # red

def build\_map(rows: list[dict],

`              `diversion: list[tuple] | None = None) -> folium.Map:

`    `m = folium.Map(location=AHM, zoom\_start=13,

`                  `tiles='CartoDB positron')

`    `for row in rows:

`        `folium.CircleMarker(

`            `location=[row['lat'], row['lng']],

`            `radius=8,

`            `color=speed\_color(row['speed\_kmh'], row['free\_flow\_speed']),

`            `fill=True, fill\_opacity=0.85,

`            `popup=f"{row['street\_name']} — {row['speed\_kmh']} km/h"

`        `).add\_to(m)

`    `if diversion:

`        `folium.PolyLine(

`            `diversion, color='#E67E22', weight=5,

`            `tooltip='Suggested diversion'

`        `).add\_to(m)

`    `return m

## **5.2  sidebar.py**
Renders the Streamlit sidebar. Receives the latest state dict on every rerun. Shows a holding message when no incident is active; shows the full incident card and all four Groq output panels when active.

\# dashboard/sidebar.py

import streamlit as st

def render(state: dict) -> None:

`    `st.sidebar.title('Incident Co-Pilot')

`    `if not state.get('incident\_active'):

`        `st.sidebar.info('No active incident. Monitoring...')

`        `return

`    `with st.sidebar.container(border=True):

`        `st.sidebar.error(f"INCIDENT: {state['incident\_type']}")

`        `st.sidebar.write(f"Location : {state['street\_name']}")

`        `st.sidebar.write(f"Speed    : {state['speed\_kmh']} km/h")

`        `st.sidebar.write(f"Severity : {state['severity']} / 3")

`    `if ai := state.get('ai\_output'):

`        `st.sidebar.subheader('Signal re-timing')

`        `st.sidebar.write(ai['signal\_retiming'])

`        `st.sidebar.subheader('Diversion route')

`        `st.sidebar.write(ai['diversion\_route'])

`        `st.sidebar.subheader('Public alert')

`        `st.sidebar.code(ai['public\_alert'])

`        `st.sidebar.subheader('Situation narrative')

`        `st.sidebar.write(ai['narrative'])

## **5.3  chat\_ui.py**
Renders the officer chat panel below the map. Message history lives in st.session\_state. Passes history and incident context to ai.chat\_handler on every submission.

\# dashboard/chat\_ui.py

import streamlit as st

from ai.chat\_handler import chat

def render(incident\_context: str = '') -> None:

`    `st.subheader('Ask the co-pilot')

`    `if 'chat\_history' not in st.session\_state:

`        `st.session\_state.chat\_history = []

`    `for msg in st.session\_state.chat\_history:

`        `with st.chat\_message(msg['role']):

`            `st.write(msg['content'])

`    `if prompt := st.chat\_input(

`            `'e.g. Is it safe to open the southbound lane now?'):

`        `st.session\_state.chat\_history.append(

`            `{'role': 'user', 'content': prompt}

`        `)

`        `response = chat(

`            `prompt, st.session\_state.chat\_history, incident\_context

`        `)

`        `st.session\_state.chat\_history.append(

`            `{'role': 'assistant', 'content': response}

`        `)

`        `st.rerun()

## **5.4  main.py  —  integration entry point**
This is the last file to be completed. Do not attempt integration until WS-1 feed\_simulator and WS-2 groq\_client are both passing their own tests. Until then WS-3 uses the mock dicts defined at the top of this file.

\# main.py

import streamlit as st

from streamlit\_folium import st\_folium

from pipeline.feed\_simulator import FeedSimulator

from pipeline.road\_network   import load\_graph, get\_route

from ai.prompt\_builder       import build\_incident\_prompt

from ai.groq\_client          import call

from ai.response\_parser      import parse

from dashboard.map\_layer     import build\_map

from dashboard.sidebar       import render as render\_sidebar

from dashboard.chat\_ui       import render as render\_chat

st.set\_page\_config(page\_title='Traffic Co-Pilot — Ahmedabad',

`                   `layout='wide')

\# ── Mock data for WS-3 early development ──

MOCK\_ROW = {'street\_name': 'SG Highway', 'lat': 23.0369, 'lng': 72.5269,

`            `'speed\_kmh': 10, 'free\_flow\_speed': 60, 'incident\_type': 'ACCIDENT',

`            `'severity': 3, 'direction': 'NORTHBOUND', 'vehicle\_count': 74,

`            `'nearby\_intersection': 'SG Hwy x Sindhu Bhavan Rd'}

MOCK\_AI  = {'signal\_retiming': '[Mock] Extend green phase at SG Hwy jn by 30s.',

`            `'diversion\_route': '[Mock] Via Sindhu Bhavan Rd to SP Ring Road.',

`            `'public\_alert':    '[Mock] Accident on SG Highway. Use SP Ring Road.',

`            `'narrative':       '[Mock] Major accident near Prahladnagar. Lane 1 blocked.'}

if 'rows'  not in st.session\_state: st.session\_state.rows  = []

if 'state' not in st.session\_state:

`    `st.session\_state.state = {'incident\_active': False}

@st.cache\_resource

def get\_graph(): return load\_graph()

G = get\_graph()

def on\_tick(row):  st.session\_state.rows.append(row)

def on\_event(row):

`    `route = get\_route(G, row['lat'], row['lng'], 23.0330, 72.5850)

`    `msgs  = build\_incident\_prompt(row, route)

`    `ai    = parse(call(msgs, rate\_limited=True))

`    `st.session\_state.state = {\*\*row, 'incident\_active': True, 'ai\_output': ai}

if 'sim' not in st.session\_state:

`    `sim = FeedSimulator('data/ahmedabad\_feed.csv', speed\_multiplier=10)

`    `sim.start(on\_tick, on\_event)

`    `st.session\_state.sim = sim

col\_map, col\_chat = st.columns([3, 2])

with col\_map:

`    `m = build\_map(st.session\_state.rows[-20:])

`    `st\_folium(m, width=700, height=500)

with col\_chat:

`    `render\_chat(str(st.session\_state.state))

render\_sidebar(st.session\_state.state)

st.rerun()


# **6.  Inter-module contracts**
These are the exact function signatures all workstreams must honour. GitHub Copilot should treat this table as the interface spec — signatures must not change without team agreement.

|**Function**|**Defined in**|**Called by**|**Returns**|
| :- | :- | :- | :- |
|FeedSimulator.start(on\_tick, on\_event)|WS-1|WS-3 main|None — starts background daemon thread|
|should\_trigger(row: dict)|WS-1|WS-1 internally|bool|
|get\_route(G, o\_lat, o\_lng, d\_lat, d\_lng)|WS-1|WS-3 main|list[str]  — ordered street names|
|build\_incident\_prompt(row, route)|WS-2|WS-3 main|list[dict]  — Groq messages array|
|call(messages, rate\_limited)|WS-2|WS-3 main, chat\_handler|str  — raw Groq text response|
|parse(raw: str)|WS-2|WS-3 main|dict with keys: signal\_retiming, diversion\_route, public\_alert, narrative|
|chat(message, history, context)|WS-2|WS-3 chat\_ui|str  — assistant response string|
|build\_map(rows, diversion)|WS-3|WS-3 main|folium.Map|
|render\_sidebar(state: dict)|WS-3|WS-3 main|None — Streamlit side effects only|
|render\_chat(incident\_context: str)|WS-3|WS-3 main|None — Streamlit side effects only|


# **7.  requirements.txt  &  environment**
`  `**SHARED — all workstreams install identical dependencies**  

\# requirements.txt  — pin all versions for reproducibility

streamlit>=1.35.0

streamlit-folium>=0.20.0

folium>=0.16.0

pandas>=2.2.0

osmnx>=1.9.0

networkx>=3.3

groq>=0.9.0

python-dotenv>=1.0.0

shapely>=2.0.0

\# .env  (add to .gitignore immediately — never commit this file)

GROQ\_API\_KEY=gsk\_xxxxxxxxxxxxxxxxxxxxxxxxxxxx

\# Install and run

pip install -r requirements.txt

streamlit run main.py


# **8.  Critical path & build order**
WS-1 and WS-2 build in parallel from hour zero. WS-3 mocks both and works independently. Integration happens in Phase 3 only after both upstream workstreams have passing tests.

|**Phase**|**Hours**|**WS-1**|**WS-2**|**WS-3**|
| :- | :- | :- | :- | :- |
|1  Foundation|0 – 4 h|OSMnx graph fetched and cached to graphml|Groq prompt tested in playground, returns clean JSON|Static Folium map of Ahmedabad renders in Streamlit|
|2  Core build|4 – 14 h|CSV arc complete, feed\_simulator threading working, get\_route() returning real street names|All ai/ files coded and unit tested with MOCK\_ROW constant|sidebar.py and chat\_ui.py complete using MOCK\_AI constant|
|3  Integration|14 – 22 h|Hand off row dict and get\_route() to WS-3 main|Hand off all four ai/ functions to WS-3 main|Wire main.py — replace mocks with real calls, end-to-end test|
|4  Polish|22 – 30 h|Tune CSV arc for demo narrative quality|Tune prompts for Ahmedabad-specific LLM output|Demo run-through, latency timing, UI polish|
|5  Buffer|30 – 36 h|Bug fixes, fallback CSV if OSMnx fails live|Fallback mock responses if Groq API is down|Demo script, presentation slides, Q&A prep|

## **The golden rule for parallel development**
WS-3 must never wait for WS-1 or WS-2. Use MOCK\_ROW and MOCK\_AI from day one. Replace with real module calls only after Phase 2 is complete and both upstream modules have passing tests. This keeps the dashboard always runnable, which means the team always has something to demo.

*End of document  ·  PS-3 Traffic Incident Co-Pilot  ·  Ahmedabad  ·  GitHub Copilot shared context*
Implementation Report  ·  Confidential	Page 
