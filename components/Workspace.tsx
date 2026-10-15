'use client'

import { FormEvent, ReactNode, useCallback, useEffect, useMemo, useState } from 'react'
import { DndContext, DragEndEvent, useDraggable, useDroppable } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import { jsPDF } from 'jspdf'
import {
  AlertCircle,
  Building2,
  CalendarClock,
  CheckCircle2,
  Download,
  LayoutDashboard,
  LogOut,
  MessageSquare,
  Plus,
  RefreshCw,
  Search,
  Send,
  Ticket as TicketIcon,
  Users,
  Workflow
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import type { Brand, BrandMember, Comment, Profile, ProfileContact, Ticket, TicketPriority, TicketStatus } from '@/lib/types'

const statusOrder: TicketStatus[] = ['todo', 'in_progress', 'review', 'done']
const statusLabels: Record<TicketStatus, string> = {
  todo: 'To do',
  in_progress: 'In progress',
  review: 'Review',
  done: 'Done'
}

const priorityStyles: Record<TicketPriority, string> = {
  low: 'bg-slate-100 text-slate-600',
  medium: 'bg-amber-50 text-amber-700',
  high: 'bg-red-50 text-red-700'
}

type Tab = 'overview' | 'tickets' | 'kanban' | 'brands' | 'team'

type TicketForm = {
  title: string
  description: string
  brand_id: string
  assigned_to: string
  priority: TicketPriority
  deadline: string
  client_visible: boolean
}

const emptyTicketForm: TicketForm = {
  title: '',
  description: '',
  brand_id: '',
  assigned_to: '',
  priority: 'medium',
  deadline: '',
  client_visible: true
}

function dateOnly(value?: string | null) {
  return value ? new Date(`${value}T00:00:00`).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : 'No deadline'
}

function todayIso() {
  return new Date().toISOString().slice(0, 10)
}

function daysUntil(date: string | null) {
  if (!date) return Number.POSITIVE_INFINITY
  const now = new Date(`${todayIso()}T00:00:00`).getTime()
  const target = new Date(`${date}T00:00:00`).getTime()
  return Math.ceil((target - now) / 86400000)
}

function StatCard({ label, value, hint, icon }: { label: string; value: number; hint: string; icon: ReactNode }) {
  return (
    <div className="panel">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="muted">{label}</p>
          <p className="text-4xl font-black mt-2">{value}</p>
          <p className="text-xs text-slate-500 mt-2">{hint}</p>
        </div>
        <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-700 grid place-items-center">{icon}</div>
      </div>
    </div>
  )
}

function DraggableTicket({ ticket, brandName, canMove, onOpen }: { ticket: Ticket; brandName: string; canMove: boolean; onOpen: () => void }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: ticket.id, disabled: !canMove })

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), opacity: isDragging ? 0.55 : 1 }}
      className="bg-white border border-slate-200 rounded-xl p-3 mb-3 shadow-sm"
    >
      <div {...attributes} {...listeners} className={canMove ? 'cursor-grab' : ''}>
        <div className="flex items-start justify-between gap-2">
          <p className="font-bold text-sm leading-snug">{ticket.title}</p>
          <span className={`badge ${priorityStyles[ticket.priority]}`}>{ticket.priority}</span>
        </div>
        <p className="muted mt-1">{brandName}</p>
        <div className="text-xs text-slate-500 mt-3 flex items-center gap-1"><CalendarClock size={13} /> {dateOnly(ticket.deadline)}</div>
      </div>
      <button onClick={onOpen} className="text-xs font-bold text-indigo-700 mt-3 flex items-center gap-1"><MessageSquare size={13} /> Details & comments</button>
    </div>
  )
}

function KanbanColumn({ status, count, children }: { status: TicketStatus; count: number; children: ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: status })
  return (
    <section ref={setNodeRef} className={`rounded-2xl p-3 min-h-[430px] bg-slate-100/80 border ${isOver ? 'border-indigo-500 ring-2 ring-indigo-100' : 'border-slate-200'}`}>
      <div className="flex items-center justify-between mb-4 px-1">
        <h3 className="font-black">{statusLabels[status]}</h3>
        <span className="badge">{count}</span>
      </div>
      {children}
    </section>
  )
}

export default function Workspace() {
  const db = useMemo(() => supabase(), [])
  const [me, setMe] = useState<Profile | null>(null)
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [contacts, setContacts] = useState<ProfileContact[]>([])
  const [brands, setBrands] = useState<Brand[]>([])
  const [members, setMembers] = useState<BrandMember[]>([])
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [tab, setTab] = useState<Tab>('overview')
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [search, setSearch] = useState('')
  const [ticketForm, setTicketForm] = useState<TicketForm>(emptyTicketForm)
  const [brandForm, setBrandForm] = useState({ name: '', description: '' })
  const [membershipForm, setMembershipForm] = useState({ user_id: '', brand_id: '' })
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null)
  const [comments, setComments] = useState<Comment[]>([])
  const [commentBody, setCommentBody] = useState('')
  const [commentVisibility, setCommentVisibility] = useState<'internal' | 'client_visible'>('internal')

  const refresh = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    else setRefreshing(true)
    setError('')

    const { data: authData } = await db.auth.getUser()
    const authUser = authData.user
    if (!authUser) {
      window.location.href = '/login'
      return
    }

    const profileResult = await db.from('profiles').select('*').eq('id', authUser.id).single()
    if (profileResult.error || !profileResult.data) {
      setError('Your Auth account exists, but the matching CRM profile is missing. Follow SETUP.md to create it.')
      setLoading(false)
      setRefreshing(false)
      return
    }

    setMe(profileResult.data as Profile)

    const [brandsResult, ticketsResult, membersResult, profilesResult, contactsResult] = await Promise.all([
      db.from('brands').select('*').order('name'),
      db.from('tickets').select('*').order('created_at', { ascending: false }),
      db.from('brand_members').select('*'),
      db.from('profiles').select('*').order('full_name'),
      db.from('profile_contacts').select('*')
    ])

    const firstError = brandsResult.error || ticketsResult.error || membersResult.error || profilesResult.error || contactsResult.error
    if (firstError) setError(firstError.message)

    setBrands((brandsResult.data || []) as Brand[])
    setTickets((ticketsResult.data || []) as Ticket[])
    setMembers((membersResult.data || []) as BrandMember[])
    setProfiles((profilesResult.data || []) as Profile[])
    setContacts((contactsResult.data || []) as ProfileContact[])
    setLoading(false)
    setRefreshing(false)
  }, [db])

  useEffect(() => { refresh() }, [refresh])

  const brandName = useCallback((brandId: string) => brands.find(b => b.id === brandId)?.name || 'Unknown brand', [brands])
  const profileName = useCallback((profileId: string | null) => profiles.find(p => p.id === profileId)?.full_name || 'Unassigned', [profiles])

  const filteredTickets = useMemo(() => {
    const query = search.trim().toLowerCase()
    if (!query) return tickets
    return tickets.filter(ticket =>
      ticket.title.toLowerCase().includes(query) ||
      (ticket.description || '').toLowerCase().includes(query) ||
      brandName(ticket.brand_id).toLowerCase().includes(query)
    )
  }, [tickets, search, brandName])

  const openTickets = tickets.filter(t => t.status !== 'done')
  const overdue = openTickets.filter(t => t.deadline && daysUntil(t.deadline) < 0)
  const dueSoon = openTickets.filter(t => t.deadline && daysUntil(t.deadline) >= 0 && daysUntil(t.deadline) <= 3)
  const completed = tickets.filter(t => t.status === 'done')

  const canManage = me?.role === 'super_admin' || me?.role === 'brand_employee'
  const isAdmin = me?.role === 'super_admin'
  const isClient = me?.role === 'client'

  const navItems = useMemo(() => {
    const base: { id: Tab; label: string; icon: ReactNode }[] = [
      { id: 'overview', label: isClient ? 'Client overview' : 'Overview', icon: <LayoutDashboard size={18} /> },
      { id: 'tickets', label: 'Tickets', icon: <TicketIcon size={18} /> },
      { id: 'kanban', label: 'Kanban board', icon: <Workflow size={18} /> }
    ]
    if (isAdmin) {
      base.push({ id: 'brands', label: 'Brands', icon: <Building2 size={18} /> })
      base.push({ id: 'team', label: 'Team workload', icon: <Users size={18} /> })
    }
    return base
  }, [isAdmin, isClient])

  async function createTicket(event: FormEvent) {
    event.preventDefault()
    if (!me) return
    setError('')
    setNotice('')

    const payload = {
      title: ticketForm.title.trim(),
      description: ticketForm.description.trim() || null,
      brand_id: ticketForm.brand_id,
      assigned_to: ticketForm.assigned_to || null,
      priority: ticketForm.priority,
      deadline: ticketForm.deadline || null,
      client_visible: ticketForm.client_visible,
      created_by: me.id,
      status: 'todo' as TicketStatus
    }

    const { data, error } = await db.from('tickets').insert(payload).select('*').single()
    if (error) return setError(error.message)

    setTicketForm(emptyTicketForm)
    setNotice('Ticket created successfully.')
    setTab('tickets')
    await refresh(true)

    const assignee = profiles.find(p => p.id === data.assigned_to)
    const assigneeEmail = contacts.find(contact => contact.user_id === data.assigned_to)?.email
    if (assignee && assigneeEmail) {
      const { data: sessionData } = await db.auth.getSession()
      const token = sessionData.session?.access_token
      if (token) {
        const response = await fetch('/api/notify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            to: assigneeEmail,
            subject: `New ticket assigned: ${data.title}`,
            message: `You were assigned a ${data.priority}-priority ticket for ${brandName(data.brand_id)}${data.deadline ? `, due ${dateOnly(data.deadline)}` : ''}.`
          })
        })
        const result = await response.json().catch(() => null)
        if (result?.configured === false) setNotice('Ticket created. Email is ready but RESEND_API_KEY is not configured yet.')
      }
    }
  }

  async function createBrand(event: FormEvent) {
    event.preventDefault()
    setError('')
    const { error } = await db.from('brands').insert({ name: brandForm.name.trim(), description: brandForm.description.trim() || null })
    if (error) return setError(error.message)
    setBrandForm({ name: '', description: '' })
    setNotice('Brand onboarded successfully.')
    await refresh(true)
  }

  async function addMembership(event: FormEvent) {
    event.preventDefault()
    setError('')
    const { error } = await db.from('brand_members').insert(membershipForm)
    if (error) return setError(error.message)
    setMembershipForm({ user_id: '', brand_id: '' })
    setNotice('User linked to brand.')
    await refresh(true)
  }

  async function moveTicket(event: DragEndEvent) {
    if (!event.over || !canManage) return
    const ticketId = String(event.active.id)
    const newStatus = String(event.over.id) as TicketStatus
    if (!statusOrder.includes(newStatus)) return

    const current = tickets.find(t => t.id === ticketId)
    if (!current || current.status === newStatus) return

    const previous = tickets
    setTickets(list => list.map(ticket => ticket.id === ticketId ? { ...ticket, status: newStatus } : ticket))
    const { error } = await db.from('tickets').update({ status: newStatus }).eq('id', ticketId)
    if (error) {
      setTickets(previous)
      setError(error.message)
    } else {
      setNotice(`Moved ticket to ${statusLabels[newStatus]}.`)
    }
  }

  async function openTicket(ticket: Ticket) {
    setSelectedTicket(ticket)
    setComments([])
    setCommentBody('')
    setCommentVisibility(isClient ? 'client_visible' : 'internal')
    const { data, error } = await db.from('comments').select('*').eq('ticket_id', ticket.id).order('created_at')
    if (error) setError(error.message)
    else setComments((data || []) as Comment[])
  }

  async function addComment(event: FormEvent) {
    event.preventDefault()
    if (!me || !selectedTicket || !commentBody.trim()) return
    const visibility = isClient ? 'client_visible' : commentVisibility
    const { error } = await db.from('comments').insert({
      ticket_id: selectedTicket.id,
      user_id: me.id,
      body: commentBody.trim(),
      visibility
    })
    if (error) return setError(error.message)
    setCommentBody('')
    await openTicket(selectedTicket)
  }

  function exportPdf() {
    const doc = new jsPDF({ unit: 'mm', format: 'a4' })
    doc.setFontSize(18)
    doc.text('AgencyFlow CRM - Operations Report', 14, 18)
    doc.setFontSize(10)
    doc.text(`Generated: ${new Date().toLocaleString('en-IN')}`, 14, 25)
    doc.text(`Visible tickets: ${tickets.length} | Open: ${openTickets.length} | Overdue: ${overdue.length} | Completed: ${completed.length}`, 14, 31)
    doc.line(14, 35, 196, 35)

    let y = 43
    tickets.forEach((ticket, index) => {
      if (y > 280) { doc.addPage(); y = 18 }
      const line = `${index + 1}. ${ticket.title.slice(0, 52)} | ${brandName(ticket.brand_id)} | ${statusLabels[ticket.status]} | ${ticket.priority}`
      doc.text(line, 14, y)
      y += 6
    })
    doc.save('agencyflow-crm-report.pdf')
  }

  async function signOut() {
    await db.auth.signOut()
    window.location.href = '/login'
  }

  if (loading) {
    return <div className="min-h-screen grid place-items-center"><div className="flex items-center gap-3 text-slate-600"><RefreshCw className="animate-spin" /> Loading AgencyFlow…</div></div>
  }

  if (!me) {
    return <div className="p-8"><div className="panel max-w-2xl text-red-700">{error || 'Unable to load your CRM profile.'}</div></div>
  }

  return (
    <div className="min-h-screen md:flex">
      <aside className="md:w-64 bg-[#151e38] text-white p-5 md:min-h-screen flex-shrink-0">
        <div className="font-black text-xl flex items-center gap-2 mb-1"><Workflow size={21} /> AgencyFlow</div>
        <p className="text-slate-400 text-xs mb-8">Agency CRM & Client Portal</p>

        <nav className="space-y-2">
          {navItems.map(item => (
            <button key={item.id} onClick={() => setTab(item.id)} className={`w-full flex items-center gap-3 text-left px-3 py-3 rounded-xl text-sm font-semibold ${tab === item.id ? 'bg-indigo-600' : 'text-slate-300 hover:bg-slate-800'}`}>
              {item.icon}{item.label}
            </button>
          ))}
        </nav>

        <div className="mt-10 md:mt-20 border-t border-slate-700 pt-5">
          <p className="font-bold text-sm">{me.full_name}</p>
          <p className="text-slate-400 text-xs capitalize mt-1">{me.role.replace('_', ' ')}</p>
          <button onClick={signOut} className="flex items-center gap-2 mt-5 text-sm text-slate-300"><LogOut size={16} /> Sign out</button>
        </div>
      </aside>

      <main className="flex-1 min-w-0 p-4 md:p-8 xl:p-10">
        <header className="flex flex-wrap items-center justify-between gap-4 mb-7">
          <div>
            <p className="muted">Workspace / {tab}</p>
            <h1 className="text-3xl font-black mt-1">{navItems.find(item => item.id === tab)?.label || 'Workspace'}</h1>
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => refresh(true)} className="btn-secondary" disabled={refreshing}><RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} /> Refresh</button>
            <button onClick={exportPdf} className="btn-secondary"><Download size={16} /> Export PDF</button>
          </div>
        </header>

        {error && <div className="mb-5 rounded-xl bg-red-50 border border-red-100 text-red-700 p-3 flex items-start gap-2"><AlertCircle size={18} className="mt-0.5" /><span>{error}</span><button onClick={() => setError('')} className="ml-auto font-bold">×</button></div>}
        {notice && <div className="mb-5 rounded-xl bg-emerald-50 border border-emerald-100 text-emerald-700 p-3 flex items-start gap-2"><CheckCircle2 size={18} className="mt-0.5" /><span>{notice}</span><button onClick={() => setNotice('')} className="ml-auto font-bold">×</button></div>}

        {tab === 'overview' && (
          <div className="space-y-6">
            <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-4">
              <StatCard label="Visible tickets" value={tickets.length} hint={isClient ? 'Tickets shared with your brand' : 'Across your accessible brands'} icon={<TicketIcon size={20} />} />
              <StatCard label="Open work" value={openTickets.length} hint="Not yet completed" icon={<Workflow size={20} />} />
              <StatCard label="Overdue" value={overdue.length} hint="Past deadline and still open" icon={<AlertCircle size={20} />} />
              <StatCard label="Completed" value={completed.length} hint="Finished tickets" icon={<CheckCircle2 size={20} />} />
            </div>

            <div className="grid xl:grid-cols-[1.35fr_.65fr] gap-5">
              <section className="panel">
                <div className="flex items-center justify-between mb-4"><h2 className="font-black text-lg">Recent tickets</h2><button onClick={() => setTab('tickets')} className="text-sm text-indigo-700 font-bold">View all</button></div>
                <div className="divide-y">
                  {tickets.slice(0, 8).map(ticket => (
                    <button key={ticket.id} onClick={() => openTicket(ticket)} className="w-full py-3 text-left flex items-center justify-between gap-4">
                      <div className="min-w-0"><p className="font-bold truncate">{ticket.title}</p><p className="muted">{brandName(ticket.brand_id)} · {profileName(ticket.assigned_to)}</p></div>
                      <div className="text-right"><span className={`badge ${priorityStyles[ticket.priority]}`}>{ticket.priority}</span><p className="muted mt-1">{statusLabels[ticket.status]}</p></div>
                    </button>
                  ))}
                  {!tickets.length && <p className="muted py-5">No tickets are visible to this account yet.</p>}
                </div>
              </section>

              <section className="panel">
                <h2 className="font-black text-lg mb-4">Deadline watch</h2>
                <div className="space-y-3">
                  {overdue.slice(0, 4).map(ticket => (
                    <button key={ticket.id} onClick={() => openTicket(ticket)} className="w-full text-left rounded-xl border border-red-100 bg-red-50 p-3"><p className="font-bold text-sm">{ticket.title}</p><p className="text-xs text-red-700 mt-1">Overdue · {dateOnly(ticket.deadline)}</p></button>
                  ))}
                  {dueSoon.slice(0, 4).map(ticket => (
                    <button key={ticket.id} onClick={() => openTicket(ticket)} className="w-full text-left rounded-xl border border-amber-100 bg-amber-50 p-3"><p className="font-bold text-sm">{ticket.title}</p><p className="text-xs text-amber-700 mt-1">Due soon · {dateOnly(ticket.deadline)}</p></button>
                  ))}
                  {!overdue.length && !dueSoon.length && <p className="muted">No urgent deadlines in the next three days.</p>}
                </div>
              </section>
            </div>
          </div>
        )}

        {tab === 'tickets' && (
          <div className={`grid ${canManage ? 'xl:grid-cols-[1fr_360px]' : ''} gap-5`}>
            <section className="panel min-w-0">
              <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
                <h2 className="font-black text-lg">Ticket management</h2>
                <label className="relative w-full sm:w-72"><Search size={16} className="absolute left-3 top-3 text-slate-400" /><input value={search} onChange={e => setSearch(e.target.value)} className="pl-9" placeholder="Search title or brand" /></label>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] text-sm">
                  <thead><tr className="text-left text-slate-500 border-b"><th className="py-3 pr-3">Ticket</th><th className="p-3">Brand</th><th className="p-3">Assignee</th><th className="p-3">Priority</th><th className="p-3">Status</th><th className="p-3">Deadline</th></tr></thead>
                  <tbody>
                    {filteredTickets.map(ticket => (
                      <tr key={ticket.id} onClick={() => openTicket(ticket)} className="border-b last:border-0 hover:bg-slate-50 cursor-pointer">
                        <td className="py-3 pr-3"><p className="font-bold">{ticket.title}</p><p className="muted truncate max-w-xs">{ticket.description || 'No description'}</p></td>
                        <td className="p-3">{brandName(ticket.brand_id)}</td>
                        <td className="p-3">{profileName(ticket.assigned_to)}</td>
                        <td className="p-3"><span className={`badge ${priorityStyles[ticket.priority]}`}>{ticket.priority}</span></td>
                        <td className="p-3">{statusLabels[ticket.status]}</td>
                        <td className="p-3">{dateOnly(ticket.deadline)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {!filteredTickets.length && <p className="muted py-6">No tickets match your search.</p>}
              </div>
            </section>

            {canManage && (
              <form onSubmit={createTicket} className="panel h-fit space-y-3">
                <div><h2 className="font-black text-lg flex items-center gap-2"><Plus size={18} /> Create ticket</h2><p className="muted mt-1">Create operational work for an accessible brand.</p></div>
                <input required placeholder="Ticket title" value={ticketForm.title} onChange={e => setTicketForm({ ...ticketForm, title: e.target.value })} />
                <textarea rows={3} placeholder="Description" value={ticketForm.description} onChange={e => setTicketForm({ ...ticketForm, description: e.target.value })} />
                <select required value={ticketForm.brand_id} onChange={e => setTicketForm({ ...ticketForm, brand_id: e.target.value, assigned_to: '' })}>
                  <option value="">Select brand</option>
                  {brands.map(brand => <option key={brand.id} value={brand.id}>{brand.name}</option>)}
                </select>
                <select value={ticketForm.assigned_to} onChange={e => setTicketForm({ ...ticketForm, assigned_to: e.target.value })}>
                  <option value="">Unassigned</option>
                  {profiles.filter(profile => profile.role === 'brand_employee' && members.some(member => member.user_id === profile.id && member.brand_id === ticketForm.brand_id)).map(profile => <option key={profile.id} value={profile.id}>{profile.full_name}</option>)}
                </select>
                <select value={ticketForm.priority} onChange={e => setTicketForm({ ...ticketForm, priority: e.target.value as TicketPriority })}>
                  <option value="low">Low priority</option><option value="medium">Medium priority</option><option value="high">High priority</option>
                </select>
                <input type="date" value={ticketForm.deadline} onChange={e => setTicketForm({ ...ticketForm, deadline: e.target.value })} />
                <label className="flex items-center gap-2 text-sm"><input className="w-auto" type="checkbox" checked={ticketForm.client_visible} onChange={e => setTicketForm({ ...ticketForm, client_visible: e.target.checked })} /> Visible in client portal</label>
                <button className="btn w-full">Create ticket</button>
              </form>
            )}
          </div>
        )}

        {tab === 'kanban' && (
          <DndContext onDragEnd={moveTicket}>
            <div className="grid md:grid-cols-2 2xl:grid-cols-4 gap-4">
              {statusOrder.map(status => {
                const list = filteredTickets.filter(ticket => ticket.status === status)
                return (
                  <KanbanColumn key={status} status={status} count={list.length}>
                    {list.map(ticket => <DraggableTicket key={ticket.id} ticket={ticket} brandName={brandName(ticket.brand_id)} canMove={!!canManage} onOpen={() => openTicket(ticket)} />)}
                    {!list.length && <p className="text-xs text-slate-400 text-center py-8">Drop tickets here</p>}
                  </KanbanColumn>
                )
              })}
            </div>
          </DndContext>
        )}

        {tab === 'brands' && isAdmin && (
          <div className="grid xl:grid-cols-[1fr_340px] gap-5">
            <section className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {brands.map(brand => {
                const brandTickets = tickets.filter(ticket => ticket.brand_id === brand.id)
                const brandMembers = members.filter(member => member.brand_id === brand.id)
                return <div key={brand.id} className="panel"><div className="w-10 h-10 bg-indigo-50 text-indigo-700 rounded-xl grid place-items-center mb-4"><Building2 size={20} /></div><h2 className="font-black text-lg">{brand.name}</h2><p className="muted min-h-10 mt-1">{brand.description || 'No description added.'}</p><div className="flex gap-5 mt-5 text-sm"><div><p className="font-black text-xl">{brandTickets.length}</p><p className="muted">tickets</p></div><div><p className="font-black text-xl">{brandMembers.length}</p><p className="muted">members</p></div></div></div>
              })}
            </section>
            <form onSubmit={createBrand} className="panel h-fit space-y-3"><div><h2 className="font-black text-lg">Onboard brand</h2><p className="muted mt-1">Create a new client/brand workspace.</p></div><input required placeholder="Brand name" value={brandForm.name} onChange={e => setBrandForm({ ...brandForm, name: e.target.value })} /><textarea rows={3} placeholder="Short description" value={brandForm.description} onChange={e => setBrandForm({ ...brandForm, description: e.target.value })} /><button className="btn w-full"><Plus size={16} /> Add brand</button></form>
          </div>
        )}

        {tab === 'team' && isAdmin && (
          <div className="grid xl:grid-cols-[1fr_350px] gap-5">
            <section className="panel">
              <h2 className="font-black text-lg mb-5">Employee workload</h2>
              <div className="space-y-5">
                {profiles.filter(profile => profile.role === 'brand_employee').map(profile => {
                  const assigned = tickets.filter(ticket => ticket.assigned_to === profile.id && ticket.status !== 'done')
                  const max = Math.max(10, ...profiles.filter(p => p.role === 'brand_employee').map(p => tickets.filter(t => t.assigned_to === p.id && t.status !== 'done').length))
                  const brandList = members.filter(m => m.user_id === profile.id).map(m => brandName(m.brand_id))
                  return <div key={profile.id}><div className="flex justify-between gap-3 mb-2"><div><p className="font-bold">{profile.full_name}</p><p className="muted">{brandList.join(', ') || 'No brand assigned'}</p></div><div className="text-right"><p className="font-black">{assigned.length}</p><p className="muted">open</p></div></div><div className="h-3 bg-slate-100 rounded-full overflow-hidden"><div className="h-full bg-indigo-500 rounded-full" style={{ width: `${Math.min(100, (assigned.length / max) * 100)}%` }} /></div></div>
                })}
              </div>
            </section>
            <form onSubmit={addMembership} className="panel h-fit space-y-3"><div><h2 className="font-black text-lg">Assign user to brand</h2><p className="muted mt-1">The Auth user/profile must already exist.</p></div><select required value={membershipForm.user_id} onChange={e => setMembershipForm({ ...membershipForm, user_id: e.target.value })}><option value="">Select user</option>{profiles.filter(profile => profile.role !== 'super_admin').map(profile => <option key={profile.id} value={profile.id}>{profile.full_name} ({profile.role})</option>)}</select><select required value={membershipForm.brand_id} onChange={e => setMembershipForm({ ...membershipForm, brand_id: e.target.value })}><option value="">Select brand</option>{brands.map(brand => <option key={brand.id} value={brand.id}>{brand.name}</option>)}</select><button className="btn w-full"><Users size={16} /> Link membership</button></form>
          </div>
        )}
      </main>

      {selectedTicket && (
        <div className="fixed inset-0 z-50 bg-slate-950/45 p-4 grid place-items-center" onMouseDown={event => { if (event.currentTarget === event.target) setSelectedTicket(null) }}>
          <section className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-5 md:p-6">
            <div className="flex items-start justify-between gap-4">
              <div><p className="muted">{brandName(selectedTicket.brand_id)} · {statusLabels[selectedTicket.status]}</p><h2 className="text-2xl font-black mt-1">{selectedTicket.title}</h2></div>
              <button onClick={() => setSelectedTicket(null)} className="text-2xl leading-none">×</button>
            </div>
            <p className="text-slate-600 mt-4 whitespace-pre-wrap">{selectedTicket.description || 'No description provided.'}</p>
            <div className="grid sm:grid-cols-3 gap-3 mt-5"><div className="bg-slate-50 rounded-xl p-3"><p className="muted">Assignee</p><p className="font-bold mt-1">{profileName(selectedTicket.assigned_to)}</p></div><div className="bg-slate-50 rounded-xl p-3"><p className="muted">Priority</p><p className="font-bold mt-1 capitalize">{selectedTicket.priority}</p></div><div className="bg-slate-50 rounded-xl p-3"><p className="muted">Deadline</p><p className="font-bold mt-1">{dateOnly(selectedTicket.deadline)}</p></div></div>

            <div className="mt-7 border-t pt-5">
              <h3 className="font-black flex items-center gap-2"><MessageSquare size={18} /> Conversation</h3>
              <div className="space-y-3 mt-4">
                {comments.map(comment => <div key={comment.id} className="rounded-xl bg-slate-50 p-3"><div className="flex justify-between gap-3"><p className="font-bold text-sm">{profileName(comment.user_id)}</p><span className="badge">{comment.visibility === 'internal' ? 'Internal' : 'Client visible'}</span></div><p className="text-sm text-slate-700 mt-2 whitespace-pre-wrap">{comment.body}</p><p className="muted mt-2">{new Date(comment.created_at).toLocaleString('en-IN')}</p></div>)}
                {!comments.length && <p className="muted">No comments yet.</p>}
              </div>

              <form onSubmit={addComment} className="mt-4 space-y-3">
                <textarea required rows={3} placeholder="Write a comment…" value={commentBody} onChange={e => setCommentBody(e.target.value)} />
                <div className="flex flex-wrap items-center justify-between gap-3">
                  {!isClient && <select className="max-w-48" value={commentVisibility} onChange={e => setCommentVisibility(e.target.value as 'internal' | 'client_visible')}><option value="internal">Internal note</option><option value="client_visible">Client visible</option></select>}
                  <button className="btn ml-auto"><Send size={15} /> Add comment</button>
                </div>
              </form>
            </div>
          </section>
        </div>
      )}
    </div>
  )
}
