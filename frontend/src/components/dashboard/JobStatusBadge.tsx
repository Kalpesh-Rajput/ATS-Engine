import clsx from 'clsx'

const STATUS_MAP: Record<string, { label: string; classes: string }> = {
  pending:    { label: 'Pending',    classes: 'bg-slate-100 text-slate-600' },
  processing: { label: 'Processing', classes: 'bg-blue-50 text-blue-700 animate-pulse' },
  completed:  { label: 'Completed',  classes: 'bg-emerald-50 text-emerald-700' },
  partial:    { label: 'Partial',    classes: 'bg-amber-50 text-amber-700' },
  failed:     { label: 'Failed',     classes: 'bg-red-50 text-red-700' },
}

export default function JobStatusBadge({ status }: { status: string }) {
  const s = STATUS_MAP[status] ?? STATUS_MAP.pending
  return (
    <span className={clsx('inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium', s.classes)}>
      {s.label}
    </span>
  )
}
