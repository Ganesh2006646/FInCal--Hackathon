import './globals.css';

export const metadata = {
  title: 'Life-Proof Retirement Calculator | HDFC Mutual Fund',
  description:
    'Smart retirement planning for real life - healthcare, family, and flexible income.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
