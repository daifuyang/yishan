import { StateView } from './StateView'

export interface ErrorStateProps {
  text?: string
  hint?: string
  onRetry?: () => void
}

export function ErrorState({ text = '加载失败', hint, onRetry }: ErrorStateProps) {
  return <StateView kind="error" text={text} hint={hint} onRetry={onRetry} />
}

export default ErrorState
