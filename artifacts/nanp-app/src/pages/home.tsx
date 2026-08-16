import React, { useState, useEffect } from 'react';
import {
  useGetDiseaseOptions,
  useGetRouteOptions,
  useGetFormulationOptions,
  useGetFormulationDetail,
  useGetDatabaseStats,
} from '@workspace/api-client-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Database,
  FileText,
  FlaskConical,
  Beaker,
  Activity,
  ChevronsUpDown,
  Check,
  CheckCircle2,
  AlertCircle,
  BookOpen,
  Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ── Combobox ──────────────────────────────────────────────────────────────────

interface ComboboxProps {
  label: string;
  placeholder: string;
  searchPlaceholder: string;
  values: string[];
  selected: string;
  onSelect: (value: string) => void;
  disabled?: boolean;
  isLoading?: boolean;
  step: number;
}

function Combobox({
  label,
  placeholder,
  searchPlaceholder,
  values,
  selected,
  onSelect,
  disabled,
  isLoading,
  step,
}: ComboboxProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <span
          className={cn(
            'w-6 h-6 rounded-full text-xs font-bold flex items-center justify-center shrink-0 transition-colors',
            selected
              ? 'bg-primary text-primary-foreground'
              : disabled
              ? 'bg-muted text-muted-foreground'
              : 'bg-primary/10 text-primary'
          )}
        >
          {selected ? <Check className="w-3.5 h-3.5" /> : step}
        </span>
        <label className="text-sm font-semibold text-foreground">{label}</label>
      </div>

      <Popover open={open && !disabled} onOpenChange={(v) => !disabled && setOpen(v)}>
        <PopoverTrigger asChild>
          <button
            role="combobox"
            aria-expanded={open}
            disabled={disabled || isLoading}
            className={cn(
              'flex h-11 w-full items-center justify-between rounded-lg border px-4 py-2 text-sm transition-colors',
              'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
              disabled
                ? 'border-border/40 bg-muted/30 text-muted-foreground cursor-not-allowed opacity-60'
                : selected
                ? 'border-primary/30 bg-primary/5 text-foreground font-medium'
                : 'border-input bg-background text-muted-foreground hover:border-primary/50'
            )}
          >
            <span className="truncate">
              {isLoading
                ? 'Loading…'
                : selected || placeholder}
            </span>
            {isLoading ? (
              <Loader2 className="ml-2 h-4 w-4 shrink-0 animate-spin opacity-50" />
            ) : (
              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            )}
          </button>
        </PopoverTrigger>
        <PopoverContent
          className="w-[var(--radix-popover-trigger-width)] p-0"
          align="start"
        >
          <Command>
            <CommandInput placeholder={searchPlaceholder} />
            <CommandList>
              <CommandEmpty className="px-4 py-3 text-sm text-muted-foreground">
                No matches found in database.
              </CommandEmpty>
              <CommandGroup>
                {values.map((v) => (
                  <CommandItem
                    key={v}
                    value={v}
                    onSelect={(current) => {
                      onSelect(current === selected ? '' : current);
                      setOpen(false);
                    }}
                  >
                    <Check
                      className={cn(
                        'mr-2 h-4 w-4',
                        selected === v ? 'opacity-100' : 'opacity-0'
                      )}
                    />
                    {v}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}

// ── Detail panel ──────────────────────────────────────────────────────────────

function DetailPanel({ formulationId }: { formulationId: string }) {
  const { data, isLoading } = useGetFormulationDetail(formulationId);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground gap-2">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span className="text-sm">Loading formulation data…</span>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-6 pt-2">
      {/* Formulation header */}
      <div className="flex items-start gap-3 flex-wrap">
        <div className="flex-1 min-w-0">
          <h2 className="text-2xl font-serif font-medium text-foreground leading-tight">
            {data.name}
          </h2>
          <div className="flex flex-wrap gap-2 mt-2">
            {data.carrier_family && (
              <Badge variant="secondary" className="font-mono text-xs">
                {data.carrier_family}
              </Badge>
            )}
            {data.carrier_subtype && (
              <Badge variant="outline" className="font-mono text-xs">
                {data.carrier_subtype}
              </Badge>
            )}
          </div>
        </div>
      </div>

      {/* Materials */}
      {data.materials.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold tracking-wider text-muted-foreground uppercase mb-2">
            Composition
          </h3>
          <div className="flex flex-wrap gap-2">
            {data.materials.map((m, i) => (
              <span
                key={i}
                className="px-2.5 py-1 rounded-md bg-muted text-xs text-foreground font-mono"
              >
                {m}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Advantages & Limitations */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="border-emerald-200 bg-emerald-50/50 shadow-none">
          <CardHeader className="pb-3 pt-4 px-4">
            <CardTitle className="flex items-center gap-2 text-base text-emerald-800">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              Advantages
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            {data.advantages.length > 0 ? (
              <ul className="space-y-2.5">
                {data.advantages.map((adv, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-emerald-900">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5 shrink-0" />
                    {adv}
                  </li>
                ))}
              </ul>
            ) : (
              <div className="flex flex-col gap-1">
                <p className="text-sm font-medium text-muted-foreground">
                  No records in database
                </p>
                <p className="text-xs text-muted-foreground/70">
                  This formulation has no advantage or mechanism entries extracted from the literature yet.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-rose-200 bg-rose-50/50 shadow-none">
          <CardHeader className="pb-3 pt-4 px-4">
            <CardTitle className="flex items-center gap-2 text-base text-rose-800">
              <AlertCircle className="h-4 w-4 text-rose-600" />
              Limitations
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            {data.limitations.length > 0 ? (
              <ul className="space-y-2.5">
                {data.limitations.map((lim, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-rose-900">
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-500 mt-1.5 shrink-0" />
                    {lim}
                  </li>
                ))}
              </ul>
            ) : (
              <div className="flex flex-col gap-1">
                <p className="text-sm font-medium text-muted-foreground">
                  No records in database
                </p>
                <p className="text-xs text-muted-foreground/70">
                  This formulation has no limitation entries extracted from the literature yet.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Supporting papers */}
      {data.papers.length > 0 && (
        <div>
          <h3 className="flex items-center gap-2 text-xs font-semibold tracking-wider text-muted-foreground uppercase mb-3">
            <BookOpen className="h-3.5 w-3.5" />
            Source Literature
          </h3>
          <div className="space-y-2">
            {data.papers.map((p, i) => (
              <div
                key={i}
                className="rounded-lg border border-border bg-muted/30 px-4 py-3 text-sm"
              >
                <p className="font-medium text-foreground leading-snug">
                  {p.title ?? 'Untitled'}
                </p>
                <p className="text-muted-foreground mt-1 text-xs">
                  {[p.authors, p.journal, p.year, p.doi ? `DOI: ${p.doi}` : null]
                    .filter(Boolean)
                    .join(' · ')}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function Home() {
  const [disease, setDisease] = useState('');
  const [route, setRoute] = useState('');
  const [formulationId, setFormulationId] = useState('');
  const [formulationName, setFormulationName] = useState('');

  // Reset downstream selections when upstream changes
  useEffect(() => { setRoute(''); setFormulationId(''); setFormulationName(''); }, [disease]);
  useEffect(() => { setFormulationId(''); setFormulationName(''); }, [route]);

  const { data: stats } = useGetDatabaseStats();
  const { data: diseasesData, isLoading: loadingDiseases } = useGetDiseaseOptions();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: routesData, isLoading: loadingRoutes } = useGetRouteOptions(
    { disease: disease || undefined },
    { query: { enabled: !!disease } as any }
  );
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: formulationsData, isLoading: loadingFormulations } = useGetFormulationOptions(
    { disease, route },
    { query: { enabled: !!disease && !!route } as any }
  );

  const diseases = diseasesData?.values ?? [];
  const routes = routesData?.values ?? [];
  const formulations = formulationsData?.formulations ?? [];

  return (
    <div className="min-h-[100dvh] w-full flex flex-col scientific-grid">
      {/* Header */}
      <header className="w-full py-5 px-8 border-b border-border/50 bg-background/80 backdrop-blur-md sticky top-0 z-10 flex items-center gap-3">
        <div className="w-8 h-8 rounded bg-primary flex items-center justify-center text-primary-foreground shrink-0">
          <Database size={18} />
        </div>
        <div>
          <h1 className="text-xl font-serif font-semibold tracking-tight text-foreground">
            NANP Carrier Selection
          </h1>
          <p className="text-xs text-muted-foreground font-mono uppercase tracking-wider">
            Research Platform
          </p>
        </div>
      </header>

      {/* Main */}
      <main className="flex-1 w-full max-w-3xl mx-auto px-6 py-12 space-y-10">
        <div className="text-center space-y-3">
          <h2 className="text-4xl font-serif font-medium text-foreground leading-tight">
            Find the right carrier.
          </h2>
          <p className="text-muted-foreground max-w-lg mx-auto">
            Select a disease, then a delivery route, then a formulation. Every value
            and result comes directly from the research database.
          </p>
        </div>

        {/* Cascading selectors */}
        <Card className="shadow-xl shadow-primary/5 border-border/60 bg-background/95 backdrop-blur">
          <CardContent className="p-6 space-y-5">
            <Combobox
              step={1}
              label="Target Disease"
              placeholder="Select a disease model…"
              searchPlaceholder="Search diseases…"
              values={diseases}
              selected={disease}
              onSelect={setDisease}
              isLoading={loadingDiseases}
            />

            <Combobox
              step={2}
              label="Route of Administration"
              placeholder={disease ? 'Select a route…' : 'Select a disease first'}
              searchPlaceholder="Search routes…"
              values={routes}
              selected={route}
              onSelect={setRoute}
              disabled={!disease}
              isLoading={!!disease && loadingRoutes}
            />

            <Combobox
              step={3}
              label="Formulation"
              placeholder={
                !disease
                  ? 'Select a disease first'
                  : !route
                  ? 'Select a route first'
                  : 'Select a formulation…'
              }
              searchPlaceholder="Search formulations…"
              values={formulations.map((f) => f.name)}
              selected={formulationName}
              onSelect={(name) => {
                const match = formulations.find((f) => f.name === name);
                setFormulationName(name);
                setFormulationId(match?.id ?? '');
              }}
              disabled={!disease || !route}
              isLoading={!!disease && !!route && loadingFormulations}
            />
          </CardContent>
        </Card>

        {/* Detail panel */}
        {formulationId && (
          <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
            <DetailPanel formulationId={formulationId} />
          </div>
        )}

        {/* Stats ticker */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 border-t border-border/50 pt-8 mt-8">
            {[
              { icon: FileText, label: 'Papers', value: stats.total_papers },
              { icon: FlaskConical, label: 'Formulations', value: stats.total_formulations },
              { icon: Beaker, label: 'Materials', value: stats.total_materials },
              { icon: Database, label: 'Experiments', value: stats.total_experiments },
              { icon: Activity, label: 'Outcomes', value: stats.total_biological_outcomes },
            ].map(({ icon: Icon, label, value }) => (
              <div key={label} className="flex flex-col items-center text-center p-2">
                <Icon className="text-muted-foreground mb-2 h-5 w-5" />
                <span className="text-2xl font-serif text-foreground">{value.toLocaleString()}</span>
                <span className="text-xs text-muted-foreground uppercase tracking-wider mt-1">{label}</span>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
