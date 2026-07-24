import { Component, type ErrorInfo, type ReactNode } from 'react'
import { AppErrorPage } from './AppErrorPage'
import { isChunkLoadError } from '@/lib/deployment/chunk-recovery'

interface RootErrorBoundaryProps {
  children: ReactNode
}

interface RootErrorBoundaryState {
  error: Error | null
}

export class RootErrorBoundary extends Component<RootErrorBoundaryProps, RootErrorBoundaryState> {
  state: RootErrorBoundaryState = { error: null }

  static getDerivedStateFromError(error: Error): RootErrorBoundaryState {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    if (import.meta.env.DEV) {
      console.error('[root-error-boundary]', error, info.componentStack)
      return
    }

    const label = isChunkLoadError(error) ? 'chunk load failure' : error.message
    console.error('[root-error-boundary]', label)
  }

  private handleRetry = () => {
    this.setState({ error: null })
    window.location.reload()
  }

  render() {
    if (this.state.error) {
      return (
        <AppErrorPage
          technicalDetails={
            import.meta.env.DEV
              ? `${this.state.error.name}: ${this.state.error.message}`
              : undefined
          }
          onRetry={this.handleRetry}
        />
      )
    }

    return this.props.children
  }
}
