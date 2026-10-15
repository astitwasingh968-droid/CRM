'use client'

import { FormEvent, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { LockKeyhole, Workflow } from 'lucide-react'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const router = useRouter()

  async function signIn(event: FormEvent) {
    event.preventDefault()
    setError('')
    setBusy(true)
    const { error } = await supabase().auth.signInWithPassword({ email, password })
    setBusy(false)
    if (error) return setError(error.message)
    router.replace('/dashboard')
    router.refresh()
  }

  return (
    <main className="min-h-screen grid lg:grid-cols-2">
      <section className="hidden lg:flex bg-[#151e38] text-white p-14 flex-col justify-between">
        <div className="font-black text-xl flex items-center gap-2"><Workflow /> AgencyFlow</div>
        <div className="max-w-xl">
          <p className="uppercase tracking-[0.25em] text-indigo-300 text-sm font-bold">Agency operations, unified</p>
          <h1 className="text-5xl font-black leading-tight mt-4">Manage clients, tickets, teams and deadlines from one workspace.</h1>
          <p className="text-slate-300 mt-5 text-lg">A role-based CRM with database-level tenant isolation for agencies managing multiple brands.</p>
        </div>
        <p className="text-slate-500 text-sm">Next.js · TypeScript · Supabase · PostgreSQL RLS</p>
      </section>
      <section className="grid place-items-center p-6">
        <form onSubmit={signIn} className="w-full max-w-md panel space-y-5">
          <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-700 grid place-items-center"><LockKeyhole /></div>
          <div><h2 className="text-3xl font-black">Sign in</h2><p className="muted mt-1">Use a Supabase Auth account linked to a CRM profile.</p></div>
          <label className="block space-y-2"><span className="text-sm font-semibold">Email</span><input type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="admin@agency.com" /></label>
          <label className="block space-y-2"><span className="text-sm font-semibold">Password</span><input type="password" required value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" /></label>
          {error && <div className="bg-red-50 text-red-700 rounded-lg p-3 text-sm">{error}</div>}
          <button className="btn w-full" disabled={busy}>{busy ? 'Signing in…' : 'Sign in to workspace'}</button>
        </form>
      </section>
    </main>
  )
}
