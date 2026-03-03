export interface ListItem {
  id: string
  listId: string
  label: string
  order: number
  done: boolean
  createdAt: string
}

export interface List {
  id: string
  title: string
  listType: string
  createdAt: string
  updatedAt: string
  items: ListItem[]
}

export type ListCreate = Omit<List, 'id' | 'createdAt' | 'updatedAt'> & {
  id?: string
  createdAt: string
  updatedAt: string
  items?: { id: string; listId?: string; label: string; order: number; done: boolean; createdAt: string }[]
}

export type ListUpdate = Partial<Pick<List, 'title' | 'listType'>> & {
  items?: ListItem[]
}
