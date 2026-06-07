$file = 'D:\Projects\Aetrix\final\frontend\src\pages\Dashboard.jsx'
$content = Get-Content $file -Raw
$new_dashboard = "export default function Dashboard() {
  const {
    currentFrame, roadFeed, incident, incidentLog,
    incidentCount, congestedCount, avgSpeed, networkHealth,
    currentTs, frameIdx, totalFrames, isPlaying, setIsPlaying,
    playSpeed, setPlaySpeed, goToFrame,
  } = useFeed()

  const activeInc = incident || (incidentLog.length > 0 ? incidentLog[0] : null)
  const diversions = activeInc ? ['G Road ? KH Road', 'Ka Road via Ring Road'] : []

  return (
    <div className='dashboard-layout' style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
        <div className='sidebar'>
          <IncidentCard inc={activeInc} onAck={() => {}} />
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
}"
$content = $content -replace '(?s)export default function Dashboard\(\) \{.*\}', $new_dashboard
Set-Content $file $content

