import type { Metadata } from "next";
import { Figtree, Fraunces } from "next/font/google";
import { getI18n } from "@/lib/i18n/server";
import "./globals.css";

const displayFont = Fraunces({
  axes: ["opsz", "SOFT"],
  display: "swap",
  subsets: ["latin"],
  variable: "--font-display"
});

const bodyFont = Figtree({
  display: "swap",
  subsets: ["latin"],
  variable: "--font-body"
});

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();

  return {
    title: t.meta.title,
    description: t.meta.description,
    icons: {
      icon: "/icon.svg"
    }
  };
}

export default async function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  const { locale, t } = await getI18n();

  return (
    <html className={`${displayFont.variable} ${bodyFont.variable}`} lang={locale}>
      <body>
        <a className="skip-link" href="#main-content">
          {t.nav.skip}
        </a>
        {children}
      </body>
    </html>
  );
}
