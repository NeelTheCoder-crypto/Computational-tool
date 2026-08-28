import React from 'react';
import { Link, useLocation } from 'wouter';
import { useGetDatabaseStats } from '@workspace/api-client-react';
import { Database, Search, Layers } from 'lucide-react';
import { cn } from '@/lib/utils';

function StatPill({ label, value }: { label: string; value?: number }) {
  return (
    <div className="flex flex-col items-end leading-none">
      <span className="font-mono text-sm font-semibold text-foreground tabular-nums">
        {value ?? '—'}
      </span>
      <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
    </div>
  );
}

function NavLink({
  href,
  active,
  icon: Icon,
  children,
}: {
  href: string;
  active: boolean;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={cn(
        'flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
        active
          ? 'bg-primary text-primary-foreground'
          : 'text-muted-foreground hover:bg-muted hover:text-foreground'
      )}
    >
      <Icon className="h-4 w-4" />
      {children}
    </Link>
  );
}

export default function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { data: stats } = useGetDatabaseStats();

  const isDatabase = location.startsWith('/explore');
  const isDiscover = location === '/' || location.startsWith('/formulation');

  return (
    <div className="min-h-[100dvh] w-full flex flex-col scientific-grid">
      <header className="w-full border-b border-border/50 bg-background/80 backdrop-blur-md sticky top-0 z-20">
        <div className="max-w-6xl mx-auto w-full px-6 py-3 flex items-center gap-4">
          <Link href="/" className="flex items-center gap-3 shrink-0">
            <div className="w-8 h-8 rounded bg-primary flex items-center justify-center text-primary-foreground">
              <Database size={18} />
            </div>
            <div className="hidden sm:block">
              <h1 className="text-base font-serif font-semibold tracking-tight text-foreground leading-none">
                NANP Carrier Selection
              </h1>
              <p className="text-[10px] text-muted-foreground font-mono uppercase tracking-wider mt-0.5">
                Delivery Database
              </p>
            </div>
          </Link>

          <nav className="flex items-center gap-1 ml-2">
            <NavLink href="/" active={isDiscover} icon={Search}>
              Discover
            </NavLink>
            <NavLink href="/explore/materials" active={isDatabase} icon={Layers}>
              Database
            </NavLink>
          </nav>

          <div className="hidden md:flex items-center gap-5 ml-auto">
            <StatPill label="Papers" value={stats?.total_papers} />
            <StatPill label="Formulations" value={stats?.total_formulations} />
            <StatPill label="Materials" value={stats?.total_materials} />
            <StatPill label="Experiments" value={stats?.total_experiments} />
            <StatPill label="Outcomes" value={stats?.total_biological_outcomes} />
          </div>
        </div>
      </header>

      <main className="flex-1 w-full">{children}</main>

      <footer className="w-full border-t border-border/50 py-4 px-6">
        <p className="max-w-6xl mx-auto text-xs text-muted-foreground">
          Every value shown is drawn directly from the research delivery database. No
          synthetic data.
        </p>
      </footer>
    </div>
  );
}
