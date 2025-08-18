// src/app/layout.tsx
import './globals.css'
import type { Metadata } from 'next'
import { Noto_Sans_Thai, Kanit, Geist_Mono } from 'next/font/google'

const body = Noto_Sans_Thai({
  subsets: ['thai', 'latin'],
  weight: ['300', '400', '500', '700'],
  variable: '--font-body',
  display: 'swap',
})

const heading = Kanit({
  subsets: ['thai', 'latin'],
  weight: ['600', '700'],
  variable: '--font-heading',
  display: 'swap',
})

const mono = Geist_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
})

export const metadata: Metadata = {
  title: 'Hospital Web Application',
  description: 'Code for the hospital web application',
}

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="th" className={`h-full ${body.variable} ${heading.variable} ${mono.variable}`}>
      <body className="antialiased h-full">
        <div className="flex flex-col h-full">
          {children}
        </div>
      </body>
    </html>
  )
}