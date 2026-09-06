import { forwardRef, useCallback, useEffect, useRef } from 'react'
import type { MutableRefObject } from 'react'
import { Crosshair, Hand, LoaderCircle, Pause, RotateCcw, Video, VideoOff, X } from 'lucide-react'
import type { GestureKind, TrackedHand } from '../gestures/types'
import { gestureLabels } from '../data'

type Props = {
  active: boolean; busy: boolean; status: string; confidence: number; gesture: GestureKind;
  hands: TrackedHand[]; issue: { title: string; hint: string; code: string } | null;
  onToggle: () => void; controlsEnabled: boolean; tracking: boolean;
  onControlsToggle: () => void; onCalibrate: () => void;
}
const connections = [[0, 1], [1, 2], [2, 3], [3, 4], [0, 5], [5, 6], [6, 7], [7, 8], [5, 9], [9, 10], [10, 11], [11, 12], [9, 13], [13, 14], [14, 15], [15, 16], [13, 17], [0, 17], [17, 18], [18, 19], [19, 20]]
const handColor = (hand: TrackedHand) => hand.handedness === 'Left' ? '#76dfcb' : hand.handedness === 'Right' ? '#ffb778' : '#dfdb9a'
const statusLabels: Record<string, string> = {
  'READY TO START': '准备就绪',
  'REQUESTING ACCESS': '正在申请权限',
  'LOADING MODEL': '正在加载模型',
  'SESSION STOPPED': '摄像头已停止',
  SEARCHING: '正在检测手部',
  CALIBRATING: '正在校准',
  'TRACKING 1 HAND': '正在跟踪单手',
  'TRACKING 2 HANDS': '正在跟踪双手',
}

const CameraPreview = forwardRef<HTMLVideoElement, Props>(function CameraPreview({ active, busy, status, confidence, gesture, hands, issue, onToggle, controlsEnabled, tracking, onControlsToggle, onCalibrate }, forwardedRef) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const localRef = useRef<HTMLVideoElement | null>(null)
  const handsRef = useRef(hands)
  handsRef.current = hands
  const setVideoRef = useCallback((node: HTMLVideoElement | null) => {
    localRef.current = node
    if (typeof forwardedRef === 'function') forwardedRef(node)
    else if (forwardedRef) (forwardedRef as MutableRefObject<HTMLVideoElement | null>).current = node
  }, [forwardedRef])
  useEffect(() => {
    const video = localRef.current
    const canvas = canvasRef.current
    if (!video || !canvas) return
    const ctx = canvas.getContext('2d')
    let raf = 0
    const draw = () => {
      if (active && video.videoWidth && video.videoHeight) {
        const pixelRatio = Math.min(window.devicePixelRatio || 1, 2)
        const width = Math.round(video.clientWidth * pixelRatio)
        const height = Math.round(video.clientHeight * pixelRatio)
        if (canvas.width !== width || canvas.height !== height) { canvas.width = width; canvas.height = height }
        if (ctx) {
          ctx.clearRect(0, 0, canvas.width, canvas.height)
          ctx.strokeStyle = 'rgba(111, 214, 194, .45)'
          ctx.lineWidth = 2
          const w = canvas.width; const h = canvas.height
          ctx.strokeRect(8, 8, w - 16, h - 16)
          // Match the video's object-fit: contain letterboxing and mirrored X coordinate.
          const scale = Math.min(w / video.videoWidth, h / video.videoHeight)
          const drawnWidth = video.videoWidth * scale; const drawnHeight = video.videoHeight * scale
          const offsetX = (w - drawnWidth) / 2; const offsetY = (h - drawnHeight) / 2
          for (const hand of handsRef.current) {
            const points = hand.landmarks
            ctx.strokeStyle = handColor(hand)
            ctx.fillStyle = handColor(hand)
            ctx.lineWidth = 1.3 * pixelRatio
            ctx.beginPath()
            for (const [from, to] of connections) {
              if (!points[from] || !points[to]) continue
              ctx.moveTo(offsetX + (1 - points[from].x) * drawnWidth, offsetY + points[from].y * drawnHeight)
              ctx.lineTo(offsetX + (1 - points[to].x) * drawnWidth, offsetY + points[to].y * drawnHeight)
            }
            ctx.stroke()
            for (const point of points) {
              ctx.beginPath()
              ctx.arc(offsetX + (1 - point.x) * drawnWidth, offsetY + point.y * drawnHeight, 2.2 * pixelRatio, 0, Math.PI * 2)
              ctx.fill()
            }
          }
        }
      } else ctx?.clearRect(0, 0, canvas.width, canvas.height)
      raf = requestAnimationFrame(draw)
    }
    draw()
    return () => cancelAnimationFrame(raf)
  }, [active])
  const actionLabel = issue ? '重试摄像头' : busy ? '取消开启摄像头' : active ? '暂停摄像头' : '开启摄像头'
  return <section className="camera-card" aria-label="摄像头与手势状态">
    <div className="camera-head">
      <div><span className={`live-dot ${active ? 'on' : ''}`} /> 摄像头画面</div>
      <button className="tiny-button" onClick={onToggle} aria-label={actionLabel} title={actionLabel}>
        {/* Stable element siblings survive text replacement by browser translators. */}
        <span className="camera-action-icon" aria-hidden="true">{issue ? <RotateCcw size={12} /> : busy ? <X size={12} /> : active ? <Pause size={12} /> : <Video size={12} />}</span>
        <span>{issue ? '重试' : busy ? '取消' : active ? '暂停' : '开启'}</span>
      </button>
    </div>
    <div className="camera-frame">
      <video ref={setVideoRef} autoPlay playsInline muted className={active ? '' : 'hidden-video'} />
      <canvas ref={canvasRef} className="camera-overlay" data-hand-count={hands.length} data-landmark-count={hands.reduce((count, hand) => count + hand.landmarks.length, 0)} />
      {!active && <div className="camera-placeholder"><span className="camera-glyph">{busy ? <LoaderCircle size={16} className="camera-spinner" /> : issue ? <VideoOff size={16} /> : <Video size={16} />}</span><span>{issue ? '摄像头已停止' : busy ? '正在申请摄像头权限' : '摄像头已暂停'}</span></div>}
      {active && <div className="camera-corner"><span /> <span /> <span /> <span /></div>}
    </div>
    {issue && <div className="camera-error" role="alert"><strong>{issue.title}</strong><p>{issue.hint}</p><code aria-label={`错误代码：${issue.code}`}>{issue.code}</code></div>}
    <div className="gesture-readout" data-gesture={gesture}><div><span className="eyebrow">手势 / 稳定度</span><strong>{!controlsEnabled ? '手势控制已暂停' : status === 'CALIBRATING' ? '正在校准' : gestureLabels[gesture]}</strong></div><div className="confidence" title="手势稳定度估计"><span>{`${Math.round(confidence * 100)}%`}</span><i><b style={{ width: `${confidence * 100}%` }} /></i></div></div>
    {hands.length > 0 && <div className="hand-readouts">{hands.map((hand, index) => <span key={hand.id} data-hand-id={hand.id} style={{ borderColor: handColor(hand), color: handColor(hand) }}>{`${hand.handedness === 'Left' ? '左手' : hand.handedness === 'Right' ? '右手' : `手部 ${index + 1}`} · ${gestureLabels[hand.gesture]}`}</span>)}</div>}
    <div className="camera-meta" role="status"><span>{hands.length === 0 ? '未检测到手部' : `已检测到 ${hands.length} 只手`}</span><span className="status-chip" data-status={status}>{statusLabels[status] ?? '准备就绪'}</span></div>
    <div className="gesture-tools"><button type="button" className={`icon-button ${controlsEnabled ? 'active' : ''}`} onClick={onControlsToggle} aria-pressed={controlsEnabled} aria-label="切换手势控制" title="暂停 / 启用手势控制"><Hand size={15} /></button><button type="button" className="icon-button" onClick={onCalibrate} disabled={!tracking} aria-label="重新校准手势" title="重新校准手势"><Crosshair size={15} /></button></div>
  </section>
})

export default CameraPreview
