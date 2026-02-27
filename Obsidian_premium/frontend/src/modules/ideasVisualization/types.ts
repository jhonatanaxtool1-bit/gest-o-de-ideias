export type IdeaNodeType = 'interesse' | 'area' | 'ideia'

export type IdeaLinkKind = 'hierarchy' | 'relation'

export interface IdeaGraphNode {
  id: string
  type: IdeaNodeType
  parentId: string | null
  title: string
  description?: string
  metadata?: Record<string, unknown>
  sourceId: string
}

export interface IdeaGraphLink {
  id: string
  source: string
  target: string
  kind: IdeaLinkKind
}

export interface PositionedIdeaGraphNode extends IdeaGraphNode {
  x: number
  y: number
}

export interface LayoutLabel {
  id: string
  title: string
  x: number
  y: number
}

export interface LayoutResult {
  nodes: PositionedIdeaGraphNode[]
  links: IdeaGraphLink[]
  labels?: LayoutLabel[]
}

export interface TreeHierarchyNode {
  id: string
  node: IdeaGraphNode
  children: TreeHierarchyNode[]
}
