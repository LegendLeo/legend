import { Ref, RefObject, useImperativeHandle, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import * as THREE from 'three'
import { planets } from '../data'
import type { SceneControls } from '../gestures/types'

type Props = { apiRef: Ref<SceneControls>; bodies: Map<string, THREE.Group>; cursorRef: RefObject<HTMLDivElement>; onSelect: (id: string) => void }
type PointerState = { active: boolean; x: number; y: number; target: string; entered: number; selected: boolean; seen: number; anchor: { x: number; y: number } | null }
const MIN_DISTANCE = 3.2
const MAX_DISTANCE = 130
const DWELL_MS = 550
const BODY_SIZES = new Map([...planets.map((planet) => [planet.id, planet.size] as const), ['sun', 1.55]])

export const overviewScale = (width: number, height: number) => Math.max(1, Math.min(4, 1.6 * height / Math.max(1, width)))

export default function SceneController({ apiRef, bodies, cursorRef, onSelect }: Props) {
  const controls = useRef<OrbitControlsImpl>(null)
  const { camera, gl, size } = useThree()
  const followed = useRef<string | null>(null)
  const resetting = useRef(false)
  const zoomTarget = useRef<number | null>(null)
  const pointer = useRef<PointerState>({ active: false, x: 0.5, y: 0.5, target: '', entered: 0, selected: false, seen: 0, anchor: null })
  const lastTelemetry = useRef(0)
  const vectors = useMemo(() => ({ world: new THREE.Vector3(), projected: new THREE.Vector3(), depth: new THREE.Vector3(),
    target: new THREE.Vector3(), movement: new THREE.Vector3(), offset: new THREE.Vector3(),
    home: new THREE.Vector3(), sphere: new THREE.Spherical() }), [])

  const clearPointer = () => {
    pointer.current.active = false
    pointer.current.target = ''
    pointer.current.selected = false
    pointer.current.anchor = null
    if (cursorRef.current) cursorRef.current.style.display = 'none'
    gl.domElement.dataset.pointerTarget = ''
  }

  useImperativeHandle(apiRef, () => ({
    orbit(dx, dy) {
      if (!controls.current || !Number.isFinite(dx) || !Number.isFinite(dy)) return
      resetting.current = false
      const orbit = controls.current
      orbit.setAzimuthalAngle(orbit.getAzimuthalAngle() - THREE.MathUtils.clamp(dx, -0.15, 0.15) * 9)
      orbit.setPolarAngle(THREE.MathUtils.clamp(orbit.getPolarAngle() - THREE.MathUtils.clamp(dy, -0.15, 0.15) * 7, 0.12, Math.PI * 0.88))
    },
    zoom(delta) {
      if (!controls.current || !Number.isFinite(delta)) return
      resetting.current = false
      zoomTarget.current = THREE.MathUtils.clamp((zoomTarget.current ?? controls.current.getDistance()) * Math.exp(-delta * 4), MIN_DISTANCE, MAX_DISTANCE)
    },
    reset() { followed.current = null; zoomTarget.current = null; resetting.current = true; clearPointer() },
    focus(id) {
      if (!bodies.has(id)) return
      followed.current = id
      resetting.current = false
      zoomTarget.current = Math.max(4, (BODY_SIZES.get(id) ?? 1) * 5.2)
    },
    free() { followed.current = null; resetting.current = false; zoomTarget.current = null; clearPointer() },
    point(x, y) {
      if (!Number.isFinite(x) || !Number.isFinite(y)) return
      const point = pointer.current
      if (point.anchor && Math.hypot((x - point.anchor.x) * size.width, (y - point.anchor.y) * size.height) > 24) {
        point.anchor = null
        point.selected = false
        point.entered = performance.now()
      }
      Object.assign(pointer.current, { active: true, x: THREE.MathUtils.clamp(x, 0, 1), y: THREE.MathUtils.clamp(y, 0, 1), seen: performance.now() })
    },
    clearPointer,
  }), [bodies, camera, gl, size])

  useFrame((_, delta) => {
    const orbit = controls.current
    if (!orbit) return
    const blend = 1 - Math.exp(-Math.min(delta, 0.1) * 7)
    const now = performance.now()
    const { world, projected, depth, target, movement, offset, home, sphere } = vectors

    if (resetting.current) {
      home.set(0, 15, 26).multiplyScalar(overviewScale(size.width, size.height))
      orbit.target.lerp(target.set(0, 0, 0), blend)
      camera.position.lerp(home, blend)
      if (camera.position.distanceToSquared(home) < 0.0001 && orbit.target.lengthSq() < 0.0001) resetting.current = false
    } else {
      const body = followed.current ? bodies.get(followed.current) : null
      if (body) {
        body.getWorldPosition(target)
        movement.copy(target).sub(orbit.target).multiplyScalar(blend)
        orbit.target.add(movement)
        camera.position.add(movement)
      }
      if (zoomTarget.current !== null) {
        offset.copy(camera.position).sub(orbit.target)
        const distance = THREE.MathUtils.lerp(offset.length(), zoomTarget.current, blend)
        offset.setLength(distance)
        camera.position.copy(orbit.target).add(offset)
        if (Math.abs(distance - zoomTarget.current) < 0.005) zoomTarget.current = null
      }
    }
    orbit.update()
    camera.updateMatrixWorld()

    const point = pointer.current
    if (point.active && now - point.seen > 700) clearPointer()
    const captureTelemetry = now - lastTelemetry.current > 150
    const projectedBodies: Record<string, { x: number; y: number; radius: number; visible: boolean }> = {}
    let nearest = ''
    let nearestScore = Infinity

    if (point.active || (import.meta.env.DEV && captureTelemetry)) {
      for (const [id, body] of bodies) {
        body.getWorldPosition(world)
        projected.copy(world).project(camera)
        const visible = projected.z >= -1 && projected.z <= 1 && Math.abs(projected.x) <= 1 && Math.abs(projected.y) <= 1
        const x = (projected.x + 1) / 2
        const y = (1 - projected.y) / 2
        const fov = camera instanceof THREE.PerspectiveCamera ? camera.fov : 45
        const cameraDepth = Math.max(0.1, -depth.copy(world).applyMatrix4(camera.matrixWorldInverse).z)
        const radius = (BODY_SIZES.get(id) ?? 1) * size.height / (2 * Math.tan(THREE.MathUtils.degToRad(fov / 2)) * cameraDepth)
        if (import.meta.env.DEV && captureTelemetry) projectedBodies[id] = { x, y, radius, visible }
        if (!visible || !point.active) continue
        // Keep distant planets reachable without changing their visible size.
        const hitRadius = Math.max(24, radius * 1.25)
        const distance = Math.hypot((point.x - x) * size.width, (point.y - y) * size.height)
        const score = distance / hitRadius
        if (score <= 1 && score < nearestScore) { nearest = id; nearestScore = score }
      }
    }

    if (point.active) {
      if (point.target !== nearest) { point.target = nearest; point.entered = now; point.selected = false }
      const progress = nearest && !point.anchor ? Math.min(1, (now - point.entered) / DWELL_MS) : 0
      if (cursorRef.current) {
        const style = cursorRef.current.style
        style.display = 'block'
        style.left = `${point.x * 100}%`
        style.top = `${point.y * 100}%`
        style.borderColor = nearest ? '#f6c87c' : '#70d3c0'
        style.transform = `translate(-50%, -50%) scale(${1 + progress * 0.4})`
        style.boxShadow = nearest ? `0 0 0 ${Math.round(progress * 5)}px #f6c87c35` : 'none'
      }
      gl.domElement.dataset.pointerTarget = nearest
      if (nearest && progress >= 1 && !point.selected) {
        // Keep the latch while focus moves the scene underneath a stationary finger.
        point.selected = true
        point.anchor = { x: point.x, y: point.y }
        onSelect(nearest)
      }
    }

    if (captureTelemetry) {
      lastTelemetry.current = now
      sphere.setFromVector3(offset.copy(camera.position).sub(orbit.target))
      Object.assign(gl.domElement.dataset, {
        cameraDistance: sphere.radius.toFixed(3), azimuth: sphere.theta.toFixed(4), polar: sphere.phi.toFixed(4),
        focus: followed.current ?? '', targetX: orbit.target.x.toFixed(3), targetY: orbit.target.y.toFixed(3), targetZ: orbit.target.z.toFixed(3),
      })
      if (import.meta.env.DEV) gl.domElement.dataset.projectedPlanets = JSON.stringify(projectedBodies)
    }
  })

  return <OrbitControls ref={controls} makeDefault enablePan={false} minDistance={MIN_DISTANCE} maxDistance={MAX_DISTANCE}
    minPolarAngle={0.12} maxPolarAngle={Math.PI * 0.88} target={[0, 0, 0]} enableDamping dampingFactor={0.075}
    rotateSpeed={0.55} zoomSpeed={0.7} onStart={() => { resetting.current = false; zoomTarget.current = null; clearPointer() }} />
}
