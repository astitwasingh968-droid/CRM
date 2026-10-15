import './globals.css'

export const metadata = {
  title: 'AgencyFlow CRM',
  description: 'Multi-client CRM and client portal for agency operations'
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en"><body>{children}</body></html>
}
