export type Landmark = { x: number; y: number; z: number }
export type Handedness = 'Left' | 'Right' | 'Unknown'
export type GestureKind = 'none' | 'open' | 'fist' | 'pinch' | 'point' | 'two-fingers' | 'palm-move' | 'two-hands' | 'swipe' | 'unknown'

export type HandInput = {
  landmarks: Landmark[][]
  worldLandmarks?: Landmark[][]
  handedness?: Array<Array<{ categoryName: string; score: number }>>
}

export type TrackedHand = {
  id: string
  handedness: Handedness
  landmarks: Landmark[]
  gesture: GestureKind
  confidence: number
}

// Screen coordinates are normalized to the mirrored preview, with the origin at top-left.
export type GestureCommand =
  | { type: 'togglePause' }
  | { type: 'reset' }
  | { type: 'toggleHelpers' }
  | { type: 'orbit'; dx: number; dy: number }
  | { type: 'zoom'; delta: number }
  | { type: 'time'; delta: number }
  | { type: 'point'; x: number; y: number }
  | { type: 'clearPointer' }
  | { type: 'cycle'; direction: 1 | -1 }

export type GestureFrame = {
  hands: TrackedHand[]
  gesture: GestureKind
  phase: 'searching' | 'calibrating' | 'tracking'
  confidence: number
  commands: GestureCommand[]
}

export type SceneControls = {
  orbit: (dx: number, dy: number) => void
  zoom: (delta: number) => void
  reset: () => void
  focus: (id: string) => void
  free: () => void
  point: (x: number, y: number) => void
  clearPointer: () => void
}
