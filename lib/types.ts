export type Role = 'super_admin' | 'brand_employee' | 'client'
export type TicketStatus = 'todo' | 'in_progress' | 'review' | 'done'
export type TicketPriority = 'low' | 'medium' | 'high'

export type Profile = {
  id: string
  full_name: string
  role: Role
  created_at: string
}

export type ProfileContact = {
  user_id: string
  email: string
}

export type Brand = {
  id: string
  name: string
  description: string | null
  created_at: string
}

export type BrandMember = {
  user_id: string
  brand_id: string
}

export type Ticket = {
  id: string
  title: string
  description: string | null
  brand_id: string
  assigned_to: string | null
  created_by: string
  priority: TicketPriority
  status: TicketStatus
  deadline: string | null
  client_visible: boolean
  created_at: string
  updated_at: string
}

export type Comment = {
  id: string
  ticket_id: string
  user_id: string
  body: string
  visibility: 'internal' | 'client_visible'
  created_at: string
}
