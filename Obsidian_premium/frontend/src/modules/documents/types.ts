export interface Relation {
  targetId: string
  type: string
}

export interface Document {
  id: string
  title: string
  cover: string
  content: string
  interest: string
  area: string
  tags: string[]
  relations: Relation[]
  createdAt: string
}

export type DocumentCreate = Omit<Document, 'id' | 'createdAt'>
export type DocumentUpdate = Partial<Omit<Document, 'id' | 'createdAt'>>
