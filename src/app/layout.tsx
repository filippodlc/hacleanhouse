import { AuthBridge } from "@/components/auth-bridge";
import { MainNav } from "@/components/main-nav";
import { ThemeBridge } from "@/components/theme-bridge";
import { ThemeProvider } from "@/components/theme-provider";
import { ThemeToggle } from "@/components/theme-toggle";
import { Toaster } from "@/components/ui/sonner";
import { env } from "@/lib/env";
import type { Metadata } from "next";
import { Geist_Mono, Roboto } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const roboto = Roboto({
  variable: "--font-roboto",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "HaCleanHouse",
  description: "Gestione pulizie domestiche integrata con Home Assistant",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="it"
      suppressHydrationWarning
      className={`${roboto.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <ThemeProvider>
          <AuthBridge allowedOrigins={env.allowedParentOrigins} />
          <ThemeBridge />
          <header className="sticky top-0 z-30 border-b bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-4 py-3">
              <Link
                href="/"
                className="flex items-center gap-2 font-heading font-semibold tracking-tight"
              >
                <span>
                  Clean<span className="text-primary">House</span>
                </span>
              </Link>
              <div className="flex items-center gap-1">
                <MainNav />
                <ThemeToggle />
              </div>
            </div>
          </header>
          <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6">{children}</main>
          <Toaster richColors position="top-center" />
        </ThemeProvider>
      </body>
    </html>
  );
}
