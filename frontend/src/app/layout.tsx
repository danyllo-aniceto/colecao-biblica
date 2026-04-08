import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { Cinzel, Inter } from 'next/font/google';
import { AuthProvider } from '@/components/providers/auth-provider';
import './globals.css';

const bodyFont = Inter({
  subsets: ['latin'],
  variable: '--font-body',
});

const headingFont = Cinzel({
  subsets: ['latin'],
  variable: '--font-heading',
});

export const metadata: Metadata = {
  title: 'Coleção Bíblica',
  description: 'Frontend da aplicação Coleção Bíblica',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body className={`${bodyFont.variable} ${headingFont.variable}`}>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
