import { Handle, Position } from '@xyflow/react'

interface InterestNodeProps {
  data: {
    label: string
    areaCount: number
    docCount: number
    expanded: boolean
    onToggle: () => void
  }
}

export function InterestNode({ data }: InterestNodeProps) {
  const { label, areaCount, docCount, expanded, onToggle } = data

  return (
    <div className="group relative">
      <Handle type="target" position={Position.Top} className="opacity-0" />

      <div
        onClick={onToggle}
        className={`
          w-[270px] h-[72px] rounded-xl cursor-pointer
          bg-gradient-to-br from-slate-700 to-slate-800
          border border-slate-600/50
          shadow-lg shadow-slate-900/20
          flex items-center justify-between px-4
          transition-all duration-200
          hover:shadow-xl hover:shadow-slate-900/30
          hover:border-slate-500/50
          ${expanded ? 'ring-2 ring-accent/30' : ''}
        `}
      >
        <div className="flex flex-col">
          <span className="text-white font-semibold text-sm truncate max-w-[180px]">
            {label}
          </span>
          <span className="text-slate-400 text-xs mt-0.5">
            {areaCount} {areaCount === 1 ? 'área' : 'áreas'} · {docCount} {docCount === 1 ? 'doc' : 'docs'}
          </span>
        </div>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onToggle()
          }}
          className="
            w-8 h-8 rounded-lg flex items-center justify-center
            bg-slate-600/50 hover:bg-slate-500/50
            text-slate-300 hover:text-white
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
