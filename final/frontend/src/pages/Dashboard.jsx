import { useState, useEffect, useRef } from 'react'
import { useFeed } from '../hooks/useFeed.js'
import PlaybackBar from '../components/PlaybackBar.jsx'

const API = 'http://localhost:8000'

// Roads to show in the feed sidebar
const FEED_ROADS = [
  'GH Road', 'CH Road', 'Road 3', 'KH Road',
  'G Road', 'Ka Road', 'Gandhinagar Bypass Road'
]

function SpeedDot({ color }) {
  return <span className="dot" style={{ background: color, flexShrink: 0 }}></span>
}

function SeverityBars({ speed, freeFlow }) {
  const ratio = freeFlow > 0 ? speed / freeFlow : 1
  const filled = ratio >= 0.75 ? 0 : ratio >= 0.5 ? 1 : ratio >= 0.25 ? 2 : 3
  return (
    <div className="speed-bars">
      {[0,1,2].map(i => (
        <div key={i} className={`speed-bar ${i < filled ? 'filled' : ''}`}></div>
      ))}
    </div>
  )
}

function IncidentCard({ inc, onAck }) {
  if (!inc) return (
    <div className="card" style={{ borderColor: 'var(--border)' }}>
      <div className="section-title">INCIDENT STATUS</div>
      <div style={{ color: 'var(--green)', fontFamily: 'var(--mono)', fontSize: 13, marginTop: 8 }}>
        <span className="dot dot-green" style={{ marginRight: 6 }}></span>
        NO ACTIVE INCIDENT
      </div>
      <div style={{ color: 'var(--muted)', fontSize: 12, marginTop: 6 }}>Monitoring live feed...</div>
    </div>
  )

  return (
    <div className="inc-card-active">
      <div className="badge badge-red" style={{ fontSize: 10 }}>INCIDENT ACTIVE</div>
      <div className="inc-id">{inc.id}</div>
      <div className="inc-loc">{inc.location}</div>
      <div className="inc-time mono">{inc.time}</div>
      <SeverityBars speed={inc.speed} freeFlow={60} />
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, margin: '8px 0 4px' }}>
        <span className="inc-speed">{inc.speed}</span>
        <span className="inc-speed-unit">km/h</span>
      </div>
      <button className="btn btn-ack" onClick={() => onAck(inc.id)}>
        ACKNOWLEDGE
      </button>
    </div>
  )
}

function RoadFeed({ segments }) {
  const byRoad = {}
  for (const s of segments) {
    if (!FEED_ROADS.includes(s.street_name)) continue
    if (!byRoad[s.street_name] || s.speed < byRoad[s.street_name].speed) {
      byRoad[s.street_name] = s
    }
  }

  return (
    <div className="feed-section">
      <div className="section-title">ROAD FEED</div>
      {FEED_ROADS.map(road => {
        const seg = byRoad[road]
        if (!seg) return null
        const ratio = seg.free_flow > 0 ? seg.speed / seg.free_flow : 1
        const color = ratio >= 0.85 ? '#00AA00'
                    : ratio >= 0.65 ? '#7DC900'
                    : ratio >= 0.45 ? '#FFA500'
                    : ratio >= 0.25 ? '#FF4500'
                    : '#CC0000'
        const trend = ratio >= 0.75 ? '↑' : ratio >= 0.4 ? '–' : '↘'
        return (
          <div key={road} className="road-row">
            <SpeedDot color={color} />
            <span className="road-name">{road}</span>
            <span className="road-speed" style={{ color }}>
              {seg.speed} km/h
            </span>
            <span className="trend">{trend}</span>
          </div>
        )
      })}
    </div>
  )
}

function DiversionList({ diversions }) {
  if (!diversions || diversions.length === 0) return null
  return (
    <div>
      <div className="section-title">DIVERSIONS</div>
      {diversions.map((d, i) => (
        <div key={i} className="diversion-row">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ flexShrink: 0 }}>
            <path d="M2 7h8M7 4l3 3-3 3" stroke="#f59e0b" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
          {d}
        </div>
      ))}
      <button className="btn btn-clear" style={{ marginTop: 8 }}>
        × CLEAR ALL DIVERSIONS
      </button>
    </div>
  )
}

function LeafletMap({ segments, diversion_coords }) {
  const mapRef     = useRef(null)
  const mapObj     = useRef(null)
  const linesRef   = useRef([])
  const divRef     = useRef(null)
  const incRef     = useRef(null)

  useEffect(() => {
    if (mapObj.current) return
    const L = window.L
    const map = L.map(mapRef.current, {
      center: [23.215, 72.645],
      zoom: 14,
      zoomControl: false,
    })
    L.tileLayer(
      'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
      { attribution: '&copy; OpenStreetMap &copy; CARTO', maxZoom: 19 }
    ).addTo(map)
    L.control.zoom({ position: 'bottomright' }).addTo(map)
    mapObj.current = map
  }, [])

  useEffect(() => {
    const L = window.L
    if (!L || !mapObj.current || !segments.length) return
    const map = mapObj.current

    // Remove old lines
    linesRef.current.forEach(l => map.removeLayer(l))
    linesRef.current = []
    if (incRef.current) { map.removeLayer(incRef.current); incRef.current = null }
    if (divRef.current) { map.removeLayer(divRef.current); divRef.current = null }

    for (const s of segments) {
        if (!s.seg_start_lat || !s.seg_start_lng || !s.seg_end_lat || !s.seg_end_lng) continue;
        const w = s.incident_type === 'ACCIDENT' ? 8 : s.incident_type === 'ROAD_CLOSED' ? 7 : 3
        const line = L.polyline(
          [[s.seg_start_lat, s.seg_start_lng], [s.seg_end_lat, s.seg_end_lng]],
        { color: s.color, weight: w, opacity: 0.9 }
      )
      .bindTooltip(
        `<b>${s.street_name}</b><br>${s.speed} km/h / ${s.free_flow} ff<br>${s.incident_type} sev${s.severity}`,
        { sticky: true }
      )
      .addTo(map)
      linesRef.current.push(line)

      if (s.incident_type === 'ACCIDENT' || s.incident_type === 'ROAD_CLOSED') {
        incRef.current = L.circleMarker([s.lat, s.lng], {
          radius: 12, color: '#ef4444', fillColor: '#ef4444', fillOpacity: 0.9, weight: 2
        }).bindPopup(`<b>${s.incident_type}</b><br>${s.street_name}<br>${s.speed} km/h`).addTo(map)
      }
    }

    if (diversion_coords && diversion_coords.length > 1) {
      divRef.current = L.polyline(diversion_coords, {
        color: '#f59e0b', weight: 4, opacity: 0.85,
        dashArray: '8 5', dashOffset: '0'
      }).bindTooltip('Suggested diversion').addTo(map)
    }
  }, [segments, diversion_coords])

  return <div id="map" ref={mapRef} style={{ width: '100%', height: '100%' }}></div>
}

function InsightsBar({ insights }) {
  if (!insights) return (
    <div className="insights-bar" style={{ gridTemplateColumns: '1fr' }}>
      <div style={{ color: 'var(--muted)', fontFamily: 'var(--mono)', fontSize: 12 }}>
        Waiting for incident to generate insights...
      </div>
    </div>
  )
  return (
    <div className="insights-bar">
      <div className="insight-block">
        <div className="insight-label">SIGNAL RETIMING SUMMARY</div>
        <div className="insight-text">{insights.signal_retiming}</div>
      </div>
      <div className="insight-block">
        <div className="insight-label">DIVERSION SUMMARY</div>
        <div className="insight-text">{insights.diversion}</div>
      </div>
      <div className="insight-block">
        <div className="insight-label">NARRATIVE</div>
        <div className="insight-text">{insights.narrative}</div>
      </div>
    </div>
  )
}

function StatusBar({ metrics, tsIndex }) {
  return (
    <div className="status-bar">
      <div className="status-item">
        AI RESPONSE <span className="status-val" style={{ marginLeft: 4 }}>8.4s</span>
      </div>
      <div className="status-item">
        MANUAL BASELINE <span className="status-val" style={{ marginLeft: 4 }}>~4 min</span>
      </div>
      <div className="status-item">
        EST. SAVED <span className="status-val" style={{ color: 'var(--green)', marginLeft: 4 }}>2m 35s</span>
      </div>
      <div style={{ flex: 1 }}></div>
      <div className="status-item">
        NETWORK HEALTH <span className="status-val" style={{ marginLeft: 4 }}>{metrics.network_health}%</span>
      </div>
      <div className="status-item">
        AVG SPEED <span className="status-val" style={{ marginLeft: 4 }}>{metrics.avg_speed} km/h</span>
      </div>
    </div>
  )
}

export default function Dashboard() {
  const {
    currentFrame, roadFeed, incident, incidentLog,
    incidentCount, congestedCount, avgSpeed, networkHealth,
    currentTs, frameIdx, totalFrames, isPlaying, setIsPlaying,
    playSpeed, setPlaySpeed, goToFrame,
  } = useFeed()

  const activeIncs = (currentFrame || [])
    .filter(s => s.incident_type === 'ACCIDENT' || s.incident_type === 'ROAD_CLOSED')
    .map((s, i) => ({
      id: `INC_${String(i + 1).padStart(2, '0')}`,
      location: s.street_name,
      time: currentTs?.split(' ')[1]?.slice(0, 5) || '--:--',
      speed: s.speed,
      freeFlow: s.free_flow_speed,
      type: s.incident_type,
      severity: s.severity
    }))

  const diversions = activeIncs.length > 0 ? ['G Road → KH Road', 'Ka Road via Ring Road'] : []

  return (
    <div className='dashboard-layout' style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
        <div className='sidebar'>
          {activeIncs.length > 0 ? (
            activeIncs.map((inc, i) => <IncidentCard key={i} inc={inc} onAck={() => {}} />)
          ) : (
            <IncidentCard inc={null} onAck={() => {}} />
          )}
          <RoadFeed segments={currentFrame || []} />
          <DiversionList diversions={diversions} />
        </div>

        <div className='main-area' style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <div className='map-container' style={{ flex: 1, position: 'relative' }}>
            <LeafletMap segments={currentFrame || []} diversion_coords={null} />
            <button className='copilot-btn'>OPEN CO-PILOT</button>
          </div>
          <InsightsBar insights={null} />
        </div>
      </div>
      
      <PlaybackBar
        frameIdx={frameIdx}
        totalFrames={totalFrames}
        currentTs={currentTs}
        isPlaying={isPlaying}
        setIsPlaying={setIsPlaying}
        playSpeed={playSpeed}
        setPlaySpeed={setPlaySpeed}
        goToFrame={goToFrame}
        incidentCount={incidentCount}
        congestedCount={congestedCount}
        avgSpeed={avgSpeed}
        networkHealth={networkHealth}
      />
    </div>
  )
}
