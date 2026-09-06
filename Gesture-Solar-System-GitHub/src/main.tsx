import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import ModuleBoundary from './components/ModuleBoundary'
import './styles.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ModuleBoundary label="太阳系工作台已暂停" hint="点击重试以重新打开观测台。若问题持续，请刷新页面。" className="app-failure"><App /></ModuleBoundary>
  </StrictMode>,
)
