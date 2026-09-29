import type { ReactNode } from 'react';
import { Link, useLocation } from 'wouter';
import { BookOpen, FlaskConical } from 'lucide-react';

export default function Layout({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return (
    <div className="flex min-h-[100dvh] flex-col scientific-grid">
      <header className="sticky top-0 z-20 border-b border-border/60 bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-5 py-3 sm:px-8">
          <Link href="/" className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground"><FlaskConical className="h-4 w-4" /></span>
            <span className="font-serif text-lg font-semibold">NANP Carrier Finder</span>
          </Link>
          <nav aria-label="Primary navigation" className="flex items-center gap-1 text-base">
            <Link href="/" className={`rounded-md px-3 py-2 ${location === '/' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`}>Find carriers</Link>
            <Link href="/browse" className={`inline-flex items-center gap-1.5 rounded-md px-3 py-2 ${location === '/browse' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`}><BookOpen className="h-4 w-4" /> All sheet records</Link>
          </nav>
        </div>
      </header>
      <main className="w-full flex-1">{children}</main>
      <footer className="border-t border-border/60 bg-background/80 px-5 py-5 text-sm text-muted-foreground sm:px-8">
        <p className="mx-auto max-w-6xl">Scientific text comes exclusively from the supplied Google Sheet. Text matches are not a clinical recommendation.</p>
      </footer>
    </div>
  );
}