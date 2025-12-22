import type { Metadata } from "next";
import { Tangerine, Inter } from "next/font/google";
import "./globals.css";

const tangerine = Tangerine({
  weight: ['400', '700'],
  subsets: ["latin"],
  variable: '--font-tangerine',
});

const inter = Inter({
  subsets: ["latin"],
  variable: '--font-inter',
});

export const metadata: Metadata = {
  title: "Odessa Symphony Guild | Supporting the Arts in West Texas Since 1958",
  description: "For over six decades, we have supported the West Texas Symphony, bringing world-class music, culture, and educational opportunities to our community.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${tangerine.variable} ${inter.variable}`}>
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
