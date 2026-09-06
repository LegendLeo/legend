import type { GestureFrame, Handedness, HandInput, Landmark } from '../src/gestures/types.ts'
import type { GestureEngine } from '../src/gestures/GestureEngine.ts'

export type Pose = 'open' | 'fist' | 'point' | 'two-fingers' | 'pinch' | 'unknown'
export type FixtureHand = { landmarks: Landmark[]; worldLandmarks: Landmark[]; handedness: Handedness }
export type HandOptions = { x?: number; y?: number; scale?: number; rotation?: number; handedness?: Handedness; pinchGap?: number; worldRotation?: number }

export function makeHand(pose: Pose, options: HandOptions = {}): FixtureHand {
  const { x = 0.5, y = 0.62, scale = 0.14, rotation = 0, handedness = 'Right', pinchGap = 0.2, worldRotation = 0 } = options
  const points: Landmark[] = Array.from({ length: 21 }, () => ({ x: 0, y: 0, z: 0 }))
  points[1] = { x: -0.35, y: -0.25, z: 0 }
  points[2] = { x: -0.6, y: -0.45, z: 0 }
  points[3] = { x: -0.8, y: -0.6, z: 0 }
  points[4] = { x: -1, y: -0.72, z: 0 }
  const xs = [-0.45, -0.15, 0.17, 0.45]
  const ys = [-0.85, -1, -0.94, -0.76]
  for (let finger = 0; finger < 4; finger += 1) {
    const base = 5 + finger * 4
    const extended = pose === 'open' || pose === 'pinch' || (pose === 'point' && finger === 0) || (pose === 'two-fingers' && finger < 2) || (pose === 'unknown' && finger === 2)
    points[base] = { x: xs[finger], y: ys[finger], z: 0 }
    if (extended) {
      points[base + 1] = { x: xs[finger], y: ys[finger] - 0.42, z: 0 }
      points[base + 2] = { x: xs[finger], y: ys[finger] - 0.72, z: 0 }
      points[base + 3] = { x: xs[finger], y: ys[finger] - 0.96, z: 0 }
    } else {
      points[base + 1] = { x: xs[finger], y: ys[finger] - 0.23, z: -0.1 }
      points[base + 2] = { x: xs[finger], y: ys[finger] + 0.12, z: -0.22 }
      points[base + 3] = { x: xs[finger], y: ys[finger] + 0.37, z: -0.08 }
    }
  }
  if (pose === 'pinch') {
    const palmScale = (Math.hypot(points[9].x, points[9].y) + Math.hypot(points[5].x - points[17].x, points[5].y - points[17].y)) / 2
    points[4] = { ...points[8], x: points[8].x - pinchGap * palmScale }
  }
  if (pose === 'fist') points[4] = { ...points[8], x: points[8].x - 0.04 }
  const transform = (point: Landmark, scalar: number, theta: number, cx: number, cy: number): Landmark => ({
    x: cx + (point.x * Math.cos(theta) - point.y * Math.sin(theta)) * scalar,
    y: cy + (point.x * Math.sin(theta) + point.y * Math.cos(theta)) * scalar,
    z: point.z * scalar,
  })
  return {
    landmarks: points.map(point => transform(point, scale, rotation, x, y)),
    worldLandmarks: points.map(point => transform(point, 0.06, worldRotation || rotation, 0, 0)),
    handedness,
  }
}

export function input(...hands: FixtureHand[]): HandInput {
  return {
    landmarks: hands.map(hand => hand.landmarks),
    worldLandmarks: hands.map(hand => hand.worldLandmarks),
    handedness: hands.map(hand => [{ categoryName: hand.handedness, score: 0.99 }]),
  }
}

export function frames(engine: GestureEngine, hands: HandInput | ((time: number) => HandInput), start: number, duration: number, step = 33): GestureFrame[] {
  const result: GestureFrame[] = []
  for (let time = start; time <= start + duration; time += step) result.push(engine.update(typeof hands === 'function' ? hands(time) : hands, time))
  return result
}
