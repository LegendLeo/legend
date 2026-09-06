import { Gauge, Grid3X3, Hand, Keyboard, Orbit, Pause, Play, RotateCcw, Tag, Video, VideoOff } from 'lucide-react'

type Props = { paused: boolean; timeScale: number; showOrbits: boolean; showLabels: boolean; showGrid: boolean; cameraEnabled: boolean; onPause: () => void; onReset: () => void; onTime: (value: number) => void; onOrbits: () => void; onLabels: () => void; onGrid: () => void; onCamera: () => void; onHelp: () => void }

export default function ControlBar({ paused, timeScale, showOrbits, showLabels, showGrid, cameraEnabled, onPause, onReset, onTime, onOrbits, onLabels, onGrid, onCamera, onHelp }: Props) {
  return <footer className="control-bar">
    <div className="control-group primary"><button className="icon-button primary-action" onClick={onPause} aria-label={paused ? '继续公转' : '暂停公转'} title={paused ? '继续公转（空格）' : '暂停公转（空格）'}>{paused ? <Play size={16} fill="currentColor" /> : <Pause size={16} fill="currentColor" />}</button><button className="icon-button" onClick={onReset} aria-label="重置视角" title="重置视角（R）"><RotateCcw size={16} /></button></div>
    <div className="divider" />
    <div className="time-control"><Gauge size={15} /><span>时间倍率</span><input type="range" min="0" max="4" step="0.25" value={timeScale} onChange={(e) => onTime(Number(e.target.value))} aria-label="时间倍率" /><strong>{`${timeScale.toFixed(2)}×`}</strong></div>
    <div className="divider" />
    <div className="control-group"><button className={`toggle-button ${showOrbits ? 'active' : ''}`} onClick={onOrbits} aria-label="显示或隐藏轨道" aria-pressed={showOrbits} title="显示或隐藏轨道（L）"><Orbit size={15} /><span>轨道</span></button><button className={`toggle-button ${showLabels ? 'active' : ''}`} onClick={onLabels} aria-label="显示或隐藏标签" aria-pressed={showLabels} title="显示或隐藏标签"><Tag size={15} /><span>标签</span></button><button className={`toggle-button ${showGrid ? 'active' : ''}`} onClick={onGrid} aria-label="显示或隐藏网格" aria-pressed={showGrid} title="显示或隐藏网格"><Grid3X3 size={15} /><span>网格</span></button><button className={`toggle-button ${cameraEnabled ? 'active' : ''}`} onClick={onCamera} aria-label="开关摄像头" aria-pressed={cameraEnabled} title="开关摄像头"><span className="video-icon">{cameraEnabled ? <Video size={15} /> : <VideoOff size={15} />}</span><span>相机</span></button></div>
    <div className="control-spacer" /><button className="help-button" onClick={onHelp} aria-label="打开手势图谱" title="手势图谱（H）"><Hand size={16} /><span>手势图谱</span><Keyboard size={13} /></button>
  </footer>
}
