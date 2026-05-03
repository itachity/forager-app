import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ToastProvider } from "@/components/forager/ToastProvider";
import { I18nProvider } from "@/lib/forager-i18n-context";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Forager — discover your next food adventure",
  description:
    "Hidden food gems tailored to your taste, goals, and mood. Snap a meal or translate a menu in any language.",
  icons: {
    icon: "/icon.png",
    apple: "/icon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable}`}
      style={{ ["--font-sans" as string]: "var(--font-geist-sans)" }}
    >
      <body
        className="min-h-screen bg-background text-foreground"
        suppressHydrationWarning
      >
        <I18nProvider>
          <ToastProvider>{children}</ToastProvider>
        </I18nProvider>
      </body>
    </html>
  );
}
