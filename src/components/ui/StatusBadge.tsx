import { Status } from '@/lib/types'
import { STATUS_COLORS } from '@/lib/utils'
import { cn } from '@/lib/utils'

interface StatusBadgeProps {
  status: Status
  className?: string
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const colors = STATUS_COLORS[status]
  return (
    <span className={cn(
      'inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border',
      colors.bg, colors.text, colors.border,
      className
    )}>
      {status}
    </span>
  )
}
