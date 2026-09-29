export type RepairStatus = 'pending' | 'repairing' | 'shelving' | 'available'

export interface StatusChange {
  from: RepairStatus | null
  to: RepairStatus
  at: number
  operator: string
  note?: string
}

export interface RepairRecord {
  id: string
  bookNo: string
  title: string
  damageLocation: string
  photoNote: string
  repairSteps: string[]
  handler: string
  status: RepairStatus
  inspected: boolean
  inspectionNote: string
  inspectedBy: string
  inspectedAt: number | null
  createdAt: number
  updatedAt: number
  history: StatusChange[]
}

export interface NewRecordInput {
  bookNo: string
  title: string
  damageLocation: string
  photoNote: string
  repairSteps: string[]
  handler: string
}
