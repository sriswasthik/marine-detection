import { Component, type ErrorInfo, type ReactNode } from 'react'
import { cn } from '@/lib/cn'
import { toAppError, type AppError } from '@/lib/errors/appError'
import { PANEL_ERROR_COPY } from '@/lib/errors/errorCopy'
import { ErrorState } from './ErrorState'

export interface ErrorBoundaryProps {
  children: ReactNode
  /** Names the panel in the fallback, for example "The evidence viewer". */
  label?: string
  /** Custom fallback. Receives the normalised error and a reset that re-renders the children. */
  fallback?: (error: AppError, reset: () => void) => ReactNode
  /** When any of these change, a failed panel tries again on its own (a new observation, say). */
  resetKeys?: readonly unknown[]
  /** Keeps the panel's footprint, so the page around it does not move. */
  className?: string
  onError?: (error: unknown, info: ErrorInfo) => void
}

interface ErrorBoundaryState {
  error: AppError | null
  keys: readonly unknown[]
}

const sameKeys = (a: readonly unknown[], b: readonly unknown[]) =>
  a.length === b.length && a.every((value, index) => Object.is(value, b[index]))

/**
 * Component-level boundary: one broken panel shows a compact error with "Try again" while the rest
 * of the page keeps working. Route-level failures are caught by RouteErrorBoundary.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  override state: ErrorBoundaryState = { error: null, keys: this.props.resetKeys ?? [] }

  static getDerivedStateFromError(error: unknown): Partial<ErrorBoundaryState> {
    return { error: toAppError(error) }
  }

  static getDerivedStateFromProps(
    props: ErrorBoundaryProps,
    state: ErrorBoundaryState,
  ): Partial<ErrorBoundaryState> | null {
    const keys = props.resetKeys ?? []
    if (sameKeys(keys, state.keys)) return null
    return { keys, error: null }
  }

  override componentDidCatch(error: unknown, info: ErrorInfo) {
    this.props.onError?.(error, info)
  }

  reset = () => this.setState({ error: null })

  override render() {
    const { error } = this.state
    if (!error) return this.props.children
    if (this.props.fallback) return this.props.fallback(error, this.reset)
    return (
      <div
        className={cn(
          'flex items-center justify-center rounded-card border border-dashed border-border-strong bg-surface',
          this.props.className,
        )}
      >
        <ErrorState
          size="sm"
          headingLevel={3}
          title={PANEL_ERROR_COPY.title(this.props.label)}
          description={PANEL_ERROR_COPY.message}
          details={error.code}
          onRetry={this.reset}
        />
      </div>
    )
  }
}
