import Link from "next/link";
import { Button } from "@/components/ui";

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-40 border-b border-ink-800 bg-ink-950/80 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <Link href="/" className="text-lg font-bold tracking-tight">
            Adventure <span className="text-brand-500">AI</span>
          </Link>
          <nav className="flex items-center gap-6 text-sm text-ink-100">
            <Link href="/#pricing" className="hover:text-white">Pricing</Link>
            <Link href="/#faq" className="hover:text-white">FAQ</Link>
            <Link href="/login">
              <Button size="sm">Start free</Button>
            </Link>
          </nav>
        </div>
      </header>
      {children}
      <footer className="border-t border-ink-800 py-10 text-center text-sm text-ink-400">
        © {new Date().getFullYear()} Adventure AI ·{" "}
        <a href="https://adventure-ai.in" className="hover:text-white underline underline-offset-2">
          adventure-ai.in
        </a>
      </footer>
    </div>
  );
}
