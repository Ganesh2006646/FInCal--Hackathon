import './globals.css';

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://fin-cal-hackathon.vercel.app';

export const metadata = {
  title: 'Life-Proof Retirement Calculator | HDFC Mutual Fund',
  description:
    'Smart retirement planning for real life — healthcare costs, geo-arbitrage, step-up SIP, and flexible income in one plan.',
  icons: {
    icon: [
      { url: '/icon.svg', type: 'image/svg+xml' },
    ],
    shortcut: '/icon.svg',
    apple: '/icon.svg',
  },
  openGraph: {
    title: 'Life-Proof Retirement Calculator | HDFC Mutual Fund',
    description: 'Start with ₹8,500/month — not ₹26,000. Real-life retirement planning with healthcare, geo-arbitrage, and step-up SIP.',
    url: BASE_URL,
    siteName: 'HDFC Mutual Fund Investor Education',
    images: [
      {
          url: `${BASE_URL}/og-image.svg`,
        width: 1200,
        height: 630,
        alt: 'Life-Proof Retirement Calculator — HDFC Mutual Fund',
      },
    ],
    locale: 'en_IN',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Life-Proof Retirement Calculator | HDFC Mutual Fund',
    description: 'Start with ₹8,500/month — not ₹26,000. Real-life retirement planning.',
     images: [`${BASE_URL}/og-image.svg`],
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
