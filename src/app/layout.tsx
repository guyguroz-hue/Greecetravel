import type { Metadata, Viewport } from 'next';
import './globals.css';
import { Providers } from '@/components/layout/Providers';

export const metadata: Metadata = {
  title: 'My Trip Planner',
  description:
    'ניהול ותכנון טיולים בחו״ל — מסלול יומי, מפה, מלונות, טיסות, רכב, מסמכים ותקציב, במקום אחד.',
  applicationName: 'My Trip Planner',
  manifest: '/manifest.webmanifest',
  appleWebApp: { capable: true, statusBarStyle: 'default', title: 'Trip Planner' },
  icons: {
    icon: [{ url: '/icon.svg', type: 'image/svg+xml' }],
    apple: [{ url: '/icon-180.png' }],
  },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f6f7f9' },
    { media: '(prefers-color-scheme: dark)', color: '#0c0f16' },
  ],
};

/**
 * The saved theme is applied before first paint so a dark-mode user never sees
 * a white flash on load.
 */
const THEME_BOOTSTRAP = `
try {
  var s = JSON.parse(localStorage.getItem('mtp:settings:v1') || '{}');
  if (s.theme === 'dark' || s.theme === 'light') {
    document.documentElement.setAttribute('data-theme', s.theme);
  }
} catch (e) {}
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="he" dir="rtl" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOTSTRAP }} />
      </head>
      <body className="min-h-dvh antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
