import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { ThemeProvider } from '@/lib/theme'
import { ThemeSwitch } from '@/components/ThemeSwitch'
import { GlassSpotlight } from '@/components/GlassSpotlight'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'MagicBee',
  description: 'Plataforma de agendamiento para negocios de servicios',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className={inter.className}>
        <ThemeProvider>
          {children}
          <ThemeSwitch />
          <GlassSpotlight />
        </ThemeProvider>
      </body>
    </html>
  )
}
