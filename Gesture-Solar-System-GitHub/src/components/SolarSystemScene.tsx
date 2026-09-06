import { forwardRef, Ref, RefObject, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Stars, Sparkles, Html } from '@react-three/drei'
import * as THREE from 'three'
import { Planet, planets } from '../data'
import type { SceneControls } from '../gestures/types'
import SceneController, { overviewScale } from './SceneController'

type Props = { paused: boolean; timeScale: number; selected: string; showOrbits: boolean; showLabels: boolean; showGrid: boolean; onSelect: (id: string) => void }
type Registry = Map<string, THREE.Group>

function SceneHealth({ onFailure }: { onFailure: (error: Error) => void }) {
  const { gl, setFrameloop } = useThree()
  useEffect(() => {
    const stop = () => {
      setFrameloop('never')
      onFailure(new Error('三维渲染连接已中断，请点击重试以恢复太阳系。'))
    }
    const onContextLost = (event: Event) => {
      event.preventDefault()
      stop()
    }
    gl.domElement.addEventListener('webglcontextlost', onContextLost)
    if (gl.getContext().isContextLost()) stop()
    return () => gl.domElement.removeEventListener('webglcontextlost', onContextLost)
  }, [gl, onFailure, setFrameloop])
  return null
}

function OrbitLine({ radius, visible }: { radius: number; visible: boolean }) {
  const line = useMemo(() => {
    const points = Array.from({ length: 128 }, (_, i) => {
      const angle = i / 128 * Math.PI * 2
      return new THREE.Vector3(Math.cos(angle) * radius, 0, Math.sin(angle) * radius)
    })
    return new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(points), new THREE.LineBasicMaterial({ color: '#586477', transparent: true, opacity: 0.34 }))
  }, [radius])
  useEffect(() => () => { line.geometry.dispose(); (line.material as THREE.Material).dispose() }, [line])
  return <primitive object={line} visible={visible} />
}

function PlanetMesh({ planet, index, paused, timeScale, selected, showLabels, onSelect, bodies }: { planet: Planet; index: number; paused: boolean; timeScale: number; selected: boolean; showLabels: boolean; onSelect: (id: string) => void; bodies: Registry }) {
  const group = useRef<THREE.Group | null>(null)
  const mesh = useRef<THREE.Mesh>(null)
  const angle = useRef(index * 2.399963 + 0.6)
  const register = useCallback((node: THREE.Group | null) => {
    group.current = node
    if (node) bodies.set(planet.id, node)
    else bodies.delete(planet.id)
  }, [bodies, planet.id])
  useFrame((_, delta) => {
    if (!group.current || paused) return
    angle.current += Math.min(delta, 0.1) * planet.speed * timeScale * 0.16
    group.current.position.set(Math.cos(angle.current) * planet.orbit, 0, Math.sin(angle.current) * planet.orbit)
    if (mesh.current) mesh.current.rotation.y += Math.min(delta, 0.1) * 0.5 * timeScale
  })
  return <group ref={register} position={[Math.cos(angle.current) * planet.orbit, 0, Math.sin(angle.current) * planet.orbit]}>
    <mesh ref={mesh} onClick={(event) => { event.stopPropagation(); onSelect(planet.id) }} scale={selected ? 1.12 : 1}>
      <sphereGeometry args={[planet.size, 32, 32]} />
      <meshStandardMaterial color={planet.color} roughness={0.76} metalness={0.06} emissive={selected ? planet.accent : '#000000'} emissiveIntensity={selected ? 0.35 : 0} />
    </mesh>
    {planet.id === 'saturn' && <mesh rotation={[Math.PI / 2.7, 0.15, 0]} onClick={(event) => { event.stopPropagation(); onSelect(planet.id) }}><ringGeometry args={[planet.size * 1.34, planet.size * 2.15, 64]} /><meshStandardMaterial color="#d8bd8e" transparent opacity={0.72} side={THREE.DoubleSide} /></mesh>}
    {planet.id === 'earth' && <mesh position={[planet.size * 1.7, 0.08, 0]}><sphereGeometry args={[0.12, 16, 16]} /><meshStandardMaterial color="#b9c1c4" /></mesh>}
    {selected && <mesh scale={1.32}><sphereGeometry args={[planet.size, 24, 24]} /><meshBasicMaterial color={planet.accent} transparent opacity={0.22} side={THREE.BackSide} /></mesh>}
    {showLabels && <Html distanceFactor={12} position={[0, planet.size + 0.24, 0]} style={{ pointerEvents: 'none' }}><span className="planet-label">{planet.name}</span></Html>}
  </group>
}

function Sun({ bodies, selected, showLabels, onSelect }: { bodies: Registry; selected: boolean; showLabels: boolean; onSelect: (id: string) => void }) {
  const register = useCallback((node: THREE.Group | null) => { if (node) bodies.set('sun', node); else bodies.delete('sun') }, [bodies])
  return <group ref={register}>
    <mesh onClick={(event) => { event.stopPropagation(); onSelect('sun') }}><sphereGeometry args={[1.55, 40, 40]} /><meshStandardMaterial color="#f4a23a" emissive="#ef6f2d" emissiveIntensity={1.8} roughness={0.5} /></mesh>
    <pointLight color="#ffd29a" intensity={180} distance={80} decay={2} />
    <mesh scale={selected ? 1.27 : 1.17}><sphereGeometry args={[1.55, 32, 32]} /><meshBasicMaterial color="#f0a044" transparent opacity={selected ? 0.24 : 0.11} side={THREE.BackSide} /></mesh>
    {showLabels && <Html distanceFactor={12} position={[0, 2.1, 0]} style={{ pointerEvents: 'none' }}><span className="sun-label">太阳</span></Html>}
  </group>
}

function SceneContent({ paused, timeScale, selected, showOrbits, showLabels, showGrid, onSelect, apiRef, cursorRef }: Props & { apiRef: Ref<SceneControls>; cursorRef: RefObject<HTMLDivElement> }) {
  const bodies = useMemo<Registry>(() => new Map(), [])
  return <>
    <color attach="background" args={['#060a11']} />
    <fog attach="fog" args={['#060a11', 110, 240]} />
    <ambientLight intensity={0.2} />
    <Stars radius={110} depth={45} count={2400} factor={2.1} saturation={0.5} fade speed={0.35} />
    <Sparkles count={100} scale={[40, 12, 40]} size={1.2} speed={0.15} color="#7fa5a1" opacity={0.35} />
    <Sun bodies={bodies} selected={selected === 'sun'} showLabels={showLabels} onSelect={onSelect} />
    {planets.map((planet, index) => <group key={planet.id}><OrbitLine radius={planet.orbit} visible={showOrbits} /><PlanetMesh planet={planet} index={index} paused={paused} timeScale={timeScale} selected={selected === planet.id} showLabels={showLabels} onSelect={onSelect} bodies={bodies} /></group>)}
    <gridHelper args={[52, 52, '#263341', '#111923']} position={[0, -2.7, 0]} visible={showGrid} />
    <SceneController apiRef={apiRef} bodies={bodies} cursorRef={cursorRef} onSelect={onSelect} />
  </>
}

const SolarSystemScene = forwardRef<SceneControls, Props>(function SolarSystemScene(props, ref) {
  const cursor = useRef<HTMLDivElement>(null)
  const [failure, setFailure] = useState<Error | null>(null)
  if (failure) throw failure
  return <>
    <Canvas camera={{ position: [0, 15, 26], fov: 45, far: 320 }} dpr={[1, 1.7]} gl={{ antialias: true }} onCreated={({ camera, size }) => { camera.position.multiplyScalar(overviewScale(size.width, size.height)) }}>
      <SceneHealth onFailure={setFailure} />
      <SceneContent {...props} apiRef={ref} cursorRef={cursor} />
    </Canvas>
    <div ref={cursor} aria-hidden="true" style={{ display: 'none', position: 'absolute', width: 28, height: 28, border: '2px solid #70d3c0', borderRadius: '50%', pointerEvents: 'none', zIndex: 2, transform: 'translate(-50%, -50%)' }} />
  </>
})

export default SolarSystemScene
