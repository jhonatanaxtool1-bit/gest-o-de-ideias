import { useState, useCallback, useMemo, useEffect, useRef } from 'react'
import {
  ReactFlow,
  Background,
  MiniMap,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
  type ReactFlowInstance,
} from '@xyflow/react'
import Dagre from '@dagrejs/dagre'

import { InterestNode } from '@/components/graph/InterestNode'
import { AreaNode } from '@/components/graph/AreaNode'
import { DocumentNode } from '@/components/graph/DocumentNode'
import { DocumentSidebar } from '@/components/graph/DocumentSidebar'
import { GraphControls } from '@/components/graph/GraphControls'

import { useDocuments } from '@/modules/documents/useDocuments'
import { useOrganization } from '@/modules/organization/useOrganization'

const NODE_TYPES = {
  interest: InterestNode,
  area: AreaNode,
  document: DocumentNode,
}

function calculateLayout(nodes: Node[], edges: Edge[]) {
  const g = new Dagre.graphlib.Graph()
  g.setDefaultEdgeLabel(() => ({}))
  g.setGraph({
    rankdir: 'TB',
    nodesep: 60,
    ranksep: 100,
    marginx: 40,
    marginy: 40,
  })

  nodes.forEach((node) => {
    const width = node.type === 'interest' ? 270 : node.type === 'area' ? 240 : 160
    const height = node.type === 'document' ? 136 : node.type === 'interest' ? 72 : 62
    g.setNode(node.id, { width, height })
  })

  edges.forEach((edge) => {
    g.setEdge(edge.source, edge.target)
  })

  Dagre.layout(g)

  return nodes.map((node) => {
    const position = g.node(node.id)
    return {
      ...node,
      position: {
        x: position.x - (node.type === 'interest' ? 135 : node.type === 'area' ? 120 : 80),
        y: position.y - (node.type === 'document' ? 68 : node.type === 'interest' ? 36 : 31),
      },
    }
  })
}

export function HomePage() {
  const { documents } = useDocuments()
  const { interests, areas } = useOrganization()
  const hasSetDefaultInterest = useRef(false)

  const [expandedInterests, setExpandedInterests] = useState<Set<string>>(new Set())
  const [expandedAreas, setExpandedAreas] = useState<Set<string>>(new Set())
  const [selectedInterest, setSelectedInterest] = useState<string | null>(null)
  const [selectedArea, setSelectedArea] = useState<string | null>(null)
  const [showRelations, setShowRelations] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [reactFlowInstance, setReactFlowInstance] = useState<ReactFlowInstance | null>(null)

  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([] as Node[])
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([] as Edge[])

  const toggleInterest = useCallback((interestId: string) => {
    setExpandedInterests((prev) => {
      const next = new Set(prev)
      if (next.has(interestId)) {
        next.delete(interestId)
      } else {
        next.add(interestId)
      }
      return next
    })
  }, [])

  const toggleArea = useCallback((areaId: string) => {
    setExpandedAreas((prev) => {
      const next = new Set(prev)
      if (next.has(areaId)) {
        next.delete(areaId)
      } else {
        next.add(areaId)
      }
      return next
    })
  }, [])

  const expandAll = useCallback(() => {
    setExpandedInterests(new Set(interests.map((i) => i.id)))
    setExpandedAreas(new Set(areas.map((a) => a.id)))
  }, [interests, areas])

  const collapseAll = useCallback(() => {
    setExpandedInterests(new Set())
    setExpandedAreas(new Set())
  }, [])

  const clearFilters = useCallback(() => {
    setSelectedInterest(null)
    setSelectedArea(null)
    setSearchQuery('')
    collapseAll()
  }, [collapseAll])

  const handleInterestChange = useCallback((interestId: string | null) => {
    setSelectedInterest(interestId)
    setSelectedArea(null)
    if (interestId) {
      setExpandedInterests(new Set([interestId]))
    }
  }, [])

  useEffect(() => {
    if (hasSetDefaultInterest.current || selectedInterest || interests.length === 0) return
    const orderedInterests = [...interests].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
    const defaultInterest = orderedInterests[1] ?? orderedInterests[0]
    if (!defaultInterest) return
    hasSetDefaultInterest.current = true
    handleInterestChange(defaultInterest.id)
  }, [interests, selectedInterest, handleInterestChange])

  const filteredDocuments = useMemo(() => {
    return documents.filter((doc) => {
      if (selectedInterest) {
        const docArea = areas.find((a) => a.name === doc.area)
        if (!docArea || docArea.interestId !== selectedInterest) return false
      }
      if (selectedArea) {
        const area = areas.find((a) => a.id === selectedArea)
        if (!area || doc.area !== area.name) return false
      }
      if (searchQuery) {
        const query = searchQuery.toLowerCase()
        const matchesTitle = doc.title.toLowerCase().includes(query)
        const matchesContent = doc.content.toLowerCase().includes(query)
        const matchesTags = doc.tags.some((t) => t.toLowerCase().includes(query))
        if (!matchesTitle && !matchesContent && !matchesTags) return false
      }
      return true
    })
  }, [documents, selectedInterest, selectedArea, areas, searchQuery])

  const { graphNodes, graphEdges } = useMemo<{ graphNodes: Node[]; graphEdges: Edge[] }>(() => {
    const nodes: Node[] = []
    const edges: Edge[] = []

    const sortedInterests = [...interests].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))

    sortedInterests.forEach((interest) => {
      const interestAreas = areas.filter((a) => a.interestId === interest.id)
      const areaNames = interestAreas.map((a) => a.name)
      const docCount = filteredDocuments.filter((d) => areaNames.includes(d.area)).length

      nodes.push({
        id: `interest-${interest.id}`,
        type: 'interest',
        position: { x: 0, y: 0 },
        data: {
          label: interest.name,
          areaCount: interestAreas.length,
          docCount,
          expanded: expandedInterests.has(interest.id),
          onToggle: () => toggleInterest(interest.id),
        },
      })

      if (expandedInterests.has(interest.id)) {
        const sortedAreas = interestAreas.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))

        sortedAreas.forEach((area) => {
          const areaDocs = filteredDocuments.filter((d) => d.area === area.name)

          nodes.push({
            id: `area-${area.id}`,
            type: 'area',
            position: { x: 0, y: 0 },
            data: {
              label: area.name,
              docCount: areaDocs.length,
              expanded: expandedAreas.has(area.id),
              onToggle: () => toggleArea(area.id),
            },
          })

          edges.push({
            id: `edge-interest-${interest.id}-area-${area.id}`,
            source: `interest-${interest.id}`,
            target: `area-${area.id}`,
            style: { stroke: '#475569', strokeWidth: 2, opacity: 0.65 },
          })

          if (expandedAreas.has(area.id)) {
            const sortedDocs = areaDocs.sort((a, b) => a.title.localeCompare(b.title, 'pt-BR'))

            sortedDocs.forEach((doc) => {
              nodes.push({
                id: `doc-${doc.id}`,
                type: 'document',
                position: { x: 0, y: 0 },
                data: {
                  id: doc.id,
                  title: doc.title,
                  cover: doc.cover,
                  areaName: area.name,
                },
              })

              edges.push({
                id: `edge-area-${area.id}-doc-${doc.id}`,
                source: `area-${area.id}`,
                target: `doc-${doc.id}`,
                style: { stroke: '#475569', strokeWidth: 2, opacity: 0.65 },
              })
            })
          }
        })
      }
    })

    if (showRelations) {
      filteredDocuments.forEach((doc) => {
        doc.relations.forEach((rel) => {
          const sourceId = `doc-${doc.id}`
          const targetId = `doc-${rel.targetId}`

          const sourceExists = nodes.some((n) => n.id === sourceId)
          const targetExists = nodes.some((n) => n.id === targetId)

          if (sourceExists && targetExists) {
            const edgeId = `relation-${doc.id}-${rel.targetId}`
            if (!edges.some((e) => e.id === edgeId)) {
              edges.push({
                id: edgeId,
                source: sourceId,
                target: targetId,
                style: {
                  stroke: '#7c8aff',
                  strokeWidth: 1.5,
                  opacity: 0.5,
                  strokeDasharray: '5,5',
                },
              })
            }
          }
        })
      })
    }

    const layoutedNodes = calculateLayout(nodes, edges)

    return { graphNodes: layoutedNodes, graphEdges: edges }
  }, [interests, areas, filteredDocuments, expandedInterests, expandedAreas, showRelations, toggleInterest, toggleArea])

  useEffect(() => {
    setNodes(graphNodes)
    setEdges(graphEdges)
  }, [graphNodes, graphEdges, setNodes, setEdges])

  useEffect(() => {
    if (reactFlowInstance && graphNodes.length > 0) {
      setTimeout(() => {
        reactFlowInstance.fitView({ padding: 0.2, duration: 300 })
      }, 100)
    }
  }, [reactFlowInstance, selectedInterest, selectedArea, searchQuery])

  const areasForSidebar = useMemo(() => {
    if (!selectedInterest) return areas
    return areas.filter((a) => a.interestId === selectedInterest)
  }, [areas, selectedInterest])

  return (
    <div className="h-full w-full flex">
      <div className="flex-1 relative bg-surface-950">
        <GraphControls
          interests={interests}
          areas={areasForSidebar}
          selectedInterest={selectedInterest}
          selectedArea={selectedArea}
          showRelations={showRelations}
          onInterestChange={handleInterestChange}
          onAreaChange={setSelectedArea}
          onToggleRelations={() => setShowRelations((prev) => !prev)}
          onExpandAll={expandAll}
          onCollapseAll={collapseAll}
          onClearFilters={clearFilters}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
        />

        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onInit={setReactFlowInstance}
          nodeTypes={NODE_TYPES}
          fitView
          fitViewOptions={{ padding: 0.2 }}
          minZoom={0.2}
          maxZoom={2}
          proOptions={{ hideAttribution: true }}
          className="bg-surface-950"
        >
          <Background color="#334155" gap={20} size={1} />
          <MiniMap
            className="!bg-surface-900/90 !border-zinc-800 !rounded-lg !shadow-lg"
            nodeColor={(node) => {
              if (node.type === 'interest') return '#64748b'
              if (node.type === 'area') return '#334155'
              return '#1e293b'
            }}
            maskColor="rgba(0, 0, 0, 0.6)"
          />
        </ReactFlow>

        {nodes.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="text-center">
              <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-zinc-800/50 flex items-center justify-center">
                <svg className="w-8 h-8 text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
              </div>
              <p className="text-zinc-400 text-sm font-medium">Nenhum documento encontrado</p>
              <p className="text-zinc-500 text-xs mt-1">Crie documentos para visualizar a árvore</p>
            </div>
          </div>
        )}
      </div>

      <DocumentSidebar
        interests={selectedInterest ? interests.filter((i) => i.id === selectedInterest) : interests}
        areas={areas}
        documents={filteredDocuments}
        expandedInterests={expandedInterests}
        expandedAreas={expandedAreas}
        onToggleInterest={toggleInterest}
        onToggleArea={toggleArea}
      />
    </div>
  )
}
