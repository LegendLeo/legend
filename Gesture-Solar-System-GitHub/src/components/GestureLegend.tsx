import { ArrowLeftRight, Grab, Hand, MoveHorizontal, MoveVertical, Orbit, Pointer, X, ZoomIn } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { gestures } from '../data'

const icons: Record<string, LucideIcon> = { hand: Hand, grab: Grab, zoom: ZoomIn, point: Pointer, horizontal: MoveHorizontal, vertical: MoveVertical, hands: MoveHorizontal, swipe: ArrowLeftRight, orbit: Orbit }

export default function GestureLegend({ onClose }: { onClose: () => void }) {
  return <div className="legend-drawer" role="dialog" aria-label="手势图谱"><div className="legend-head"><div><span className="eyebrow">交互手势</span><h2>手势图谱</h2></div><button className="icon-button" onClick={onClose} aria-label="关闭手势图谱" title="关闭手势图谱"><X size={17} /></button></div><div className="legend-list">{gestures.map((g) => { const Icon = icons[g.icon]; return <div className="legend-item" key={g.label}><span className="gesture-icon"><Icon size={19} /></span><div><strong>{g.label}</strong><small>{g.action}</small></div>{g.shortcut && <kbd>{g.shortcut}</kbd>}</div> })}</div><p className="legend-note">双手需完整进入画面。双掌同时张开时优先调速；手掌缓慢移动控制视角，快速挥动切换行星。单次动作释放手势后可再次触发。</p></div>
}
