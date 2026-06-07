import { useEffect, useRef } from 'react'
import L from 'leaflet'

const CENTRE = [23.215, 72.645]

export default function MapView({ segments, incident }) {
  const lmapRef   = useRef(null)
  const layersRef = useRef([])
  const markerRef = useRef(null)

  useEffect(() => {
    if (lmapRef.current) return
    const map = L.map('leaflet-map', {
      center: CENTRE,
      zoom: 14,
      zoomControl: true,
      attributionControl: false,
    })
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      subdomains: 'abcd',
    }).addTo(map)
    lmapRef.current = map
    return () => { map.remove(); lmapRef.current = null }
  }, [])

  useEffect(() => {
    const map = lmapRef.current
    if (!map || !segments || segments.length === 0) return
    layersRef.current.forEach(l => map.removeLayer(l))
    layersRef.current = []

    segments.forEach(seg => {
      if (!seg.seg_start_lat || !seg.seg_end_lat) return
      const weight = seg.incident_type === 'ACCIDENT' || seg.incident_type === 'ROAD_CLOSED'
        ? 7 : seg.free_flow_speed >= 55 ? 4 : 2.5

      const line = L.polyline(
        [[seg.seg_start_lat, seg.seg_start_lng], [seg.seg_end_lat, seg.seg_end_lng]],
        { color: seg.color, weight, opacity: 0.88 }
      ).bindTooltip(
        `<b style="font-family:monospace;font-size:12px">${seg.street_name}</b><br/>` +
        `<span style="font-family:monospace;font-size:11px">` +
        `${seg.speed} km/h | ff ${seg.free_flow_speed}<br/>` +
        `${seg.incident_type} sev${seg.severity} | ${seg.vehicle_count} vehicles</span>`,
        { sticky: true }
      ).addTo(map)
      layersRef.current.push(line)
    })
  }, [segments])

  useEffect(() => {
    const map = lmapRef.current
    if (!map) return
    if (markerRef.current) { map.removeLayer(markerRef.current); markerRef.current = null }
    if (incident) {
      const icon = L.divIcon({
        className: '',
        html: `<div style="width:20px;height:20px;background:#e84040;border:3px solid #ff8080;border-radius:50%;"></div>`,
        iconSize: [20, 20],
        iconAnchor: [10, 10],
      })
      markerRef.current = L.marker([incident.lat, incident.lng], { icon })
        .bindPopup(
          `<b style="font-family:monospace">${incident.type}</b><br/>` +
          `<span style="font-family:monospace;font-size:11px">${incident.location}<br/>${incident.speed} km/h</span>`
        ).addTo(map)
    }
  }, [incident])

  return <div id="leaflet-map" style={{ flex: 1, minHeight: 0 }} />
}