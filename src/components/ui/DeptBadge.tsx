interface DeptBadgeProps {
  dept: string
  className?: string
}

const DEPT_STYLE: Record<string, { bg: string; border: string; text: string }> = {
  'PM':     { bg: '#dae9f8', border: '#aed0ef', text: '#1d4ed8' },
  'BE':     { bg: '#fbe2d5', border: '#f5c4a8', text: '#c2410c' },
  'FE':     { bg: '#daf2d0', border: '#ade59a', text: '#15803d' },
  'UXD':    { bg: '#f2ceef', border: '#e4a0df', text: '#a21caf' },
  'Design': { bg: '#f2ceef', border: '#e4a0df', text: '#a21caf' },
  'Oth':    { bg: '#d9d9d9', border: '#b8b8b8', text: '#374151' },
}
const DEPT_DEFAULT = { bg: '#d9d9d9', border: '#b8b8b8', text: '#374151' }

export function DeptBadge({ dept, className }: DeptBadgeProps) {
  const s = DEPT_STYLE[dept] ?? DEPT_DEFAULT
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${className ?? ''}`}
      style={{ backgroundColor: s.bg, border: `1px solid ${s.border}`, color: s.text }}
    >
      {dept}
    </span>
  )
}
