import { useNavigate } from 'react-router-dom'
import { Handle, Position } from '@xyflow/react'

interface DocumentNodeProps {
  data: {
    id: string
    title: string
    cover?: string
    areaName: string
  }
}

function generateGradient(id: string): string {
  const hues = [220, 260, 300, 340, 20, 60, 100, 160, 200]
  const hue1 = hues[id.charCodeAt(0) % hues.length]
  const hue2 = (hue1 + 40) % 360
  return `linear-gradient(135deg, hsl(${hue1}, 70%, 60%), hsl(${hue2}, 70%, 50%))`
}

export function DocumentNode({ data }: DocumentNodeProps) {
  const navigate = useNavigate()
  const { id, title, cover, areaName } = data

  const backgroundImage = cover || generateGradient(id)

  return (
    <div className="group relative">
      <Handle type="target" position={Position.Top} className="opacity-0" />

      <div
        onClick={() => navigate(`/doc/${id}`)}
        className="
          w-[160px] cursor-pointer
          rounded-xl overflow-hidden
          bg-surface-800
          border border-zinc-700/50
          shadow-lg shadow-black/20
          transition-all duration-200
          hover:shadow-xl hover:shadow-black/40
          hover:border-zinc-600/50
          hover:scale-[1.02]
        "
      >
        <div
          className="h-[80px] w-full bg-cover bg-center"
          style={{ backgroundImage: typeof backgroundImage === 'string' && backgroundImage.startsWith('http')
            ? `url(${backgroundImage})`
            : backgroundImage
          }}
        >
          {!cover && (
            <div className="w-full h-full flex items-center justify-center">
              <svg className="w-8 h-8 text-white/60" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
          )}
        </div>

        <div className="p-3">
          <h4 className="text-zinc-200 text-sm font-medium leading-tight line-clamp-2 min-h-[2.5rem]">
            {title}
          </h4>
          <span className="text-zinc-500 text-xs mt-1.5 block uppercase tracking-wider">
            {areaName}
          </span>
        </div>
      </div>

      <Handle type="source" position={Position.Bottom} className="opacity-0" />
    </div>
  )
}
