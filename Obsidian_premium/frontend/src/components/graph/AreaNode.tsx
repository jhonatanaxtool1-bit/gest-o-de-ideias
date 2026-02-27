import { Handle, Position } from '@xyflow/react'

const AREA_COLORS: Record<string, string> = {
  'Inbox': '#7c8aff',
  'Ideias': '#fbbf24',
  'Produtividade': '#a78bfa',
  'Padrão': '#34d399',
  'default': '#6b7280',
}

interface AreaNodeProps {
  data: {
    label: string
    docCount: number
    color?: string
    expanded: boolean
    onToggle: () => void
  }
}

export function AreaNode({ data }: AreaNodeProps) {
  const { label, docCount, color, expanded, onToggle } = data
  const borderColor = color || AREA_COLORS[label] || AREA_COLORS.default

  return (
    <div className="group relative">
      <Handle type="target" position={Position.Top} className="opacity-0" />

      <div
        onClick={onToggle}
        className={`
          w-[240px] h-[62px] rounded-xl cursor-pointer
          bg-surface-800
          border-t-[3px]
          shadow-lg shadow-black/20
          flex items-center justify-between px-4
          transition-all duration-200
          hover:shadow-xl hover:shadow-black/30
          ${expanded ? 'ring-2 ring-white/10' : ''}
        `}
        style={{ borderTopColor: borderColor }}
      >
        <div className="flex flex-col">
          <span className="text-zinc-200 font-medium text-sm truncate max-w-[160px]">
            {label}
          </span>
          <span className="text-zinc-500 text-xs mt-0.5 uppercase tracking-wider">
            {docCount} {docCount === 1 ? 'documento' : 'documentos'}
          </span>
        </div>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onToggle()
          }}
          className="
            w-7 h-7 rounded-lg flex items-center justify-center
            bg-zinc-700/50 hover:bg-zinc-600/50
            text-zinc-400 hover:text-zinc-200
            transition-colors
          "
        >
          <svg
            className={`w-4 h-4 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      </div>

      <Handle type="source" position={Position.Bottom} className="opacity-0" />
    </div>
  )
}
