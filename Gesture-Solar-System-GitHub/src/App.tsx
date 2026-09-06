import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Activity, ChevronDown, CircleHelp, Crosshair, Layers3, MousePointer2, RotateCcw, Sparkles } from 'lucide-react'
import SolarSystemScene from './components/SolarSystemScene'
import GestureTracker from './components/GestureTracker'
import PlanetInfoPanel from './components/PlanetInfoPanel'
import ControlBar from './components/ControlBar'
import GestureLegend from './components/GestureLegend'
import ModuleBoundary from './components/ModuleBoundary'
import { celestialBodies, planets } from './data'
import type { GestureCommand, SceneControls } from './gestures/types'

function App() {
  const [paused, setPaused] = useState(false)
  const [timeScale, setTimeScale] = useState(1)
  const [showOrbits, setShowOrbits] = useState(true)
  const [showLabels, setShowLabels] = useState(false)
  const [showGrid, setShowGrid] = useState(true)
  const [cameraEnabled, setCameraEnabled] = useState(false)
  const [sceneFailed, setSceneFailed] = useState(false)
  const [selectedId, setSelectedId] = useState('earth')
  const [legendOpen, setLegendOpen] = useState(false)
  const [mode, setMode] = useState<'FREE EXPLORE' | 'FOCUS MODE'>('FREE EXPLORE')
  const [toast, setToast] = useState('')
  const sceneRef = useRef<SceneControls>(null)
  const selectedIdRef = useRef(selectedId)
  selectedIdRef.current = selectedId
  const helpersVisibleRef = useRef(true)
  helpersVisibleRef.current = showOrbits || showLabels || showGrid
  const selected = useMemo(() => celestialBodies.find((p) => p.id === selectedId) ?? planets[2], [selectedId])

  const toggleCamera = () => {
    if (sceneFailed) { setToast('请先恢复三维场景'); return }
    setCameraEnabled((value) => !value)
  }
  const stopCamera = () => setCameraEnabled(false)
  const handleSceneFailure = () => { setSceneFailed(true); stopCamera() }
  const retryScene = () => { setSceneFailed(false); setMode('FREE EXPLORE') }

  const selectPlanet = useCallback((id: string) => {
    selectedIdRef.current = id
    setSelectedId(id)
    setMode('FOCUS MODE')
    sceneRef.current?.focus(id)
  }, [])
  const reset = useCallback(() => {
    setPaused(false); setTimeScale(1); setSelectedId('earth'); selectedIdRef.current = 'earth'
    setMode('FREE EXPLORE'); sceneRef.current?.reset(); setToast('视角已重置')
  }, [])
  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(''), 1800)
    return () => window.clearTimeout(timer)
  }, [toast])
  const cycle = useCallback((dir: number) => {
    const index = celestialBodies.findIndex((p) => p.id === selectedIdRef.current)
    selectPlanet(celestialBodies[(index + dir + celestialBodies.length) % celestialBodies.length].id)
  }, [selectPlanet])
  const gesture = useCallback((command: GestureCommand) => {
    switch (command.type) {
      case 'togglePause': setPaused((value) => !value); break
      case 'reset': reset(); break
      case 'toggleHelpers': {
        const visible = !helpersVisibleRef.current
        helpersVisibleRef.current = visible
        setShowOrbits(visible); setShowLabels(visible); setShowGrid(visible)
        break
      }
      case 'zoom': sceneRef.current?.zoom(command.delta); break
      case 'orbit': sceneRef.current?.orbit(command.dx, command.dy); break
      case 'point': sceneRef.current?.point(command.x, command.y); break
      case 'clearPointer': sceneRef.current?.clearPointer(); break
      case 'cycle': cycle(command.direction); break
      case 'time': setTimeScale((value) => Math.max(0, Math.min(4, value + command.delta))); break
    }
  }, [cycle, reset])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLInputElement) return
      if (event.code === 'Space') { event.preventDefault(); setPaused((v) => !v) }
      if (event.key.toLowerCase() === 'r') reset()
      if (event.key.toLowerCase() === 'l') setShowOrbits((v) => !v)
      if (event.key.toLowerCase() === 'h') setLegendOpen((v) => !v)
      if (event.key === '+' || event.key === '=') setTimeScale((v) => Math.min(4, v + 0.25))
      if (event.key === '-') setTimeScale((v) => Math.max(0, v - 0.25))
      const number = Number(event.key)
      if (number >= 1 && number <= 9) selectPlanet(celestialBodies[number - 1].id)
      if (event.key === 'Escape') { setMode('FREE EXPLORE'); sceneRef.current?.free(); sceneRef.current?.clearPointer() }
    }
    window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey)
  }, [reset, selectPlanet])

  return <main className={`app-shell${sceneFailed ? ' scene-unavailable' : ''}`}>
    <div className="scene-layer"><ModuleBoundary label="三维场景已暂停" hint="摄像头已释放，请点击重试以恢复太阳系。" className="scene-failure" onFailure={handleSceneFailure} onRetry={retryScene}><SolarSystemScene ref={sceneRef} paused={paused} timeScale={timeScale} selected={selectedId} showOrbits={showOrbits} showLabels={showLabels} showGrid={showGrid} onSelect={selectPlanet} /></ModuleBoundary></div>
    <div className="vignette" />
    <header className="topbar">
      <div className="brand"><div className="brand-mark"><Sparkles size={18} /></div><div><strong>手势<span> / </span>太阳系</strong><small>交互观测台</small></div></div>
      <div className="top-status">
        <span className={`system-status${sceneFailed ? ' status-warning' : ''}`} role="status"><i /><span>{sceneFailed ? '场景已暂停' : '系统运行中'}</span></span>
        <span className="top-divider" />
        <button className="mode-select" onClick={() => { if (mode === 'FOCUS MODE') { setMode('FREE EXPLORE'); sceneRef.current?.free() } else selectPlanet(selectedId) }} aria-label={mode === 'FOCUS MODE' ? '切换至自由探索' : '聚焦所选天体'} title={mode === 'FOCUS MODE' ? '切换至自由探索' : '聚焦所选天体'}><Layers3 size={14} /><span>{mode === 'FOCUS MODE' ? '聚焦行星' : '自由探索'}</span><ChevronDown size={13} /></button>
        <button className="round-help" onClick={() => setLegendOpen(true)} aria-label="打开手势图谱" title="手势图谱"><CircleHelp size={17} /></button>
      </div>
    </header>
    <div className="scene-hud"><div className="hud-coords"><span>星区 01</span><strong>日心视角</strong><small>高度 12.4 天文单位 <b /> 方位角 038°</small></div><div className="hud-target"><Crosshair size={15} /><span>当前目标</span><strong>{selected.name}</strong></div></div>
    <div className="left-stack"><ModuleBoundary label="摄像头模块已暂停" hint="摄像头已释放，请点击重试以恢复相机控制。" className="camera-failure" onFailure={stopCamera}><GestureTracker enabled={cameraEnabled} onToggle={toggleCamera} onCommand={gesture} /></ModuleBoundary><div className="mouse-hint"><MousePointer2 size={14} /><span>拖动旋转 <b>·</b> 滚轮缩放</span></div></div>
    <div className="right-stack"><PlanetInfoPanel planet={selected} onFocus={() => selectPlanet(selectedId)} /><div className="telemetry-strip"><Activity size={14} /><span>公转速度</span><strong>{`${(timeScale * 28.4).toFixed(1)} 千米/秒`}</strong><i><b style={{ width: `${Math.max(8, timeScale / 4 * 100)}%` }} /></i></div></div>
    <ControlBar paused={paused} timeScale={timeScale} showOrbits={showOrbits} showLabels={showLabels} showGrid={showGrid} cameraEnabled={cameraEnabled} onPause={() => setPaused((v) => !v)} onReset={reset} onTime={setTimeScale} onOrbits={() => setShowOrbits((v) => !v)} onLabels={() => setShowLabels((v) => !v)} onGrid={() => setShowGrid((v) => !v)} onCamera={toggleCamera} onHelp={() => setLegendOpen((v) => !v)} />
    {legendOpen && <GestureLegend onClose={() => setLegendOpen(false)} />}
    {toast && <div className="toast"><RotateCcw size={14} /><span>{toast}</span></div>}
  </main>
}

export default App
