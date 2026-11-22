import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { MobileNav } from "@/components/layout/mobile-nav";
import { QuickAddButton, QuickAddProvider } from "@/components/layout/quick-add-command-dialog";
import { Sidebar } from "@/components/layout/sidebar";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Finance",
  description: "Personal finance & portfolio tracker",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full bg-muted/30">
        <QuickAddProvider>
          <div className="flex min-h-svh">
            <Sidebar />
            <div className="flex min-w-0 flex-1 flex-col">
              <header className="sticky top-0 z-30 flex h-14 items-center justify-end gap-2 border-b bg-background/90 px-4 backdrop-blur md:px-8">
                <QuickAddButton />
              </header>
              <main className="mx-auto w-full max-w-6xl flex-1 px-4 pt-6 pb-24 md:px-8 md:pb-10">{children}</main>
            </div>
          </div>
          <MobileNav />
          <Toaster richColors position="top-right" />
        </QuickAddProvider>
      </body>
    </html>
  );
}
