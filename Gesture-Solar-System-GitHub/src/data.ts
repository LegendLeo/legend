import type { GestureKind } from './gestures/types'

export type Planet = {
  id: string
  name: string
  type: string
  color: string
  accent: string
  size: number
  orbit: number
  speed: number
  mass: string
  diameter: string
  year: string
  description: string
}

export const planets: Planet[] = [
  { id: 'mercury', name: '水星', type: '类地行星', color: '#a8a39c', accent: '#d5c8b6', size: 0.25, orbit: 3.2, speed: 1.7, mass: '3.30 × 10²³ 千克', diameter: '4,879 千米', year: '88 天', description: '太阳系中最小、距离太阳最近的行星。遍布陨石坑的表面记录着太阳系早期的历史。' },
  { id: 'venus', name: '金星', type: '类地行星', color: '#d39a60', accent: '#f0bd7c', size: 0.42, orbit: 4.6, speed: 1.25, mass: '4.87 × 10²⁴ 千克', diameter: '12,104 千米', year: '225 天', description: '被厚重云层包裹的行星，拥有浓密的二氧化碳大气，表面温度居太阳系行星之首。' },
  { id: 'earth', name: '地球', type: '类地行星', color: '#3c83aa', accent: '#54c3b2', size: 0.46, orbit: 6.1, speed: 1, mass: '5.97 × 10²⁴ 千克', diameter: '12,742 千米', year: '365.25 天', description: '我们的家园，拥有丰富的液态水和保护生命的大气层，也是目前唯一已知存在生命的星球。' },
  { id: 'mars', name: '火星', type: '类地行星', color: '#b55d45', accent: '#ed8762', size: 0.34, orbit: 7.7, speed: 0.8, mass: '6.42 × 10²³ 千克', diameter: '6,779 千米', year: '687 天', description: '覆盖着富铁尘土的红色行星，保留着古老河谷，并拥有太阳系中最大的火山。' },
  { id: 'jupiter', name: '木星', type: '气态巨行星', color: '#c18f67', accent: '#f1c698', size: 0.95, orbit: 10.2, speed: 0.43, mass: '1.90 × 10²⁷ 千克', diameter: '139,820 千米', year: '11.86 年', description: '拥有条纹云带和强大磁场的巨行星。比地球更大的大红斑风暴已持续数百年。' },
  { id: 'saturn', name: '土星', type: '气态巨行星', color: '#c6a875', accent: '#f2d7a3', size: 0.82, orbit: 13.2, speed: 0.32, mass: '5.68 × 10²⁶ 千克', diameter: '116,460 千米', year: '29.45 年', description: '淡金色的气态巨行星，周围环绕着由无数冰粒和碎片组成的壮丽星环。' },
  { id: 'uranus', name: '天王星', type: '冰巨行星', color: '#72b8ba', accent: '#a1e1d6', size: 0.62, orbit: 16.1, speed: 0.23, mass: '8.68 × 10²⁵ 千克', diameter: '50,724 千米', year: '84 年', description: '自转轴大幅倾斜的冰巨行星，仿佛侧躺着运行，因此经历极端的季节变化。' },
  { id: 'neptune', name: '海王星', type: '冰巨行星', color: '#477cb8', accent: '#77b6ee', size: 0.60, orbit: 19, speed: 0.18, mass: '1.02 × 10²⁶ 千克', diameter: '49,244 千米', year: '164.8 年', description: '拥有深蓝色外观的遥远行星，大气中活跃着剧烈风暴和速度可超过音速的强风。' },
]

export const sun: Planet = { id: 'sun', name: '太阳', type: '主序星', color: '#f4a23a', accent: '#f8ce77', size: 1.55, orbit: 0, speed: 0, mass: '1.99 × 10³⁰ 千克', diameter: '1,392,700 千米', year: '太阳系中心', description: '位于太阳系中心的恒星。它的引力维系着行星轨道，它的光与热滋养着地球上的生命。' }
export const celestialBodies = [...planets, sun]

export const gestures = [
  { icon: 'hand', label: '手掌张开并短暂停稳', action: '暂停 / 继续；保持同一手势只触发一次', shortcut: '空格' },
  { icon: 'grab', label: '握拳', action: '重置视角、时间倍率和选中状态', shortcut: 'R' },
  { icon: 'zoom', label: '拇指与食指捏合后张开', action: '拉近视角；缩小指间距离则拉远', shortcut: '' },
  { icon: 'point', label: '单指指向', action: '移动光标，停留在行星上以选中', shortcut: '' },
  { icon: 'horizontal', label: '张开手掌左右移动', action: '旋转视角', shortcut: '' },
  { icon: 'vertical', label: '张开手掌上下移动', action: '调整观察高度', shortcut: '' },
  { icon: 'hands', label: '双手张开后拉开 / 靠近', action: '加快 / 减慢时间流速', shortcut: '' },
  { icon: 'swipe', label: '单掌快速左右挥动', action: '切换上一颗 / 下一颗行星', shortcut: '' },
  { icon: 'orbit', label: '食指与中指同时伸出', action: '切换轨道、标签和辅助网格', shortcut: '' },
]

export const gestureLabels: Record<GestureKind, string> = {
  none: '未检测到手部', unknown: '正在校准', open: '张开手掌', fist: '握拳',
  pinch: '捏合缩放', point: '单指指向', 'two-fingers': '两指手势',
  'palm-move': '手掌移动', 'two-hands': '双手调速', swipe: '挥手切换',
}
