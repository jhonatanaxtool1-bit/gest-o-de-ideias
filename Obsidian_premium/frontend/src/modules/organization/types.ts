export interface Interest {
  id: string
  name: string
  createdAt: string
}

export interface Area {
  id: string
  name: string
  interestId: string
  createdAt: string
}
