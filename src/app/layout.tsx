import type { Metadata } from 'next';
import localFont from 'next/font/local';
import './globals.css';

const bodyFont = localFont({
  src: [
    { path: '../../public/assets/type-0.ttf', weight: '400', style: 'normal' },
    { path: '../../public/assets/type-1.ttf', weight: '500', style: 'normal' },
    { path: '../../public/assets/type-2.ttf', weight: '600', style: 'normal' },
    { path: '../../public/assets/type-3.ttf', weight: '700', style: 'normal' },
  ],
  variable: '--font-body',
  display: 'swap',
});
const headingFont = localFont({
  src: [
    { path: '../../public/assets/type-5.ttf', weight: '400', style: 'normal' },
    { path: '../../public/assets/type-6.ttf', weight: '500', style: 'normal' },
    { path: '../../public/assets/type-4.ttf', weight: '400', style: 'italic' },
  ],
  variable: '--font-heading',
  display: 'swap',
});

export const metadata: Metadata = {
  title: { default: 'Saffron & Ember — Food made with feeling', template: '%s | Saffron & Ember' },
  description:
    'Seasonal flavours, a little open fire, and good company. Explore the Saffron & Ember restaurant concept.',
  icons: { icon: '/assets/favicon.svg', apple: '/assets/favicon.svg' },
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${bodyFont.variable} ${headingFont.variable}`}>
        <a
          href="#main-content"
          className="sr-only fixed left-4 top-4 z-[100] rounded-lg bg-foreground px-5 py-3 text-sm text-background focus:not-sr-only"
        >
          Skip to content
        </a>
        {children}
      </body>
    </html>
  );
}
