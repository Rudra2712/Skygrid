from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import pandas as pd
import threading
import time
from datetime import datetime
from typing import Optional

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Load CSV ──────────────────────────────────────────────────────
df = pd.read_csv("gandhinagar_traffic_feed.csv")
df["timestamp"] = pd.to_datetime(df["timestamp"])
timestamps = sorted(df["timestamp"].unique())
TOTAL = len(timestamps)

# ── Shared state ──────────────────────────────────────────────────
state = {
    "ts_index":    0,
    "playing":     True,
    "incidents":   [],
    "publish_log": [],
    "inc_counter": 1,
}

def tick():
    while True:
        if state["playing"]:
            ts   = timestamps[state["ts_index"]]
            rows = df[df["timestamp"] == ts]

            # Detect incidents
            inc_rows = rows[rows["incident_type"].isin(["ACCIDENT","ROAD_CLOSED"])]
            new_incs = []
            seen_ids = {i["seg_id"] for i in state["incidents"] if i["status"] == "ACTIVE"}

            for _, r in inc_rows.iterrows():
                if r["seg_id"] not in seen_ids:
                    inc_id = f"INC_{state['inc_counter']:03d}"
                    state["inc_counter"] += 1
                    new_incs.append({
                        "id":       inc_id,
                        "seg_id":   r["seg_id"],
                        "location": r["street_name"],
                        "type":     r["incident_type"],
                        "severity": int(r["severity"]),
                        "speed":    int(r["speed"]),
                        "time":     datetime.now().strftime("%H:%M:%S"),
                        "status":   "ACTIVE",
                        "lat":      float(r["lat"]),
                        "lng":      float(r["lng"]),
                    })

            state["incidents"] = [
                {**i, "status": "RESOLVED"}
                if i["seg_id"] not in inc_rows["seg_id"].values and i["status"] == "ACTIVE"
                else i
                for i in state["incidents"]
            ] + new_incs

            state["ts_index"] = (state["ts_index"] + 1) % TOTAL

        time.sleep(0.8)

threading.Thread(target=tick, daemon=True).start()

# ── Endpoints ─────────────────────────────────────────────────────
@app.get("/feed")
def get_feed():
    ts   = timestamps[state["ts_index"]]
    rows = df[df["timestamp"] == ts]
    segs = []
    for _, r in rows.iterrows():
        ratio = r["speed"] / r["free_flow_speed"] if r["free_flow_speed"] > 0 else 1
        if ratio >= 0.85:  color = "#00AA00"
        elif ratio >= 0.65: color = "#7DC900"
        elif ratio >= 0.45: color = "#FFA500"
        elif ratio >= 0.25: color = "#FF4500"
        else:               color = "#CC0000"
        segs.append({
            "seg_id":        r["seg_id"],
            "street_name":   r["street_name"],
            "speed":         int(r["speed"]),
            "free_flow":     int(r["free_flow_speed"]),
            "incident_type": r["incident_type"],
            "severity":      int(r["severity"]),
            "vehicle_count": int(r["vehicle_count"]),
            "direction":     r["direction"],
            "lat":           float(r["lat"]),
            "lng":           float(r["lng"]),
            "s1lat":         float(r["seg_start_lat"]),
            "s1lng":         float(r["seg_start_lng"]),
            "s2lat":         float(r["seg_end_lat"]),
            "s2lng":         float(r["seg_end_lng"]),
            "color":         color,
        })
    # Summary metrics
    total_v     = int(rows["vehicle_count"].sum())
    avg_speed   = float(rows["speed"].mean())
    avg_ff      = float(rows["free_flow_speed"].mean())
    health      = round((avg_speed / avg_ff) * 100) if avg_ff > 0 else 100
    inc_count   = int((rows["incident_type"].isin(["ACCIDENT","ROAD_CLOSED"])).sum())
    cong_count  = int((rows["incident_type"] == "CONGESTION").sum())

    return {
        "timestamp":   str(ts),
        "ts_index":    state["ts_index"],
        "segments":    segs,
        "metrics": {
            "total_vehicles":   total_v,
            "avg_speed":        round(avg_speed, 1),
            "network_health":   health,
            "incident_count":   inc_count,
            "congestion_count": cong_count,
        }
    }

@app.get("/incidents")
def get_incidents():
    active   = [i for i in state["incidents"] if i["status"] == "ACTIVE"]
    resolved = [i for i in state["incidents"] if i["status"] == "RESOLVED"]
    return {
        "active":   active,
        "resolved": resolved,
        "total":    len(state["incidents"]),
        "avg_response": 8.4,
    }

@app.get("/publish_log")
def get_publish_log():
    return state["publish_log"]

@app.post("/publish")
def publish_alert(payload: dict):
    state["publish_log"].insert(0, {
        "channel":    payload.get("channel"),
        "message":    payload.get("message"),
        "incident_id":payload.get("incident_id", ""),
        "time":       datetime.now().strftime("%H:%M:%S"),
    })
    return {"ok": True}

@app.get("/insights/{incident_id}")
def get_insights(incident_id: str):
    inc = next((i for i in state["incidents"] if i["id"] == incident_id), None)
    if not inc:
        return {"error": "not found"}
    return {
        "signal_retiming": f"Extend green at GH Road x CH Road by 30s. Reduce {inc['location']} junction phase by 15s.",
        "diversion":       "G Road → KH Road → Ka Road. Activate in sequence, 2-min intervals.",
        "narrative":       f"Major incident at {inc['location']} {inc['time']}. Lane 1 blocked. {inc['speed']} km/h vs {60} free flow. Diversion active.",
        "diversion_coords": [
            [23.218614, 72.642449],
            [23.220000, 72.635000],
            [23.215000, 72.628000],
            [23.210000, 72.625000],
        ]
    }

@app.get("/control")
def control(action: str):
    if action == "play":    state["playing"] = True
    if action == "pause":   state["playing"] = False
    if action == "reset":   state["ts_index"] = 0
    return {"playing": state["playing"], "ts_index": state["ts_index"]}