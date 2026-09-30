import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { Cinzel, Inter } from 'next/font/google';
import { AuthProvider } from '@/components/providers/auth-provider';
import { PwaProvider } from '@/components/pwa/pwa-provider';
import { THEME_COLORS, themeInitScript } from '@/lib/theme';
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
  applicationName: 'Coleção Bíblica',
  title: 'Coleção Bíblica',
  description: 'Aprenda sobre a Bíblia jogando quizzes, colecionando figurinhas e subindo no ranking.',
  appleWebApp: {
    capable: true,
    title: 'Coleção Bíblica',
    statusBarStyle: 'default',
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: [
      { url: '/icons/favicon-32.png', sizes: '32x32', type: 'image/png' },
      { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
    ],
    apple: [{ url: '/icons/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  // Permite desenhar sob o notch/barras no app instalado; o CSS compensa com safe-area.
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: THEME_COLORS.light },
    { media: '(prefers-color-scheme: dark)', color: THEME_COLORS.dark },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body suppressHydrationWarning className={`${bodyFont.variable} ${headingFont.variable}`}>
        <AuthProvider>
          <PwaProvider>{children}</PwaProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
