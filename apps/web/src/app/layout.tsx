import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'LEAD UPAO – Liga Estudiantil de Alto Desarrollo',
  description:
    'Organización de liderazgo estudiantil comprometida con el crecimiento personal, profesional y el impacto en la comunidad de la Universidad Privada Antenor Orrego.',
  openGraph: {
    title: 'LEAD UPAO',
    description: 'Liderando el futuro universitario.',
    siteName: 'LEAD UPAO',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className={`${inter.className} antialiased`}>{children}</body>
    </html>
  )
}
