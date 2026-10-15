import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  const auth = request.headers.get('authorization')
  const token = auth?.replace('Bearer ', '')
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${token}` } } }
  )

  const { data: { user } } = await db.auth.getUser(token)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await db.from('profiles').select('role').eq('id', user.id).single()
  if (!profile || !['super_admin', 'brand_employee'].includes(profile.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await request.json()
  const { to, subject, message } = body as { to?: string; subject?: string; message?: string }
  if (!to || !subject || !message) {
    return NextResponse.json({ error: 'to, subject and message are required' }, { status: 400 })
  }

  if (!process.env.RESEND_API_KEY) {
    return NextResponse.json({ sent: false, configured: false, message: 'Email provider is not configured.' })
  }

  const result = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from: process.env.NOTIFICATION_FROM_EMAIL || 'AgencyFlow <onboarding@resend.dev>',
      to: [to],
      subject,
      html: `<div style="font-family:Arial,sans-serif;line-height:1.6"><h2>${escapeHtml(subject)}</h2><p>${escapeHtml(message)}</p></div>`
    })
  })

  if (!result.ok) {
    return NextResponse.json({ error: 'Email provider rejected the request' }, { status: 502 })
  }

  return NextResponse.json({ sent: true, configured: true })
}

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char] || char))
}
