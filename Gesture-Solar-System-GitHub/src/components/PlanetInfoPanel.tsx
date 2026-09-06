import { Crosshair, Orbit } from 'lucide-react'
import { celestialBodies, Planet } from '../data'

type Props = { planet: Planet; onFocus: () => void }

export default function PlanetInfoPanel({ planet, onFocus }: Props) {
  return <aside className="planet-panel" aria-label="天体资料">
    <div className="panel-kicker"><span className="accent-line" /><span>天体档案</span><span className="panel-index">{`${String(celestialBodies.findIndex((body) => body.id === planet.id) + 1).padStart(2, '0')} / 09`}</span></div>
    <div className="planet-title-row"><div><h1>{planet.name}</h1><p>{planet.type}</p></div><div className="planet-orb" style={{ background: `radial-gradient(circle at 32% 27%, ${planet.accent}, ${planet.color} 55%, #111923 100%)` }} /></div>
    <p className="planet-description">{planet.description}</p>
    <div className="data-grid"><div><span>质量</span><strong>{planet.mass}</strong></div><div><span>直径</span><strong>{planet.diameter}</strong></div><div><span>公转周期</span><strong>{planet.year}</strong></div><div><span>轨道半径</span><strong>{`${planet.orbit.toFixed(1)} 天文单位`}</strong></div></div>
    <button className="focus-button" onClick={onFocus} aria-label={`聚焦${planet.name}`} title={`聚焦${planet.name}`}><Crosshair size={15} /><span>{`聚焦${planet.name}`}</span></button>
    <div className="panel-footer"><Orbit size={14} /><span>轨道遥测</span><span className="pulse-label"><i /><span>实时</span></span></div>
  </aside>
}
