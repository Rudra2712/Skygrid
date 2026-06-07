import { useState, useEffect, useRef, useCallback } from 'react'
import Papa from 'papaparse'

const WATCH_ROADS = [
  'GH Road', 'CH Road', 'Road 3', 'KH Road', 'G Road', 'Ka Road',
  'Gandhinagar Bypass Road', 'Road 2'
]

function speedColor(speed, freeFlow) {
  const r = freeFlow > 0 ? speed / freeFlow : 1
  if (r >= 0.85) return '#00AA00'
  if (r >= 0.65) return '#7DC900'
  if (r >= 0.45) return '#FFA500'
  if (r >= 0.25) return '#FF4500'
  return '#CC0000'
}

export function useFeed() {
  const [allFrames, setAllFrames]         = useState([])
  const [frameIdx, setFrameIdx]           = useState(0)
  const [currentFrame, setCurrentFrame]   = useState([])
  const [incident, setIncident]           = useState(null)
  const [incidentLog, setIncidentLog]     = useState([])
  const [isLoaded, setIsLoaded]           = useState(false)
  const [isPlaying, setIsPlaying]         = useState(false)
  const [playSpeed, setPlaySpeed]         = useState(1500)
  const [totalFrames, setTotalFrames]     = useState(0)
  const timerRef   = useRef(null)
  const incLogRef  = useRef([])

  useEffect(() => {
    Papa.parse('/gandhinagar_traffic_feed.csv', {
      download: true,
      header: true,
      dynamicTyping: true,
      complete: (results) => {
        const rows = results.data.filter(r => r.seg_id)
        const grouped = {}
        rows.forEach(r => {
          if (!grouped[r.timestamp]) grouped[r.timestamp] = []
          grouped[r.timestamp].push(r)
        })
        const frames = Object.entries(grouped)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([ts, segs]) => ({ ts, segs }))

        setAllFrames(frames)
        setTotalFrames(frames.length)
        setIsLoaded(true)
        if (frames.length > 0) setCurrentFrame(frames[0].segs)
      }
    })
  }, [])

  const processFrame = useCallback((idx, frames) => {
    if (!frames || idx >= frames.length) return
    const frame = frames[idx]
    setCurrentFrame(frame.segs)
    setFrameIdx(idx)

    const activeIncidents = frame.segs.filter(
      s => s.incident_type === 'ACCIDENT' || s.incident_type === 'ROAD_CLOSED'
    )

    if (activeIncidents.length > 0) {
      const primary = activeIncidents[0]
      setIncident({
        id:       `INC_${String(idx).padStart(3, '0')}`,
        segId:    primary.seg_id,
        location: primary.street_name,
        time:     frame.ts.split(' ')[1]?.slice(0, 8) || '',
        speed:    primary.speed,
        freeFlow: primary.free_flow_speed,
        type:     primary.incident_type,
        severity: primary.severity,
        lat:      primary.lat,
        lng:      primary.lng,
      })

      const logKey = `${primary.seg_id}-${frame.ts}`
      if (!incLogRef.current.find(l => l.key === logKey)) {
        const entry = {
          key:      logKey,
          id:       `INC_${String(incLogRef.current.length + 1).padStart(3, '0')}`,
          location: primary.street_name,
          type:     primary.incident_type,
          severity: primary.severity,
          time:     frame.ts.split(' ')[1]?.slice(0, 8) || '',
          status:   'ACTIVE',
        }
        incLogRef.current = [entry, ...incLogRef.current].slice(0, 20)
        setIncidentLog([...incLogRef.current])
      }
    } else {
      if (incLogRef.current.some(l => l.status === 'ACTIVE')) {
        incLogRef.current = incLogRef.current.map(l =>
          l.status === 'ACTIVE' && idx > 66 ? { ...l, status: 'RESOLVED' } : l
        )
        setIncidentLog([...incLogRef.current])
        if (idx > 66) setIncident(null)
      }
    }
  }, [])

  useEffect(() => {
    if (!isPlaying || !isLoaded || allFrames.length === 0) return
    timerRef.current = setInterval(() => {
      setFrameIdx(prev => {
        const next = prev + 1 >= allFrames.length ? 0 : prev + 1
        processFrame(next, allFrames)
        return next
      })
    }, playSpeed)
    return () => clearInterval(timerRef.current)
  }, [isPlaying, isLoaded, allFrames, processFrame, playSpeed])

  const goToFrame = useCallback((idx) => {
    processFrame(idx, allFrames)
  }, [allFrames, processFrame])

  const roadFeed = WATCH_ROADS.map(name => {
    const segs = currentFrame.filter(s => s.street_name === name)
    if (segs.length === 0) return null
    const avgSpeed = Math.round(segs.reduce((a, s) => a + s.speed, 0) / segs.length)
    const ff       = segs[0].free_flow_speed
    const inc      = segs.some(s => s.incident_type === 'ACCIDENT')    ? 'ACCIDENT'
                   : segs.some(s => s.incident_type === 'ROAD_CLOSED') ? 'ROAD_CLOSED'
                   : segs.some(s => s.incident_type === 'CONGESTION')  ? 'CONGESTION'
                   : 'CLEAR'
    return { name, speed: avgSpeed, freeFlow: ff, color: speedColor(avgSpeed, ff), inc }
  }).filter(Boolean)

  const mapSegments = currentFrame.map(s => ({
    ...s,
    color: speedColor(s.speed, s.free_flow_speed),
  }))

  const incidentCount  = currentFrame.filter(s => s.incident_type === 'ACCIDENT' || s.incident_type === 'ROAD_CLOSED').length
  const congestedCount = currentFrame.filter(s => s.incident_type === 'CONGESTION').length
  const avgSpeed       = currentFrame.length > 0
    ? Math.round(currentFrame.reduce((a, s) => a + s.speed, 0) / currentFrame.length) : 0
  const avgFF          = currentFrame.length > 0
    ? currentFrame.reduce((a, s) => a + s.free_flow_speed, 0) / currentFrame.length : 1
  const networkHealth  = Math.round((avgSpeed / avgFF) * 100)

  return {
    isLoaded,
    isPlaying, setIsPlaying,
    playSpeed, setPlaySpeed,
    frameIdx, totalFrames,
    goToFrame,
    currentFrame: mapSegments,
    roadFeed,
    incident,
    incidentLog,
    incidentCount, congestedCount, avgSpeed, networkHealth,
    currentTs: allFrames[frameIdx]?.ts || '',
  }
}