import type { GestureCommand, GestureFrame, GestureKind, Handedness, HandInput, Landmark, TrackedHand } from './types'

const CONTINUOUS_MS = 180
const COMMAND_MS = 550
const RELEASE_MS = 280
const RETAIN_MS = 2400
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))
const distance = (a: Landmark, b: Landmark) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z)
const screenDistance = (a: Landmark, b: Landmark) => Math.hypot(a.x - b.x, a.y - b.y)
const palmCenter = (points: Landmark[]): Landmark => ({
  x: (points[0].x + points[5].x + points[9].x + points[17].x) / 4,
  y: (points[0].y + points[5].y + points[9].y + points[17].y) / 4,
  z: (points[0].z + points[5].z + points[9].z + points[17].z) / 4,
})
const palmSize = (points: Landmark[]) => (distance(points[0], points[9]) + distance(points[5], points[17])) / 2
const finiteHand = (points: Landmark[] | undefined): points is Landmark[] => Boolean(points?.length === 21 && points.every(p => Number.isFinite(p.x) && Number.isFinite(p.y) && Number.isFinite(p.z)))

function angle(a: Landmark, b: Landmark, c: Landmark) {
  const length = distance(a, b) * distance(c, b)
  if (length < 1e-9) return 0
  const dot = (a.x - b.x) * (c.x - b.x) + (a.y - b.y) * (c.y - b.y) + (a.z - b.z) * (c.z - b.z)
  return Math.acos(clamp(dot / length, -1, 1)) * 180 / Math.PI
}

type Observation = {
  landmarks: Landmark[]
  handedness: Handedness
  center: Landmark
  metric: Landmark[]
}

type Track = {
  id: string
  handedness: Handedness
  handednessVote: number
  lastSeen: number
  center: Landmark
  rawCenter: Landmark
  candidate: GestureKind
  candidateSince: number
  poseQuality: number
  fired: Set<GestureKind>
  pinchRatio: number
  pinchActive: boolean
  openAnchor: Landmark
  openMoved: boolean
  history: Array<{ x: number; y: number; time: number }>
  swipeArmed: boolean
  lastSwipe: number
  stillSince: number
}

type CurrentHand = { track: Track; observation: Observation; dx: number; dy: number; pinchDelta: number; reacquired: boolean }

function classify(points: Landmark[], wasPinching: boolean) {
  const scale = palmSize(points)
  const fingers = [5, 9, 13, 17].map(base => {
    const pip = angle(points[base], points[base + 1], points[base + 2])
    const dip = angle(points[base + 1], points[base + 2], points[base + 3])
    const reach = distance(points[base + 3], points[0]) / Math.max(distance(points[base + 1], points[0]), 1e-6)
    const extensionMargin = Math.min(clamp((pip - 145) / 25, 0, 1), clamp((dip - 135) / 35, 0, 1), clamp((reach - 1.08) / 0.25, 0, 1))
    const curlMargin = Math.max(clamp((125 - pip) / 45, 0, 1), clamp((1.02 - reach) / 0.35, 0, 1))
    return { pip, dip, reach, extensionMargin, curlMargin, extended: pip > 145 && dip > 135 && reach > 1.08, curled: pip < 125 || reach < 1.02 }
  })
  const extended = fingers.filter(f => f.extended).length
  const curled = fingers.filter(f => f.curled).length
  const pinchRatio = distance(points[4], points[8]) / Math.max(scale, 1e-6)
  // A folded index beside the thumb is a fist, even when their tips touch.
  const pinchShape = (fingers[0].pip > 105 && fingers[0].reach > 1.02) || extended >= 2
  let gesture: GestureKind = 'unknown'
  let quality = 0.35
  const marginQuality = (margins: number[]) => 0.65 + 0.3 * margins.reduce((sum, value) => sum + value, 0) / margins.length
  if (curled === 4 && !pinchShape) { gesture = 'fist'; quality = marginQuality(fingers.map(f => f.curlMargin)) }
  else if (pinchShape && pinchRatio < (wasPinching ? 0.5 : 0.34)) { gesture = 'pinch'; quality = 0.7 + 0.25 * clamp(1 - pinchRatio / 0.55, 0, 1) }
  else if (extended === 4) { gesture = 'open'; quality = marginQuality(fingers.map(f => f.extensionMargin)) }
  else if (fingers[0].extended && fingers[1].extended && fingers[2].curled && fingers[3].curled) { gesture = 'two-fingers'; quality = marginQuality(fingers.map((f, index) => index < 2 ? f.extensionMargin : f.curlMargin)) }
  else if (fingers[0].extended && fingers.slice(1).every(f => f.curled)) { gesture = 'point'; quality = marginQuality(fingers.map((f, index) => index === 0 ? f.extensionMargin : f.curlMargin)) }
  else if (curled === 4) { gesture = 'fist'; quality = marginQuality(fingers.map(f => f.curlMargin)) }
  return { gesture, quality, pinchRatio }
}

export class GestureEngine {
  private tracks: Track[] = []
  private nextId = 1
  private modeKey = ''
  private modeSince = 0
  private pairSeparation = 0
  private pointerActive = false
  private previousTime = -1
  private previousIds = new Set<string>()

  reset() {
    this.tracks = []
    this.nextId = 1
    this.modeKey = ''
    this.modeSince = 0
    this.pairSeparation = 0
    this.pointerActive = false
    this.previousTime = -1
    this.previousIds.clear()
  }

  update(input: HandInput, now: number): GestureFrame {
    if (!Number.isFinite(now)) return this.emptyFrame('calibrating')
    if (now < this.previousTime) this.reset()
    this.previousTime = now
    const observations: Observation[] = []
    for (let index = 0; index < Math.min(input.landmarks.length, 2); index += 1) {
      const landmarks = input.landmarks[index]
      if (!finiteHand(landmarks) || landmarks.some(p => Math.abs(p.x) > 2 || Math.abs(p.y) > 2 || Math.abs(p.z) > 2)) continue
      const size = palmSize(landmarks)
      if (size < 0.015 || size > 0.9) continue
      const world = input.worldLandmarks?.[index]
      const metric = finiteHand(world) && palmSize(world) > 0.005 && palmSize(world) < 0.5 ? world : landmarks
      if ([5, 9, 13, 17].some(base => distance(metric[base], metric[base + 1]) < palmSize(metric) * 0.04)) continue
      const category = input.handedness?.[index]?.[0]?.categoryName
      observations.push({ landmarks, center: palmCenter(landmarks), metric, handedness: category === 'Left' || category === 'Right' ? category : 'Unknown' })
    }
    this.tracks = this.tracks.filter(track => now - track.lastSeen < RETAIN_MS)
    if (!observations.length) {
      this.modeKey = ''
      this.previousIds.clear()
      return this.emptyFrame(input.landmarks.length ? 'calibrating' : 'searching')
    }

    const assigned = this.assign(observations)
    const current = observations.map((observation, index) => this.updateTrack(assigned[index] ?? this.createTrack(observation, now), observation, now))
    this.previousIds = new Set(current.map(hand => hand.track.id))
    const pair = current.length === 2 && current.every(hand => hand.track.candidate === 'open')
    const key = `${pair ? 'pair' : 'single'}:${current.map(hand => hand.track.id).sort().join(',')}`
    const topologyChanged = key !== this.modeKey || current.some(hand => hand.reacquired)
    if (topologyChanged) { this.modeKey = key; this.modeSince = now }

    const commands: GestureCommand[] = []
    const completeFrame = observations.length === Math.min(input.landmarks.length, 2)
    const stableTopology = completeFrame && now - this.modeSince >= CONTINUOUS_MS
    const hands: TrackedHand[] = current.map(({ track, observation }) => ({
      id: track.id,
      handedness: track.handedness,
      landmarks: observation.landmarks,
      gesture: track.candidate,
      // MediaPipe's category score measures left/right certainty, not gesture accuracy.
      confidence: track.poseQuality * (0.45 + 0.55 * clamp((now - track.candidateSince) / COMMAND_MS, 0, 1)),
    }))
    let gesture: GestureKind = 'unknown'
    let tracking = false

    if (pair) {
      const separation = screenDistance(current[0].track.center, current[1].track.center)
      const prior = this.pairSeparation
      this.pairSeparation = separation
      current.forEach(({ track }) => { track.fired.add('open'); track.openMoved = true })
      gesture = 'two-hands'
      tracking = stableTopology && current.every(hand => now - hand.track.candidateSince >= CONTINUOUS_MS)
      if (tracking && !topologyChanged && Math.abs(separation - prior) < 0.2) {
        const delta = clamp((separation - prior) * 4, -0.24, 0.24)
        if (Math.abs(delta) > 0.0015) commands.push({ type: 'time', delta })
      }
    } else {
      // Keep the same primary hand when MediaPipe changes result ordering.
      const primary = [...current].sort((a, b) => Number(a.track.id.slice(5)) - Number(b.track.id.slice(5)))[0]
      const { track, observation, dx, dy, pinchDelta } = primary
      gesture = track.candidate
      const stable = now - track.candidateSince >= CONTINUOUS_MS
      tracking = stableTopology && stable && gesture !== 'unknown'
      if (tracking) {
        if (gesture === 'open') {
          const historyStart = track.history[0]
          const elapsed = historyStart ? (now - historyStart.time) / 1000 : 0
          const travelX = historyStart ? track.center.x - historyStart.x : 0
          const travelY = historyStart ? track.center.y - historyStart.y : 0
          if (track.swipeArmed && elapsed >= 0.07 && elapsed <= 0.3 && Math.abs(travelX) > 0.13 && Math.abs(travelY) < 0.09 && Math.abs(travelX) / elapsed > 0.65) {
            commands.push({ type: 'cycle', direction: travelX < 0 ? 1 : -1 })
            track.swipeArmed = false
            track.lastSwipe = now
            track.openMoved = true
            track.fired.add('open')
            gesture = 'swipe'
          } else if (track.openMoved) {
            gesture = 'palm-move'
            if (Math.abs(dx) + Math.abs(dy) > 0.0008) commands.push({ type: 'orbit', dx: clamp(-dx, -0.06, 0.06), dy: clamp(dy, -0.06, 0.06) })
          } else if (now - track.candidateSince >= COMMAND_MS && !track.fired.has('open')) {
            commands.push({ type: 'togglePause' })
            track.fired.add('open')
          }
        } else if (gesture === 'fist' || gesture === 'two-fingers') {
          if (now - track.candidateSince >= COMMAND_MS && !track.fired.has(gesture)) {
            commands.push({ type: gesture === 'fist' ? 'reset' : 'toggleHelpers' })
            track.fired.add(gesture)
          }
        } else if (gesture === 'pinch') {
          // Positive gap change means zoom in; normalize by palm size for depth invariance.
          const delta = clamp(pinchDelta * 0.9, -0.12, 0.12)
          if (Math.abs(delta) > 0.001) commands.push({ type: 'zoom', delta })
        } else if (gesture === 'point') {
          commands.push({ type: 'point', x: clamp(1 - observation.landmarks[8].x, 0, 1), y: clamp(observation.landmarks[8].y, 0, 1) })
          this.pointerActive = true
        }
      }
    }
    if ((!tracking || gesture !== 'point') && this.pointerActive) { commands.push({ type: 'clearPointer' }); this.pointerActive = false }
    return { hands, gesture, phase: tracking ? 'tracking' : 'calibrating', confidence: Math.min(...hands.map(hand => hand.confidence)), commands }
  }

  private emptyFrame(phase: GestureFrame['phase']): GestureFrame {
    const commands: GestureCommand[] = this.pointerActive ? [{ type: 'clearPointer' }] : []
    this.pointerActive = false
    return { hands: [], gesture: 'none', phase, confidence: 0, commands }
  }

  private assign(observations: Observation[]): Array<Track | undefined> {
    // Two hands permit a tiny exhaustive assignment; distance outweighs noisy labels.
    let bestCost = Infinity
    let best: Array<Track | undefined> = []
    const search = (index: number, used: Set<string>, result: Array<Track | undefined>, cost: number) => {
      if (index === observations.length) {
        if (cost < bestCost) { bestCost = cost; best = result }
        return
      }
      const observation = observations[index]
      search(index + 1, used, [...result, undefined], cost + 0.42)
      for (const track of this.tracks) {
        if (used.has(track.id)) continue
        const movement = screenDistance(track.rawCenter, observation.center)
        if (movement > 0.4) continue
        const mismatch = observation.handedness !== 'Unknown' && track.handedness !== 'Unknown' && observation.handedness !== track.handedness ? 0.025 : 0
        search(index + 1, new Set([...used, track.id]), [...result, track], cost + movement + mismatch)
      }
    }
    search(0, new Set(), [], 0)
    return best
  }

  private createTrack(observation: Observation, now: number): Track {
    const track: Track = {
      id: `hand-${this.nextId++}`, handedness: observation.handedness,
      handednessVote: observation.handedness === 'Right' ? 4 : observation.handedness === 'Left' ? -4 : 0,
      lastSeen: now, center: observation.center, rawCenter: observation.center,
      candidate: 'none', candidateSince: now, poseQuality: 0, fired: new Set(), pinchRatio: 0,
      pinchActive: false, openAnchor: observation.center, openMoved: false,
      history: [], swipeArmed: true, lastSwipe: -Infinity, stillSince: now,
    }
    this.tracks.push(track)
    return track
  }

  private updateTrack(track: Track, observation: Observation, now: number): CurrentHand {
    const dt = now - track.lastSeen
    // A slow detector is still continuous tracking; reacquire after a missing result or a stall.
    const reacquired = !this.previousIds.has(track.id) || dt > 2000 || screenDistance(track.rawCenter, observation.center) > 0.22
    const previous = track.center
    const alpha = reacquired ? 1 : clamp(1 - Math.exp(-Math.max(dt, 16) / 45), 0.2, 1)
    track.center = { x: previous.x + (observation.center.x - previous.x) * alpha, y: previous.y + (observation.center.y - previous.y) * alpha, z: observation.center.z }
    const dx = reacquired ? 0 : track.center.x - previous.x
    const dy = reacquired ? 0 : track.center.y - previous.y
    track.rawCenter = observation.center
    track.lastSeen = now
    if (observation.handedness !== 'Unknown') {
      track.handednessVote = clamp(track.handednessVote + (observation.handedness === 'Right' ? 1 : -1), -8, 8)
      if (Math.abs(track.handednessVote) >= 3) track.handedness = track.handednessVote > 0 ? 'Right' : 'Left'
    }
    const classification = classify(observation.metric, track.pinchActive)
    const changed = classification.gesture !== track.candidate
    if (changed || reacquired) {
      track.candidate = classification.gesture
      track.candidateSince = now
      track.openAnchor = track.center
      track.openMoved = false
      track.history = []
    }
    if (now - track.candidateSince >= RELEASE_MS) {
      for (const fired of track.fired) if (fired !== track.candidate) track.fired.delete(fired)
    }
    const pinchDelta = changed || reacquired || Math.abs(classification.pinchRatio - track.pinchRatio) > 0.25 ? 0 : classification.pinchRatio - track.pinchRatio
    track.pinchRatio = classification.pinchRatio
    track.pinchActive = classification.gesture === 'pinch'
    track.poseQuality = classification.quality
    if (classification.gesture === 'open') {
      if (screenDistance(track.center, track.openAnchor) > 0.018) track.openMoved = true
      track.history.push({ x: track.center.x, y: track.center.y, time: now })
      track.history = track.history.filter(entry => now - entry.time <= 260)
      if (Math.hypot(dx, dy) / Math.max(dt / 1000, 0.016) > 0.12) track.stillSince = now
      if (!track.swipeArmed && now - track.stillSince > 400 && now - track.lastSwipe > 700) track.swipeArmed = true
    }
    return { track, observation, dx, dy, pinchDelta, reacquired }
  }
}
