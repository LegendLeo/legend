import { useCallback, useEffect, useRef, useState } from 'react'
import type { HandLandmarkerResult } from '@mediapipe/tasks-vision'
import CameraPreview from './CameraPreview'
import { useCameraSession } from './useCameraSession'
import { GestureEngine } from '../gestures/GestureEngine'
import type { GestureCommand, GestureFrame } from '../gestures/types'

type Props = { enabled: boolean; onToggle: () => void; onCommand: (command: GestureCommand) => void }
const emptyFrame = (): GestureFrame => ({ hands: [], gesture: 'none', phase: 'searching', confidence: 0, commands: [] })

export default function GestureTracker({ enabled, onToggle, onCommand }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [engine] = useState(() => new GestureEngine())
  const commandRef = useRef(onCommand)
  commandRef.current = onCommand
  const [attempt, setAttempt] = useState(0)
  const [controlsEnabled, setControlsEnabled] = useState(true)
  const controlsEnabledRef = useRef(controlsEnabled)
  controlsEnabledRef.current = controlsEnabled
  const [frame, setFrame] = useState<GestureFrame>(emptyFrame)

  const classify = useCallback((result: HandLandmarkerResult) => {
    const next = engine.update(result, performance.now())
    setFrame(next)
    if (controlsEnabledRef.current) next.commands.forEach((command) => commandRef.current(command))
  }, [engine])

  const { phase, issue } = useCameraSession(videoRef, enabled, attempt, classify)
  useEffect(() => {
    if (phase !== 'tracking') {
      engine.reset()
      setFrame(emptyFrame())
      commandRef.current({ type: 'clearPointer' })
    }
  }, [phase, engine])

  const recalibrate = () => {
    engine.reset()
    setFrame((previous) => ({ ...previous, gesture: 'unknown', phase: 'calibrating', confidence: 0, commands: [] }))
    commandRef.current({ type: 'clearPointer' })
  }
  const toggleControls = () => {
    controlsEnabledRef.current = !controlsEnabled
    setControlsEnabled(!controlsEnabled)
    recalibrate()
  }
  const active = phase === 'loading' || phase === 'tracking'
  const busy = phase === 'requesting' || phase === 'loading'
  const status = phase === 'idle' ? 'READY TO START'
    : phase === 'requesting' ? 'REQUESTING ACCESS'
    : phase === 'loading' ? 'LOADING MODEL'
    : phase === 'error' ? 'SESSION STOPPED'
    : frame.phase === 'searching' ? 'SEARCHING'
    : frame.phase === 'calibrating' ? 'CALIBRATING'
    : frame.hands.length === 2 ? 'TRACKING 2 HANDS' : 'TRACKING 1 HAND'
  const handleCamera = () => {
    if (phase === 'error' && enabled) setAttempt((value) => value + 1)
    else onToggle()
  }
  return <CameraPreview
    ref={videoRef} active={active} busy={busy} status={status}
    confidence={frame.confidence} gesture={frame.gesture} hands={frame.hands}
    issue={issue} onToggle={handleCamera} controlsEnabled={controlsEnabled}
    onControlsToggle={toggleControls} onCalibrate={recalibrate} tracking={phase === 'tracking'}
  />
}
