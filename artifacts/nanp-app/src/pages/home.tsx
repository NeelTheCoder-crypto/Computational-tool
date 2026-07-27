import React, { useState } from 'react';
import {
  useGetCargoOptions,
  useGetDiseaseOptions,
  useGetRouteOptions,
  useGetDatabaseStats,
} from '@workspace/api-client-react';
import { useQueryContext } from '../context/QueryContext';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Database, FileText, FlaskConical, Beaker, Activity, ChevronsUpDown, Check, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

// ── Searchable combobox ────────────────────────────────────────────────────────

interface ComboboxProps {
  label: string;
  placeholder: string;
  searchPlaceholder: string;
  values: string[];
  selected: string;
  onSelect: (value: string) => void;
  isLoading: boolean;
  isEmpty: boolean;         // true when DB returned 0 values (no hardcoded fallback)
}

function Combobox({
  label,
  placeholder,
  searchPlaceholder,
  values,
  selected,
  onSelect,
  isLoading,
  isEmpty,
}: ComboboxProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="space-y-3">
      <label className="text-sm font-medium text-foreground block">{label}</label>

      {isEmpty ? (
        <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-800">
          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
          <span>No formulations currently exist for this selection.</span>
        </div>
      ) : (
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <button
              role="combobox"
              aria-expanded={open}
              disabled={isLoading}
              className={cn(
                'flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background',
                'placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
                'disabled:cursor-not-allowed disabled:opacity-50',
                !selected && 'text-muted-foreground',
              )}
            >
              <span className="truncate">{selected || (isLoading ? 'Loading…' : placeholder)}</span>
              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
            <Command>
              <CommandInput placeholder={searchPlaceholder} />
              <CommandList>
                <CommandEmpty className="px-4 py-3 text-sm text-muted-foreground">
                  No matching values found in database.
                </CommandEmpty>
                <CommandGroup>
                  {values.map((v) => (
                    <CommandItem
                      key={v}
                      value={v}
                      onSelect={(currentValue) => {
                        onSelect(currentValue === selected ? '' : currentValue);
                        setOpen(false);
                      }}
                    >
                      <Check
                        className={cn('mr-2 h-4 w-4', selected === v ? 'opacity-100' : 'opacity-0')}
                      />
                      {v}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function Home() {
  const [, setLocation] = useLocation();
  const { setQuery } = useQueryContext();

  const { data: stats } = useGetDatabaseStats();
  const { data: cargosData, isLoading: loadingCargos } = useGetCargoOptions();
  const { data: diseasesData, isLoading: loadingDiseases } = useGetDiseaseOptions();
  const { data: routesData, isLoading: loadingRoutes } = useGetRouteOptions();

  const cargos = cargosData?.values ?? [];
  const diseases = diseasesData?.values ?? [];
  const routes = routesData?.values ?? [];

  // Only empty once loading is done and DB genuinely has no data
  const cargosEmpty = !loadingCargos && cargos.length === 0;
  const diseasesEmpty = !loadingDiseases && diseases.length === 0;
  const routesEmpty = !loadingRoutes && routes.length === 0;

  const [nucleicAcid, setNucleicAcid] = useState('');
  const [disease, setDisease] = useState('');
  const [route, setRoute] = useState('');

  const isReady = nucleicAcid && disease && route;

  const handleAnalyze = () => {
    if (isReady) {
      setQuery({ nucleic_acid: nucleicAcid, disease, route_of_administration: route });
      setLocation('/results');
    }
  };

  return (
    <div className="min-h-[100dvh] w-full flex flex-col scientific-grid">
      {/* Header */}
      <header className="w-full py-6 px-8 border-b border-border/50 bg-background/80 backdrop-blur-md sticky top-0 z-10 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded bg-primary flex items-center justify-center text-primary-foreground">
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
        </div>
      </header>

      {/* Main */}
      <main className="flex-1 flex flex-col items-center justify-center p-6 w-full max-w-5xl mx-auto">
        <div className="text-center mb-12 max-w-2xl">
          <h2 className="text-4xl md:text-5xl font-serif text-foreground font-medium leading-tight mb-6">
            Identify optimal nucleic acid delivery carriers.
          </h2>
          <p className="text-lg text-muted-foreground">
            A precision scientific decision-support tool. Enter your therapeutic target to receive
            AI-synthesized carrier recommendations backed by peer-reviewed literature.
          </p>
        </div>

        <Card className="w-full max-w-3xl shadow-xl shadow-primary/5 border-border/60 bg-background/95 backdrop-blur">
          <CardContent className="p-8">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Combobox
                label="Nucleic Acid Type"
                placeholder="Select type…"
                searchPlaceholder="Search nucleic acids…"
                values={cargos}
                selected={nucleicAcid}
                onSelect={setNucleicAcid}
                isLoading={loadingCargos}
                isEmpty={cargosEmpty}
              />
              <Combobox
                label="Target Disease"
                placeholder="Select disease…"
                searchPlaceholder="Search diseases…"
                values={diseases}
                selected={disease}
                onSelect={setDisease}
                isLoading={loadingDiseases}
                isEmpty={diseasesEmpty}
              />
              <Combobox
                label="Route of Administration"
                placeholder="Select route…"
                searchPlaceholder="Search routes…"
                values={routes}
                selected={route}
                onSelect={setRoute}
                isLoading={loadingRoutes}
                isEmpty={routesEmpty}
              />
            </div>

            <div className="mt-8 flex justify-end">
              <Button
                onClick={handleAnalyze}
                disabled={!isReady}
                size="lg"
                className="w-full md:w-auto font-medium"
              >
                Synthesize Recommendation
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Database stats ticker */}
        {stats && (
          <div className="mt-16 w-full max-w-4xl grid grid-cols-2 md:grid-cols-5 gap-4 border-t border-border/50 pt-8">
            <div className="flex flex-col items-center justify-center text-center p-2">
              <FileText className="text-muted-foreground mb-2 h-5 w-5" />
              <span className="text-2xl font-serif text-foreground">{stats.total_papers.toLocaleString()}</span>
              <span className="text-xs text-muted-foreground uppercase tracking-wider mt-1">Papers</span>
            </div>
            <div className="flex flex-col items-center justify-center text-center p-2">
              <FlaskConical className="text-muted-foreground mb-2 h-5 w-5" />
              <span className="text-2xl font-serif text-foreground">{stats.total_formulations.toLocaleString()}</span>
              <span className="text-xs text-muted-foreground uppercase tracking-wider mt-1">Formulations</span>
            </div>
            <div className="flex flex-col items-center justify-center text-center p-2">
              <Beaker className="text-muted-foreground mb-2 h-5 w-5" />
              <span className="text-2xl font-serif text-foreground">{stats.total_materials.toLocaleString()}</span>
              <span className="text-xs text-muted-foreground uppercase tracking-wider mt-1">Materials</span>
            </div>
            <div className="flex flex-col items-center justify-center text-center p-2">
              <Database className="text-muted-foreground mb-2 h-5 w-5" />
              <span className="text-2xl font-serif text-foreground">{stats.total_experiments.toLocaleString()}</span>
              <span className="text-xs text-muted-foreground uppercase tracking-wider mt-1">Experiments</span>
            </div>
            <div className="flex flex-col items-center justify-center text-center p-2">
              <Activity className="text-muted-foreground mb-2 h-5 w-5" />
              <span className="text-2xl font-serif text-foreground">{stats.total_biological_outcomes.toLocaleString()}</span>
              <span className="text-xs text-muted-foreground uppercase tracking-wider mt-1">Outcomes</span>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
