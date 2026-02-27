import { useMemo, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import ForceGraph2D from 'react-force-graph-2d'
import { useDocuments } from '@/modules/documents/useDocuments'

type GraphNode = { id: string; title: string; cover: string; area: string }
type GraphLink = { source: string; target: string }

const AREA_COLORS: Record<string, string> = {
  '': '#6b7280',
  Inbox: '#7c8aff',
  Áreas: '#34d399',
  Ideias: '#fbbf24',
  Produtividade: '#a78bfa',
}

function getNodeColor(area: string): string {
  return AREA_COLORS[area] ?? AREA_COLORS[''] ?? '#6b7280'
}

export function GraphPage() {
  const navigate = useNavigate()
  const { documents } = useDocuments()
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const { nodes, links } = useMemo(() => {
    const nodes: GraphNode[] = documents.map((d) => ({
      id: d.id,
      title: d.title,
      cover: d.cover,
      area: d.area,
    }))
    const linkSet = new Set<string>()
    const links: GraphLink[] = []
    for (const d of documents) {
      for (const r of d.relations) {
        const key = [d.id, r.targetId].sort().join('|')
        if (!linkSet.has(key)) {
          linkSet.add(key)
          links.push({ source: d.id, target: r.targetId })
        }
      }
    }
    return { nodes, links }
  }, [documents])

  const graphData = useMemo(
    () => ({
      nodes: nodes.map((n) => ({ ...n })),
      links: links.map((l) => ({ ...l })),
    }),
    [nodes, links]
  )

  const connectedIds = useMemo(() => {
    if (!selectedId) return new Set<string>()
    const set = new Set<string>([selectedId])
    for (const l of links) {
      if (l.source === selectedId || l.target === selectedId) {
        set.add(l.source)
        set.add(l.target)
      }
    }
    return set
  }, [selectedId, links])

  const handleNodeClick = useCallback(
    (node: { id?: string }) => {
      const id = typeof node.id === 'string' ? node.id : (node as GraphNode).id
      if (id) {
        setSelectedId(id)
        navigate(`/doc/${id}`)
      }
    },
    [navigate]
  )

  const handleBackgroundClick = useCallback(() => setSelectedId(null), [])

  if (documents.length === 0) {
    return (
      <div className="h-full flex items-center justify-center text-zinc-500">
        Nenhum documento. Crie um para ver o grafo.
      </div>
    )
  }

  return (
    <div className="h-full w-full relative">
      <ForceGraph2D
        graphData={graphData}
        onNodeClick={handleNodeClick}
        onBackgroundClick={handleBackgroundClick}
        nodeId="id"
        nodeLabel="title"
        linkDirectionalArrowLength={4}
        linkDirectionalArrowRelPos={1}
        linkColor={() => 'rgba(124, 138, 255, 0.4)'}
        nodeCanvasObject={(node, ctx, globalScale) => {
          const n = node as unknown as GraphNode
          const id = n.id
          const isHighlight = selectedId === id || connectedIds.has(id)
          const isDimmed = selectedId !== null && !connectedIds.has(id)
          const color = getNodeColor(n.area)
          const x = (node as { x?: number }).x ?? 0
          const y = (node as { y?: number }).y ?? 0
          const radius = 20
          const opacity = isDimmed ? 0.25 : 1
          ctx.save()
          ctx.globalAlpha = opacity
          ctx.beginPath()
          ctx.arc(x, y, radius, 0, 2 * Math.PI)
          ctx.fillStyle = isHighlight ? color : '#374151'
          ctx.fill()
          ctx.strokeStyle = isHighlight ? color : '#4b5563'
          ctx.lineWidth = isHighlight ? 2 : 1
          ctx.stroke()
          ctx.globalAlpha = 1
          ctx.font = `${12 / globalScale}px Inter, sans-serif`
          ctx.fillStyle = isDimmed ? '#6b7280' : '#e5e7eb'
          ctx.textAlign = 'center'
          ctx.fillText(n.title.slice(0, 12) + (n.title.length > 12 ? '…' : ''), x, y + radius + 12 / globalScale)
          ctx.restore()
        }}
        backgroundColor="#0c0d0f"
      />
    </div>
  )
}
