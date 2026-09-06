import assert from 'node:assert/strict'
import test from 'node:test'
import { GestureEngine } from '../src/gestures/GestureEngine.ts'
import { frames, input, makeHand } from './handFixtures.ts'
import type { Pose } from './handFixtures.ts'

test('classifies palm geometry independent of image rotation, scale, and handedness score', () => {
  for (const pose of ['open', 'fist', 'point', 'two-fingers', 'pinch'] as Pose[]) {
    for (const rotation of [0, Math.PI / 2, Math.PI, -0.8]) {
      for (const scale of [0.065, 0.14, 0.25]) {
        const engine = new GestureEngine()
        const data = input(makeHand(pose, { rotation, scale }))
        data.handedness![0][0].score = 0.03
        const frame = frames(engine, data, 0, 660).at(-1)!
        assert.equal(frame.hands[0].gesture, pose, `${pose}: rotation=${rotation}, scale=${scale}`)
        assert.equal(frame.phase, 'tracking')
        assert.ok(frame.confidence > 0.8)
      }
    }
  }
})

test('uses normalized landmarks when world landmarks are unavailable', () => {
  const engine = new GestureEngine()
  const data = input(makeHand('two-fingers', { rotation: 1.3 }))
  delete data.worldLandmarks
  assert.equal(frames(engine, data, 0, 600).at(-1)!.gesture, 'two-fingers')
})

test('nearby thumb/index in a fist reset once and never issue pinch zoom', () => {
  const engine = new GestureEngine()
  const commands = frames(engine, input(makeHand('fist')), 0, 4000).flatMap(frame => frame.commands)
  assert.deepEqual(commands, [{ type: 'reset' }])
})

test('a held open palm pauses once, survives brief dropout and pose jitter, and re-arms after release', () => {
  const engine = new GestureEngine()
  const palm = input(makeHand('open'))
  const commands = frames(engine, palm, 0, 2000).flatMap(frame => frame.commands)
  commands.push(...engine.update(input(), 2030).commands)
  commands.push(...frames(engine, palm, 2090, 1000).flatMap(frame => frame.commands))
  commands.push(...engine.update(input(makeHand('unknown')), 3120).commands)
  commands.push(...frames(engine, palm, 3150, 1000).flatMap(frame => frame.commands))
  assert.equal(commands.filter(command => command.type === 'togglePause').length, 1)
  frames(engine, input(makeHand('point')), 4200, 400)
  const next = frames(engine, palm, 4650, 700).flatMap(frame => frame.commands)
  assert.equal(next.filter(command => command.type === 'togglePause').length, 1)
})

test('moving open palm orbits both axes without later toggling pause', () => {
  const engine = new GestureEngine()
  const motion = frames(engine, time => input(makeHand('open', { x: 0.3 + time * 0.00012, y: 0.55 + time * 0.00007 })), 0, 1500)
  const rest = frames(engine, input(makeHand('open', { x: 0.48, y: 0.655 })), 1530, 900)
  const commands = [...motion, ...rest].flatMap(frame => frame.commands)
  assert.ok(commands.some(command => command.type === 'orbit' && command.dx < 0 && command.dy > 0))
  assert.equal(commands.filter(command => command.type === 'togglePause').length, 0)
})

test('stable pinch zoom uses gap deltas, hysteresis, and no entry jump', () => {
  const engine = new GestureEngine()
  const initial = frames(engine, input(makeHand('pinch', { pinchGap: 0.23 })), 0, 330)
  assert.equal(initial.flatMap(frame => frame.commands).length, 0)
  const spread = frames(engine, time => input(makeHand('pinch', { pinchGap: 0.23 + (time - 363) * 0.0005 })), 363, 440)
  assert.ok(spread.every(frame => frame.gesture === 'pinch'))
  assert.ok(spread.flatMap(frame => frame.commands).some(command => command.type === 'zoom' && command.delta > 0))
  const shrink = frames(engine, time => input(makeHand('pinch', { pinchGap: 0.43 - (time - 825) * 0.0005 })), 825, 330)
  assert.ok(shrink.flatMap(frame => frame.commands).some(command => command.type === 'zoom' && command.delta < 0))
})

test('point uses mirrored fingertip coordinates and clears pointer on loss', () => {
  const engine = new GestureEngine()
  const hand = makeHand('point', { x: 0.3 })
  const frame = frames(engine, input(hand), 0, 330).at(-1)!
  assert.deepEqual(frame.commands, [{ type: 'point', x: 1 - hand.landmarks[8].x, y: hand.landmarks[8].y }])
  assert.deepEqual(engine.update(input(), 370).commands, [{ type: 'clearPointer' }])
})

test('two-finger helper toggle is debounced and held once', () => {
  const engine = new GestureEngine()
  const commands = frames(engine, input(makeHand('two-fingers')), 0, 2500).flatMap(frame => frame.commands)
  assert.deepEqual(commands, [{ type: 'toggleHelpers' }])
})

test('both hands are tracked; symmetric separation changes time and suppresses pause', () => {
  const engine = new GestureEngine()
  const results = frames(engine, time => {
    const travel = Math.max(0, time - 330) * 0.0001
    return input(makeHand('open', { x: 0.36 - travel, handedness: 'Left' }), makeHand('open', { x: 0.64 + travel }))
  }, 0, 1500)
  assert.ok(results.every(frame => frame.hands.length === 2))
  assert.equal(results.at(-1)!.gesture, 'two-hands')
  const commands = results.flatMap(frame => frame.commands)
  assert.ok(commands.some(command => command.type === 'time' && command.delta > 0))
  assert.equal(commands.some(command => command.type === 'togglePause' || command.type === 'orbit'), false)
})

test('second hand alone can adjust time; reversing MediaPipe ordering preserves IDs and deltas', () => {
  const engine = new GestureEngine()
  const left = makeHand('open', { x: 0.3, handedness: 'Left' })
  const initial = frames(engine, input(left, makeHand('open', { x: 0.62 })), 0, 330).at(-1)!
  const ids = new Map(initial.hands.map(hand => [hand.handedness, hand.id]))
  const moving = frames(engine, time => {
    const right = makeHand('open', { x: 0.62 + (time - 363) * 0.0002 })
    return Math.round(time / 33) % 2 ? input(left, right) : input(right, left)
  }, 363, 660)
  for (const frame of moving) for (const hand of frame.hands) assert.equal(hand.id, ids.get(hand.handedness))
  const deltas = moving.flatMap(frame => frame.commands).filter(command => command.type === 'time')
  assert.ok(deltas.length > 10)
  assert.ok(deltas.every(command => command.delta >= 0 && command.delta <= 0.24))
})

test('translating two hands together does not change time speed', () => {
  const engine = new GestureEngine()
  const commands = frames(engine, time => {
    const dx = time * 0.00013
    const dy = time * 0.00003
    return input(makeHand('open', { x: 0.2 + dx, y: 0.6 + dy, handedness: 'Left' }), makeHand('open', { x: 0.58 + dx, y: 0.6 + dy }))
  }, 0, 1000).flatMap(frame => frame.commands)
  assert.deepEqual(commands, [])
})

test('hand disappearance and reentry recalibrate pair baseline without jumps or pause', () => {
  const engine = new GestureEngine()
  const left = makeHand('open', { x: 0.27, handedness: 'Left' })
  const right = makeHand('open', { x: 0.63 })
  frames(engine, input(left, right), 0, 660)
  const disappeared = frames(engine, input(left), 693, 330)
  const reentry = frames(engine, input(left, makeHand('open', { x: 0.82 })), 1056, 990)
  const commands = [...disappeared, ...reentry].flatMap(frame => frame.commands)
  assert.deepEqual(commands, [])
  assert.equal(reentry[0].phase, 'calibrating')
})

test('noisy handedness labels do not swap track identity', () => {
  const engine = new GestureEngine()
  const first = engine.update(input(makeHand('open', { x: 0.28, handedness: 'Left' }), makeHand('open', { x: 0.72 })), 0)
  const ids = first.hands.map(hand => hand.id)
  for (let time = 33; time < 800; time += 33) {
    const flip = time % 66 === 0
    const frame = engine.update(input(makeHand('open', { x: 0.28, handedness: flip ? 'Right' : 'Left' }), makeHand('open', { x: 0.72, handedness: flip ? 'Left' : 'Right' })), time)
    assert.deepEqual(frame.hands.map(hand => hand.id), ids)
  }
})

test('fast open-palm swipe cycles once until stationary re-arm', () => {
  const engine = new GestureEngine()
  frames(engine, input(makeHand('open', { x: 0.25 })), 0, 330)
  const swipe = frames(engine, time => input(makeHand('open', { x: 0.25 + (time - 363) * 0.0015 })), 363, 264)
  const rest = frames(engine, input(makeHand('open', { x: 0.646 })), 660, 700)
  const commands = [...swipe, ...rest].flatMap(frame => frame.commands)
  assert.equal(commands.filter(command => command.type === 'cycle').length, 1)
  assert.equal(commands.filter(command => command.type === 'togglePause').length, 0)
})

test('invalid landmarks yield calibration and no control commands', () => {
  const engine = new GestureEngine()
  for (const bad of [NaN, Infinity, 8]) {
    const hand = makeHand('open')
    hand.landmarks[8].x = bad
    const frame = engine.update(input(hand), 100)
    assert.equal(frame.phase, 'calibrating')
    assert.deepEqual(frame.commands, [])
  }
  const degenerate = makeHand('open')
  degenerate.landmarks = degenerate.landmarks.map(() => ({ x: 0.5, y: 0.5, z: 0 }))
  assert.equal(engine.update(input(degenerate), 200).phase, 'calibrating')
})

test('a corrupt second hand preserves valid overlays but suppresses single-hand commands', () => {
  const engine = new GestureEngine()
  const broken = makeHand('open', { x: 0.7 })
  broken.landmarks[9].x = NaN
  const results = frames(engine, input(makeHand('open', { x: 0.3 }), broken), 0, 1500)
  assert.ok(results.every(frame => frame.hands.length === 1 && frame.phase === 'calibrating'))
  assert.deepEqual(results.flatMap(frame => frame.commands), [])
})

test('alternating incompatible poses stays calibrating and never executes a discrete command', () => {
  const engine = new GestureEngine()
  const results = frames(engine, time => input(makeHand(Math.round(time / 33) % 2 ? 'open' : 'fist')), 0, 1800)
  assert.ok(results.every(frame => frame.phase === 'calibrating'))
  assert.deepEqual(results.flatMap(frame => frame.commands), [])
})

test('motion spikes suppress controls and restart calibration', () => {
  const engine = new GestureEngine()
  frames(engine, input(makeHand('open', { x: 0.28 })), 0, 330)
  const frame = engine.update(input(makeHand('open', { x: 0.62 })), 363)
  assert.equal(frame.phase, 'calibrating')
  assert.deepEqual(frame.commands, [])
})

test('5-7 Hz inference remains stable and fires a held palm once', () => {
  for (const step of [150, 200]) {
    const engine = new GestureEngine()
    const results = frames(engine, input(makeHand('open')), 0, 2400, step)
    assert.equal(results.at(-1)!.phase, 'tracking')
    assert.deepEqual(results.flatMap(frame => frame.commands), [{ type: 'togglePause' }])
  }
})

test('5-7 Hz two-hand inference calibrates once and responds to separation', () => {
  for (const step of [150, 200]) {
    const engine = new GestureEngine()
    const results = frames(engine, time => input(makeHand('open', { x: 0.28, handedness: 'Left' }), makeHand('open', { x: 0.6 + Math.max(0, time - 600) * 0.00015 })), 0, 2000, step)
    assert.equal(results.at(-1)!.phase, 'tracking')
    const commands = results.flatMap(frame => frame.commands)
    assert.ok(commands.some(command => command.type === 'time' && command.delta > 0))
    assert.ok(commands.every(command => command.type === 'time'))
  }
})

test('continuous slow CPU inference retains identities and allows palm hold commands', () => {
  for (const step of [700, 900]) {
    const engine = new GestureEngine()
    const results = frames(engine, input(makeHand('open')), 0, 4500, step)
    assert.equal(new Set(results.map(frame => frame.hands[0].id)).size, 1)
    assert.equal(results.at(-1)!.phase, 'tracking')
    assert.deepEqual(results.flatMap(frame => frame.commands), [{ type: 'togglePause' }])
  }
})

test('continuous slow CPU inference keeps dual hands active and responds to separation', () => {
  for (const step of [700, 900]) {
    const engine = new GestureEngine()
    const results = frames(engine, time => input(makeHand('open', { x: 0.28, handedness: 'Left' }), makeHand('open', { x: 0.55 + time * 0.00006 })), 0, 4500, step)
    assert.equal(new Set(results.flatMap(frame => frame.hands.map(hand => hand.id))).size, 2)
    assert.equal(results.at(-1)!.phase, 'tracking')
    const commands = results.flatMap(frame => frame.commands)
    assert.ok(commands.some(command => command.type === 'time' && command.delta > 0))
    assert.ok(commands.every(command => command.type === 'time'))
  }
})
