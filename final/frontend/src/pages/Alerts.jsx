import { useState, useEffect } from 'react'

const API = 'http://localhost:8000'
const MAX = 160

const DEFAULTS = {
  VMS:    '',
  RADIO:  '',
  SOCIAL: '',
}

// Auto-generate alert text from active incident
function generateAlerts(inc) {
  if (!inc) return DEFAULTS
  return {
    VMS:    `Heavy congestion at ${inc.location}. Use G Road via KH Road diversion.`,
    RADIO:  `Advisory for ${inc.location} corridor. Divert to G Road and Ka Road.`,
    SOCIAL: `Traffic update: ${inc.location} slowdown near Gandhinagar. Follow diversions.`,
  }
}

function AlertCard({ channel, icon, text, onTextChange, onPublish, incidentId }) {
  const pct = Math.min((text.length / MAX) * 100, 100)
  const barColor = pct > 90 ? '#ef4444' : pct > 70 ? '#f59e0b' : '#22c55e'

  const btnLabels = { VMS: 'PUBLISH TO VMS', RADIO: 'SEND TO RADIO', SOCIAL: 'POST TO SOCIAL' }

  return (
    <div className="alert-card">
      <div className="alert-card-title">
        <span style={{ fontSize: 14 }}>{icon}</span>
        {channel}
      </div>
      <textarea
        className="alert-textarea"
        value={text}
        onChange={e => onTextChange(e.target.value)}
        placeholder={`Enter ${channel} alert text...`}
      />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span className="char-count">{text.length} / {MAX}</span>
      </div>
      <div className="char-bar">
        <div className="char-bar-fill" style={{ width: `${pct}%`, background: barColor }}></div>
      </div>
      <button
        className="btn btn-publish"
        style={{ marginTop: 10, borderColor: '#0ea5e9', color: '#0ea5e9' }}
        onClick={() => onPublish(channel, text, incidentId)}
        disabled={!text.trim()}
      >
        {btnLabels[channel]}
      </button>
    </div>
  )
}

function PublishLog({ log }) {
  const channelColors = { VMS: 'badge-blue', RADIO: 'badge-amber', SOCIAL: 'badge-green' }

  return (
    <div className="card" style={{ padding: 0 }}>
      <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--muted)', letterSpacing: '0.1em' }}>
        PUBLISH LOG
      </div>
      {log.length === 0 ? (
        <div style={{ padding: 20, color: 'var(--muted)', fontSize: 13, fontFamily: 'var(--mono)', textAlign: 'center' }}>
          No alerts published yet.
        </div>
      ) : (
        log.map((entry, i) => (
          <div key={i} className="publish-log-row">
            <span className={`badge ${channelColors[entry.channel] || 'badge-muted'}`} style={{ flexShrink: 0 }}>
              {entry.channel}
            </span>
            <div style={{ flex: 1 }}>
              <div className="publish-log-msg">{entry.message}</div>
              <div className="publish-log-meta">{entry.incident_id}</div>
            </div>
            <div className="publish-log-time">{entry.time}</div>
          </div>
        ))
      )}
    </div>
  )
}

export default function Alerts() {
  const [texts,    setTexts]    = useState(DEFAULTS)
  const [log,      setLog]      = useState([])
  const [activeInc, setActiveInc] = useState(null)

  // Poll incidents to auto-fill
  useEffect(() => {
    const poll = async () => {
      try {
        const r = await fetch(`${API}/incidents`)
        const d = await r.json()
        const inc = d.active[0] || null
        setActiveInc(inc)
        if (inc) {
          setTexts(prev => {
            const generated = generateAlerts(inc)
            // Only auto-fill if fields are empty
            return {
              VMS:    prev.VMS    || generated.VMS,
              RADIO:  prev.RADIO  || generated.RADIO,
              SOCIAL: prev.SOCIAL || generated.SOCIAL,
            }
          })
        }
      } catch {}
    }
    poll()
    const t = setInterval(poll, 3000)
    return () => clearInterval(t)
  }, [])

  // Poll publish log
  useEffect(() => {
    const poll = async () => {
      try {
        const r = await fetch(`${API}/publish_log`)
        setLog(await r.json())
      } catch {}
    }
    poll()
    const t = setInterval(poll, 2000)
    return () => clearInterval(t)
  }, [])

  const handlePublish = async (channel, message, incidentId) => {
    if (!message.trim()) return
    try {
      await fetch(`${API}/publish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channel, message, incident_id: incidentId || '' })
      })
      // Clear the published field
      setTexts(prev => ({ ...prev, [channel]: '' }))
    } catch {}
  }

  const CHANNELS = [
    { key: 'VMS',    icon: '🖥', label: 'VMS' },
    { key: 'RADIO',  icon: '📻', label: 'RADIO' },
    { key: 'SOCIAL', icon: '🔗', label: 'SOCIAL' },
  ]

  return (
    <div className="page">
      <div className="page-title">ALERT PUBLISHER</div>
      <div className="page-sub">Distribute incident alerts across channels</div>

      {activeInc && (
        <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:16, padding:'10px 14px', background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:6 }}>
          <span className="badge badge-red">INCIDENT</span>
          <span style={{ fontSize:13 }}>{activeInc.id} — {activeInc.location}</span>
          <span style={{ color:'var(--muted)', fontSize:12, marginLeft:'auto', fontFamily:'var(--mono)' }}>
            Auto-filled from active incident
          </span>
        </div>
      )}

      <div className="alerts-grid">
        {CHANNELS.map(ch => (
          <AlertCard
            key={ch.key}
            channel={ch.key}
            icon={ch.icon}
            text={texts[ch.key]}
            onTextChange={val => setTexts(prev => ({ ...prev, [ch.key]: val }))}
            onPublish={handlePublish}
            incidentId={activeInc?.id || ''}
          />
        ))}
      </div>

      <PublishLog log={log} />
    </div>
  )
}