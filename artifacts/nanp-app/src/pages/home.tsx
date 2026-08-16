import React, { useState, useEffect } from 'react';
import {
  useGetDiseaseOptions,
  useGetRouteOptions,
  useGetFormulationDetail,
  matchCarriers,
} from '@workspace/api-client-react';
import { useQuery } from '@tanstack/react-query';
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
            {data.formulation_name}
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
                {m.canonical_name ?? m.abbreviation ?? m.material_id}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Experimental evidence from arms */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="border-emerald-200 bg-emerald-50/50 shadow-none">
          <CardHeader className="pb-3 pt-4 px-4">
            <CardTitle className="flex items-center gap-2 text-base text-emerald-800">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              Experimental Arms
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            {data.arms.length > 0 ? (
              <ul className="space-y-2.5">
                {data.arms.map((arm, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-emerald-900">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5 shrink-0" />
                    {arm.administration_route ?? 'Route unknown'}{arm.disease_model ? ` — ${arm.disease_model}` : ''}
                  </li>
                ))}
              </ul>
            ) : (
              <div className="flex flex-col gap-1">
                <p className="text-sm font-medium text-muted-foreground">No experimental arms</p>
                <p className="text-xs text-muted-foreground/70">No in-vivo or in-vitro arms recorded for this formulation.</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-sky-200 bg-sky-50/50 shadow-none">
          <CardHeader className="pb-3 pt-4 px-4">
            <CardTitle className="flex items-center gap-2 text-base text-sky-800">
              <AlertCircle className="h-4 w-4 text-sky-600" />
              Cargo Types
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            {data.cargos.length > 0 ? (
              <ul className="space-y-2.5">
                {data.cargos.map((c, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-sky-900">
                    <span className="w-1.5 h-1.5 rounded-full bg-sky-500 mt-1.5 shrink-0" />
                    {c.canonical_name ?? c.cargo_id}{c.cargo_type ? ` (${c.cargo_type})` : ''}
                  </li>
                ))}
              </ul>
            ) : (
              <div className="flex flex-col gap-1">
                <p className="text-sm font-medium text-muted-foreground">No cargo data</p>
                <p className="text-xs text-muted-foreground/70">No cargo entries linked to this formulation.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Supporting paper */}
      {data.paper && (
        <div>
          <h3 className="flex items-center gap-2 text-xs font-semibold tracking-wider text-muted-foreground uppercase mb-3">
            <BookOpen className="h-3.5 w-3.5" />
            Source Literature
          </h3>
          <div className="space-y-2">
            <div className="rounded-lg border border-border bg-muted/30 px-4 py-3 text-sm">
              <p className="font-medium text-foreground leading-snug">
                {data.paper.title ?? 'Untitled'}
              </p>
              <p className="text-muted-foreground mt-1 text-xs">
                {[data.paper.authors_text, data.paper.journal, data.paper.publication_year, data.paper.doi ? `DOI: ${data.paper.doi}` : null]
                  .filter(Boolean)
                  .join(' · ')}
              </p>
            </div>
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

  const { data: diseasesData, isLoading: loadingDiseases } = useGetDiseaseOptions();
  const { data: routesData, isLoading: loadingRoutes } = useGetRouteOptions(
    disease ? { disease } : undefined
  );
  const { data: matchData, isLoading: loadingFormulations } = useQuery({
    queryKey: ['carriers-match', disease, route],
    queryFn: () => matchCarriers({ disease: disease || undefined, route: route || undefined }),
    enabled: !!disease && !!route,
  });

  const diseases = diseasesData?.values ?? [];
  const routes = routesData?.values ?? [];
  const formulations = matchData?.items ?? [];

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
              values={formulations.map((f) => f.formulation_name ?? f.formulation_id)}
              selected={formulationName}
              onSelect={(name) => {
                const match = formulations.find((f) => (f.formulation_name ?? f.formulation_id) === name);
                setFormulationName(name);
                setFormulationId(match?.formulation_id ?? '');
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

      </main>
    </div>
  );
}
