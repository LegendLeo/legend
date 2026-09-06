import { Component, Fragment } from 'react'
import type { ErrorInfo, ReactNode } from 'react'
import { RotateCcw } from 'lucide-react'

type Props = {
  children: ReactNode
  label: string
  onFailure?: () => void
  onRetry?: () => void
  className?: string
  hint?: string
}
type State = { error: Error | null; attempt: number }

export default class ModuleBoundary extends Component<Props, State> {
  state: State = { error: null, attempt: 0 }

  static getDerivedStateFromError(error: unknown): Pick<State, 'error'> {
    return { error: error instanceof Error ? error : new Error(String(error)) }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(`${this.props.label} stopped`, error, info.componentStack)
    this.props.onFailure?.()
  }

  retry = () => {
    this.props.onRetry?.()
    this.setState(({ attempt }) => ({ error: null, attempt: attempt + 1 }))
  }

  render() {
    if (this.state.error) return <div className={`module-failure ${this.props.className ?? ''}`} role="alert">
      <strong>{this.props.label}</strong>
      <p>{this.props.hint ?? '请点击重试以恢复此视图；若问题仍然存在，请刷新页面。'}</p>
      <details><summary>错误详情</summary><p>{this.state.error.message}</p></details>
      <button type="button" className="icon-button" onClick={this.retry} aria-label={`重试：${this.props.label}`} title={`重试：${this.props.label}`}><RotateCcw size={17} /><span>重试</span></button>
    </div>
    return <Fragment key={this.state.attempt}>{this.props.children}</Fragment>
  }
}
