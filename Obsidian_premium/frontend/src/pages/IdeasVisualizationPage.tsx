import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import * as d3 from 'd3'
import { useDocuments } from '@/modules/documents/useDocuments'
import { useOrganization } from '@/modules/organization/useOrganization'
import {
  buildIdeaGraphData,
  filterTreeNodesByCollapsedAreas,
  getAreaChildrenCount,
} from '@/modules/ideasVisualization/graphData'
import { buildTreeLayout } from '@/modules/ideasVisualization/layouts/treeLayout'
import { buildForceLayout } from '@/modules/ideasVisualization/layouts/forceLayout'
import { buildClusterLayout } from '@/modules/ideasVisualization/layouts/clusterLayout'
import type { IdeaGraphNode, LayoutResult, PositionedIdeaGraphNode } from '@/modules/ideasVisualization/types'
import {
  getNodeRadius,
  getNodeTypeLabel,
  NODE_TYPE_COLOR,
  NODE_TYPE_STROKE,
} from '@/modules/ideasVisualization/interactions'
import { IdeasVisualizationControls, type ViewMode } from '@/modules/ideasVisualization/uiControls'

type TooltipState = {
  x: number
  y: number
  node: IdeaGraphNode
}


export function IdeasVisualizationPage() {
  const navigate = useNavigate()
  const { documents } = useDocuments()
  const { interests, areas } = useOrganization()
  const containerRef = useRef<HTMLDivElement | null>(null)
  const svgRef = useRef<SVGSVGElement | null>(null)
  const [viewport, setViewport] = useState({ width: 1280, height: 760 })
  const [mode, setMode] = useState<ViewMode>('tree')
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [tooltip, setTooltip] = useState<TooltipState | null>(null)
  const [collapsedAreas, setCollapsedAreas] = useState<Set<string>>(new Set())
  const [zoomState, setZoomState] = useState({ x: 0, y: 0, k: 1 })
  const [dragVersion, setDragVersion] = useState(0)
  const [mobileSheetExpanded, setMobileSheetExpanded] = useState(false)
  const previousPositionRef = useRef(new Map<string, { x: number; y: number }>())
  const manualPositionsRef = useRef(new Map<string, { x: number; y: number }>())
  const modeRef = useRef<ViewMode>(mode)
  const selectedNodeIdRef = useRef<string | null>(null)
  const navigateRef = useRef(navigate)
  navigateRef.current = navigate
  const zoomBehaviorRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null)

  const FORCE_POSITIONS_KEY = 'idea-force-positions'

  useEffect(() => {
    modeRef.current = mode
  }, [mode])

  useEffect(() => {
    selectedNodeIdRef.current = selectedNodeId
  }, [selectedNodeId])

  useEffect(() => {
    if (selectedNodeId) setMobileSheetExpanded(true)
  }, [selectedNodeId])

  useEffect(() => {
    manualPositionsRef.current.clear()
    if (mode === 'force') {
      try {
        const saved = localStorage.getItem(FORCE_POSITIONS_KEY)
        if (saved) {
          const entries = JSON.parse(saved) as Array<[string, { x: number; y: number }]>
          for (const [id, pos] of entries) {
            manualPositionsRef.current.set(id, pos)
          }
        }
      } catch {
        // ignore corrupt data
      }
    }
    // Reset zoom to identity on mode change so layout fills the screen
    const svgNode = svgRef.current
    const behavior = zoomBehaviorRef.current
    if (svgNode && behavior) {
      d3.select(svgNode).transition().duration(350).call(behavior.transform, d3.zoomIdentity)
    }
  }, [mode])

  const graphData = useMemo(() => {
    return buildIdeaGraphData({
      interests,
      areas,
      documents,
    })
  }, [interests, areas, documents])

  const areaChildrenCount = useMemo(() => getAreaChildrenCount(graphData.nodes), [graphData.nodes])

  // On mobile subtract the collapsed bottom sheet height so nodes aren't hidden behind it
  const isMobile = viewport.width < 768
  const graphHeight = isMobile ? Math.max(320, viewport.height - 60) : viewport.height

  const layoutResult = useMemo<LayoutResult>(() => {
    const width = Math.max(320, viewport.width)
    const height = Math.max(320, graphHeight)
    const baseNodes = mode === 'tree' ? filterTreeNodesByCollapsedAreas(graphData.nodes, collapsedAreas) : graphData.nodes
    const visibleIds = new Set(baseNodes.map((entry) => entry.id))
    const baseLinks = graphData.links.filter((entry) => visibleIds.has(entry.source) && visibleIds.has(entry.target))

    let result: LayoutResult
    if (mode === 'tree') {
      result = buildTreeLayout(baseNodes, baseLinks, { width, height })
    } else if (mode === 'force') {
      result = buildForceLayout(baseNodes, baseLinks, { width, height })
    } else {
      result = buildClusterLayout(baseNodes, baseLinks, { width, height })
    }

    const nodes = result.nodes.map((entry) => {
      if (mode === 'force' || mode === 'cluster') {
        const override = manualPositionsRef.current.get(entry.id)
        if (override) {
          return { ...entry, x: override.x, y: override.y }
        }
      }
      return entry
    })

    return {
      ...result,
      nodes,
    }
  }, [mode, graphData, collapsedAreas, graphHeight, viewport.width, dragVersion])

  const nodesById = useMemo(() => {
    const map = new Map<string, PositionedIdeaGraphNode>()
    for (const node of layoutResult.nodes) map.set(node.id, node)
    return map
  }, [layoutResult.nodes])

  const selectedNode = useMemo(() => {
    if (!selectedNodeId) return null
    return graphData.nodes.find((entry) => entry.id === selectedNodeId) ?? null
  }, [selectedNodeId, graphData.nodes])

  useEffect(() => {
    const element = containerRef.current
    if (!element) return
    const observer = new ResizeObserver(() => {
      setViewport({
        width: element.clientWidth,
        height: element.clientHeight,
      })
    })
    observer.observe(element)
    setViewport({
      width: element.clientWidth,
      height: element.clientHeight,
    })
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const svgNode = svgRef.current
    if (!svgNode) return
    const svg = d3.select(svgNode)
    const zoomRoot = svg
      .selectAll<SVGGElement, null>('g.zoom-root')
      .data([null])
      .join('g')
      .attr('class', 'zoom-root')
    zoomRoot.selectAll('g.links').data([null]).join('g').attr('class', 'links')
    zoomRoot.selectAll('g.labels').data([null]).join('g').attr('class', 'labels')
    zoomRoot.selectAll('g.nodes').data([null]).join('g').attr('class', 'nodes')

    const defs = svg.selectAll<SVGDefsElement, null>('defs').data([null]).join('defs')
    defs
      .selectAll('filter#idea-node-glow')
      .data([null])
      .join('filter')
      .attr('id', 'idea-node-glow')
      .append('feDropShadow')
      .attr('dx', 0)
      .attr('dy', 0)
      .attr('stdDeviation', 3)
      .attr('flood-color', '#818cf8')
      .attr('flood-opacity', 0.6)
  }, [])

  useEffect(() => {
    const svgNode = svgRef.current
    if (!svgNode) return
    const svg = d3.select(svgNode)
    const zoomRoot = svg.select<SVGGElement>('g.zoom-root')
    const zoomBehavior = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.25, 3.4])
      .on('zoom', (event) => {
        const transform = event.transform
        zoomRoot.attr('transform', transform.toString())
        setZoomState({ x: transform.x, y: transform.y, k: transform.k })
      })

    zoomBehaviorRef.current = zoomBehavior
    svg.call(zoomBehavior)
    svg.on('dblclick.zoom', null) // disable double-click zoom; second tap on node navigates
    return () => {
      svg.on('.zoom', null)
    }
  }, [])

  useEffect(() => {
    const svgNode = svgRef.current
    if (!svgNode) return
    const svg = d3.select(svgNode).attr('viewBox', `0 0 ${viewport.width} ${graphHeight}`)
    const zoomRoot = svg.select<SVGGElement>('g.zoom-root')
    const linksGroup = zoomRoot.select<SVGGElement>('g.links')
    const nodesGroup = zoomRoot.select<SVGGElement>('g.nodes')
    const labelsGroup = zoomRoot.select<SVGGElement>('g.labels')
    const nodeById = new Map(layoutResult.nodes.map((entry) => [entry.id, entry]))

    const validLinks = layoutResult.links.filter((entry) => nodeById.has(entry.source) && nodeById.has(entry.target))

    const linkSelection = linksGroup
      .selectAll<SVGLineElement, typeof validLinks[number]>('line.graph-link')
      .data(validLinks, (entry) => entry.id)

    linkSelection.exit().transition().duration(180).style('opacity', 0).remove()

    const mergedLinks = linkSelection
      .join((enter) =>
        enter
          .append('line')
          .attr('class', 'graph-link')
          .attr('stroke-linecap', 'round')
          .style('opacity', 0)
      )
      .attr('stroke', (entry) => (entry.kind === 'hierarchy' ? 'rgba(148, 163, 184, 0.56)' : 'rgba(124, 138, 255, 0.45)'))
      .attr('stroke-width', (entry) => (entry.kind === 'hierarchy' ? 2 : 1.5))
      .attr('stroke-dasharray', (entry) => (entry.kind === 'hierarchy' ? null : '6,4'))

    mergedLinks
      .transition()
      .duration(440)
      .ease(d3.easeCubicOut)
      .style('opacity', 1)
      .attr('x1', (entry) => nodeById.get(entry.source)?.x ?? 0)
      .attr('y1', (entry) => nodeById.get(entry.source)?.y ?? 0)
      .attr('x2', (entry) => nodeById.get(entry.target)?.x ?? 0)
      .attr('y2', (entry) => nodeById.get(entry.target)?.y ?? 0)

    const nodeSelection = nodesGroup
      .selectAll<SVGGElement, PositionedIdeaGraphNode>('g.graph-node')
      .data(layoutResult.nodes, (entry) => entry.id)

    nodeSelection.exit().transition().duration(180).style('opacity', 0).remove()

    const enterNodes = nodeSelection
      .enter()
      .append('g')
      .attr('class', 'graph-node')
      .style('cursor', 'pointer')
      .style('opacity', 0)
      .attr('transform', (entry) => {
        const previous = previousPositionRef.current.get(entry.id)
        if (previous) return `translate(${previous.x},${previous.y})`
        return `translate(${entry.x},${entry.y})`
      })

    enterNodes
      .append('circle')
      .attr('class', 'node-circle')
      .attr('r', (entry) => getNodeRadius(entry.type))
      .attr('fill', (entry) => NODE_TYPE_COLOR[entry.type])
      .attr('fill-opacity', (entry) => (selectedNodeId && selectedNodeId !== entry.id ? 0.33 : 0.92))
      .attr('stroke', (entry) => NODE_TYPE_STROKE[entry.type])
      .attr('stroke-width', (entry) => (selectedNodeId === entry.id ? 3 : 1.8))

    const mobileView = viewport.width < 768
    const maxLabelLen = mobileView ? 14 : 24

    enterNodes
      .append('text')
      .attr('class', 'node-title')
      .attr('text-anchor', 'middle')
      .attr('dy', (entry) => getNodeRadius(entry.type) + (mobileView ? 13 : 16))
      .attr('fill', '#e4e4e7')
      .attr('font-size', (entry) => {
        if (entry.type === 'interesse') return mobileView ? 11 : 12
        return mobileView ? 9 : 11
      })
      .attr('font-weight', (entry) => (entry.type === 'interesse' ? 600 : 500))
      // On mobile hide idea labels to avoid overlap — tap node to see details in bottom sheet
      .attr('display', (entry) => (mobileView && entry.type === 'ideia' ? 'none' : null))
      .text((entry) => (entry.title.length > maxLabelLen ? `${entry.title.slice(0, maxLabelLen)}…` : entry.title))

    const mergedNodes = enterNodes.merge(nodeSelection)

    mergedNodes
      .on('mousemove', (event, entry) => {
        const bounds = containerRef.current?.getBoundingClientRect()
        if (!bounds) return
        setTooltip({
          x: event.clientX - bounds.left + 12,
          y: event.clientY - bounds.top + 12,
          node: entry,
        })
      })
      .on('mouseleave', () => setTooltip(null))
      .on('click', (_event, entry) => {
        if (selectedNodeIdRef.current === entry.id && entry.type === 'ideia' && entry.sourceId) {
          navigateRef.current(`/ideia/${entry.sourceId}`)
        } else {
          setSelectedNodeId(entry.id)
        }
      })

    const dragBehavior = d3
      .drag<SVGGElement, PositionedIdeaGraphNode>()
      .on('start', function onStart() {
        d3.select(this).raise()
      })
      .on('drag', function onDrag(event, entry) {
        const x = Math.max(16, Math.min(viewport.width - 16, event.x))
        const y = Math.max(16, Math.min(graphHeight - 16, event.y))
        manualPositionsRef.current.set(entry.id, { x, y })
        entry.x = x
        entry.y = y
        nodeById.set(entry.id, entry)

        d3.select<SVGGElement, PositionedIdeaGraphNode>(this).attr('transform', `translate(${x},${y})`)

        linksGroup
          .selectAll<SVGLineElement, typeof validLinks[number]>('line.graph-link')
          .attr('x1', (linkEntry) => (nodeById.get(linkEntry.source)?.id === entry.id ? x : (nodeById.get(linkEntry.source)?.x ?? 0)))
          .attr('y1', (linkEntry) => (nodeById.get(linkEntry.source)?.id === entry.id ? y : (nodeById.get(linkEntry.source)?.y ?? 0)))
          .attr('x2', (linkEntry) => (nodeById.get(linkEntry.target)?.id === entry.id ? x : (nodeById.get(linkEntry.target)?.x ?? 0)))
          .attr('y2', (linkEntry) => (nodeById.get(linkEntry.target)?.id === entry.id ? y : (nodeById.get(linkEntry.target)?.y ?? 0)))
      })
      .on('end', () => {
        if (modeRef.current === 'force') {
          try {
            localStorage.setItem(
              FORCE_POSITIONS_KEY,
              JSON.stringify([...manualPositionsRef.current.entries()])
            )
          } catch {
            // ignore
          }
        }
        setDragVersion((value) => value + 1)
      })

    mergedNodes.call(dragBehavior)

    mergedNodes
      .transition()
      .duration(450)
      .ease(d3.easeCubicOut)
      .style('opacity', 1)
      .attr('transform', (entry) => `translate(${entry.x},${entry.y})`)

    mergedNodes
      .select<SVGCircleElement>('circle.node-circle')
      .attr('fill-opacity', (entry) => (selectedNodeId && selectedNodeId !== entry.id ? 0.33 : 0.94))
      .attr('stroke-width', (entry) => (selectedNodeId === entry.id ? 3 : 1.8))
      .attr('filter', (entry) => (selectedNodeId === entry.id ? 'url(#idea-node-glow)' : null))

    const labelSelection = labelsGroup
      .selectAll<SVGTextElement, NonNullable<LayoutResult['labels']>[number]>('text.cluster-label')
      .data(layoutResult.labels ?? [], (entry) => entry.id)

    labelSelection.exit().remove()

    labelSelection
      .join((enter) =>
        enter
          .append('text')
          .attr('class', 'cluster-label')
          .attr('text-anchor', 'middle')
          .attr('fill', 'rgba(244, 244, 245, 0.82)')
          .attr('font-size', mobileView ? 11 : 14)
          .attr('font-weight', 600)
      )
      .attr('x', (entry) => entry.x)
      .attr('y', (entry) => entry.y)
      .text((entry) => entry.title)

    previousPositionRef.current = new Map(layoutResult.nodes.map((entry) => [entry.id, { x: entry.x, y: entry.y }]))
  }, [layoutResult, mode, selectedNodeId, graphHeight, viewport.width])

  const minimapViewBox = useMemo(() => {
    const entries = layoutResult.nodes
    if (entries.length === 0) return '0 0 10 10'
    const minX = Math.min(...entries.map((entry) => entry.x))
    const maxX = Math.max(...entries.map((entry) => entry.x))
    const minY = Math.min(...entries.map((entry) => entry.y))
    const maxY = Math.max(...entries.map((entry) => entry.y))
    const width = Math.max(10, maxX - minX + 60)
    const height = Math.max(10, maxY - minY + 60)
    return `${minX - 30} ${minY - 30} ${width} ${height}`
  }, [layoutResult.nodes])

  const toggleSelectedAreaCollapse = useCallback(() => {
    if (!selectedNode || selectedNode.type !== 'area') return
    setCollapsedAreas((previous) => {
      const next = new Set(previous)
      if (next.has(selectedNode.id)) next.delete(selectedNode.id)
      else next.add(selectedNode.id)
      return next
    })
  }, [selectedNode])

  const detailPanelContent = (
    <div className="space-y-4 px-5 py-4 text-sm">
      {!selectedNode && <p className="text-zinc-500">Selecione um nó para visualizar os dados.</p>}
      {selectedNode && (
        <>
          <div>
            <p className="text-xs uppercase tracking-wide text-zinc-500">Título</p>
            <p className="text-zinc-100 font-medium mt-1">{selectedNode.title}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-zinc-500">Tipo</p>
            <p className="text-zinc-200 mt-1">{getNodeTypeLabel(selectedNode.type)}</p>
          </div>
          {selectedNode.description && (
            <div>
              <p className="text-xs uppercase tracking-wide text-zinc-500">Descrição</p>
              <p className="text-zinc-300 mt-1 leading-relaxed">{selectedNode.description}</p>
            </div>
          )}
          {selectedNode.type === 'area' && (
            <button
              type="button"
              onClick={toggleSelectedAreaCollapse}
              disabled={mode !== 'tree'}
              className={`rounded-lg px-3 py-2 text-xs font-medium transition-colors ${
                mode === 'tree'
                  ? 'bg-zinc-800 text-zinc-100 hover:bg-zinc-700'
                  : 'bg-zinc-900 text-zinc-500 cursor-not-allowed'
              }`}
            >
              {collapsedAreas.has(selectedNode.id) ? 'Expandir área' : 'Colapsar área'}
            </button>
          )}
          {selectedNode.type === 'ideia' && (
            <button
              type="button"
              onClick={() => navigate(`/ideia/${selectedNode.sourceId}`)}
              className="w-full rounded-xl bg-accent px-4 py-3 text-sm font-semibold text-white hover:bg-accent-bright transition-colors shadow-lg shadow-accent/20"
            >
              Abrir ideia no editor →
            </button>
          )}
        </>
      )}
    </div>
  )

  return (
    <div ref={containerRef} className="relative h-full w-full bg-surface-950 overflow-hidden">
      <IdeasVisualizationControls mode={mode} onChangeMode={setMode} />

      <svg ref={svgRef} className="h-full w-full" role="img" aria-label="Segundo Cérebro" />

      {/* Tooltip — desktop only (touch devices use the bottom sheet) */}
      {tooltip && (
        <div
          className="pointer-events-none hidden md:block absolute z-30 rounded-lg border border-zinc-700 bg-zinc-900/95 px-3 py-2 shadow-xl"
          style={{ left: tooltip.x, top: tooltip.y }}
        >
          <p className="text-xs text-zinc-400">{getNodeTypeLabel(tooltip.node.type)}</p>
          <p className="text-sm font-semibold text-zinc-100">{tooltip.node.title}</p>
        </div>
      )}

      {/* ── DESKTOP SIDEBAR ── */}
      <aside className="hidden md:flex flex-col absolute right-0 top-0 z-20 h-full w-80 border-l border-zinc-800 bg-surface-900/95 backdrop-blur overflow-y-auto">
        <div className="border-b border-zinc-800 px-5 py-4 flex-none">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-400">Painel de Detalhes</h2>
        </div>
        {detailPanelContent}
      </aside>

      {/* ── MOBILE BOTTOM SHEET ── */}
      <div
        className={`md:hidden absolute bottom-0 left-0 right-0 z-20 flex flex-col rounded-t-2xl border-t border-zinc-800 bg-surface-900 transition-[height] duration-300 ease-out ${
          mobileSheetExpanded && selectedNode ? 'h-[58vh]' : 'h-14'
        }`}
      >
        {/* Handle bar */}
        <button
          type="button"
          onClick={() => selectedNode && setMobileSheetExpanded((v) => !v)}
          className="relative flex-none flex items-center gap-3 px-4 h-14 w-full text-left"
        >
          {/* drag pill */}
          <span className="absolute top-2 left-1/2 -translate-x-1/2 w-8 h-1 rounded-full bg-zinc-700" />
          <span className="flex-1 text-sm truncate text-zinc-300 mt-1">
            {selectedNode ? selectedNode.title : 'Toque em um nó para ver detalhes'}
          </span>
          {selectedNode?.type === 'ideia' && (
            <span
              role="button"
              tabIndex={0}
              onClick={(e) => {
                e.stopPropagation()
                navigate(`/ideia/${selectedNode.sourceId}`)
              }}
              onKeyDown={(e) => e.key === 'Enter' && navigate(`/ideia/${selectedNode.sourceId}`)}
              className="flex-none rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-white mt-1"
            >
              Abrir →
            </span>
          )}
          {selectedNode && (
            <svg
              className={`flex-none h-4 w-4 text-zinc-500 mt-1 transition-transform duration-300 ${mobileSheetExpanded ? 'rotate-180' : ''}`}
              fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
            </svg>
          )}
        </button>

        {/* Expanded content */}
        {mobileSheetExpanded && selectedNode && (
          <div className="flex-1 overflow-y-auto">
            {detailPanelContent}
          </div>
        )}
      </div>

      {/* ── MINIMAP (desktop only) ── */}
      <div className="hidden md:block absolute bottom-5 right-[21rem] z-20 w-56 rounded-xl border border-zinc-700 bg-zinc-900/80 p-2 backdrop-blur">
        <p className="px-1 pb-2 text-[11px] font-medium uppercase tracking-wide text-zinc-400">MiniMap</p>
        <svg className="h-36 w-full rounded-md border border-zinc-800 bg-surface-950" viewBox={minimapViewBox}>
          {layoutResult.links.map((entry) => {
            const source = nodesById.get(entry.source)
            const target = nodesById.get(entry.target)
            if (!source || !target) return null
            return (
              <line
                key={entry.id}
                x1={source.x}
                y1={source.y}
                x2={target.x}
                y2={target.y}
                stroke={entry.kind === 'hierarchy' ? 'rgba(148,163,184,0.55)' : 'rgba(124,138,255,0.45)'}
                strokeWidth={entry.kind === 'hierarchy' ? 2 : 1}
                strokeDasharray={entry.kind === 'hierarchy' ? undefined : '4,3'}
              />
            )
          })}
          {layoutResult.nodes.map((entry) => (
            <circle
              key={entry.id}
              cx={entry.x}
              cy={entry.y}
              r={Math.max(3, getNodeRadius(entry.type) * 0.35)}
              fill={NODE_TYPE_COLOR[entry.type]}
            />
          ))}
        </svg>
      </div>

      {/* ── STATS (desktop only) ── */}
      <div className="hidden md:block absolute bottom-5 left-5 z-20 rounded-xl border border-zinc-700 bg-zinc-900/75 px-3 py-2 text-xs text-zinc-300 backdrop-blur">
        <p>Nós: {layoutResult.nodes.length}</p>
        <p>Links: {layoutResult.links.length}</p>
        <p>Zoom: {zoomState.k.toFixed(2)}x</p>
        {selectedNode?.type === 'area' && <p>Ideias nesta área: {areaChildrenCount.get(selectedNode.id) ?? 0}</p>}
      </div>
    </div>
  )
}
