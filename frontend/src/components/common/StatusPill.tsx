import { clsx } from 'clsx'

export type Status = 'pending' | 'processing' | 'completed' | 'failed' | 'partial'

interface StatusPillProps {
  status: Status
  size?: 'sm' | 'md'
}

const statusConfig: Record<Status, { label: string; variant: string; dot: string }> = {
  pending: {
    label: 'Pending',
    variant: 'bg-gray-100 text-gray-700',
    dot: 'bg-gray-400',
  },
  processing: {
    label: 'Processing',
    variant: 'bg-primary-50 text-primary-700',
    dot: 'bg-primary-500 animate-pulse',
  },
  completed: {
    label: 'Completed',
    variant: 'bg-success-50 text-success-700',
    dot: 'bg-success-500',
  },
  failed: {
    label: 'Failed',
    variant: 'bg-error-50 text-error-700',
    dot: 'bg-error-500',
  },
  partial: {
    label: 'Partial',
    variant: 'bg-warning-50 text-warning-700',
    dot: 'bg-warning-500',
  },
}

export function StatusPill({ status, size = 'md' }: StatusPillProps) {
  const config = statusConfig[status]

  return (
    <span
      className={clsx(
        'inline-flex items-center gap-2 rounded-full font-medium',
        config.variant,
        size === 'sm' ? 'px-2.5 py-1 text-xs' : 'px-3 py-1.5 text-sm',
        'transition-all duration-200'
      )}
    >
      <span
        className={clsx('w-2 h-2 rounded-full', config.dot)}
      />
      {config.label}
    </span>
  )
}
