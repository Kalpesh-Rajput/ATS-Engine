import { Button } from './Button'
import { clsx } from 'clsx'

interface EmptyStateProps {
  icon: React.ReactNode
  title: string
  description?: string
  action?: {
    label: string
    onClick: () => void
    variant?: 'primary' | 'secondary'
  }
  className?: string
}

export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div
      className={clsx(
        'flex flex-col items-center justify-center text-center p-12',
        'bg-white rounded-2xl border border-gray-200',
        className
      )}
    >
      <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center text-gray-400 mb-4">
        {icon}
      </div>
      <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
      {description && <p className="text-sm text-gray-500 mt-2 max-w-sm">{description}</p>}
      {action && (
        <Button
          onClick={action.onClick}
          variant={action.variant}
          className="mt-6"
        >
          {action.label}
        </Button>
      )}
    </div>
  )
}
