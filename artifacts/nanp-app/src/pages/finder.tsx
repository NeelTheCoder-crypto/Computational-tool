import { useMemo, useState } from 'react';
import { Link } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import {
  useGetFilterOptions,
  matchCarriers,
} from '@workspace/api-client-react';
import type { CarrierMatch } from '@workspace/api-client-react';
import FilterCombobox from '@/components/FilterCombobox';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Trophy,
  FlaskConical,
  CheckCircle2,
  AlertTriangle,
  BookOpen,
  ArrowRight,
  SearchX,
  Sparkles,
} from 'lucide-react';
import { cn } from '@/lib/utils';

function EvidenceStat({
  icon: Icon,
  value,
  label,
  tone,
}: {
  icon: React.ComponentType<{ className?: string }>;
  value: number;
  label: string;
  tone: 'neutral' | 'positive' | 'negative';
}) {
  return (
    <div className="flex items-center gap-1.5" title={label}>
      <Icon
        className={cn(
          'h-3.5 w-3.5',
          tone === 'positive' && 'text-emerald-600',
          tone === 'negative' && 'text-rose-600',
          tone === 'neutral' && 'text-muted-foreground'
        )}
      />
      <span className="font-mono text-xs font-medium text-foreground tabular-nums">
        {value}
      </span>
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  );
}

function MatchCard({ match, rank }: { match: CarrierMatch; rank: number }) {
  const isTop = rank === 1;
  const materials = match.materials
    .map((m) => m.canonical_name ?? m.abbreviation)
    .filter((x): x is string => !!x)
    .slice(0, 6);

  return (
    <Link href={`/formulation/${match.formulation_id}`}>
      <Card
        className={cn(
          'group cursor-pointer transition-all hover:shadow-lg hover:-translate-y-0.5',
          isTop
            ? 'border-primary/40 bg-primary/[0.03] shadow-md ring-1 ring-primary/10'
            : 'border-border/60'
        )}
      >
        <CardContent className="p-5">
          <div className="flex items-start gap-4">
            <div
              className={cn(
                'flex h-9 w-9 shrink-0 items-center justify-center rounded-full font-mono text-sm font-bold',
                isTop
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground'
              )}
            >
              {isTop ? <Trophy className="h-4 w-4" /> : rank}
            </div>

            <div className="min-w-0 flex-1 space-y-3">
              <div>
                {isTop && (
                  <span className="mb-1 inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider text-primary">
                    <Trophy className="h-3 w-3" /> Optimal carrier for this query
                  </span>
                )}
                <h3 className="font-serif text-lg font-medium leading-tight text-foreground group-hover:text-primary transition-colors">
                  {match.formulation_name ?? `Formulation ${match.formulation_id.slice(0, 8)}`}
                </h3>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {match.carrier_family && (
                    <Badge variant="secondary" className="font-mono text-[11px]">
                      {match.carrier_family}
                    </Badge>
                  )}
                  {match.carrier_subtype && (
                    <Badge variant="outline" className="font-mono text-[11px]">
                      {match.carrier_subtype}
                    </Badge>
                  )}
                </div>
              </div>

              {/* Matched query dimensions */}
              {(match.matched_cargo_types.length > 0 ||
                match.matched_routes.length > 0 ||
                match.matched_disease_models.length > 0) && (
                <div className="flex flex-wrap gap-1.5">
                  {[
                    ...match.matched_cargo_types,
                    ...match.matched_routes,
                    ...match.matched_disease_models,
                  ].map((m, i) => (
                    <span
                      key={i}
                      className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700 ring-1 ring-emerald-200"
                    >
                      <CheckCircle2 className="h-3 w-3" /> {m}
                    </span>
                  ))}
                </div>
              )}

              {/* Materials */}
              {materials.length > 0 && (
                <p className="font-mono text-xs text-muted-foreground">
                  {materials.join(' · ')}
                </p>
              )}

              {/* Evidence + paper */}
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-border/50 pt-3">
                <EvidenceStat
                  icon={FlaskConical}
                  value={match.matching_arm_count}
                  label="arms"
                  tone="neutral"
                />
                <EvidenceStat
                  icon={CheckCircle2}
                  value={match.favorable_outcome_count}
                  label="favorable"
                  tone="positive"
                />
                {match.adverse_outcome_count > 0 && (
                  <EvidenceStat
                    icon={AlertTriangle}
                    value={match.adverse_outcome_count}
                    label="adverse"
                    tone="negative"
                  />
                )}
                <EvidenceStat
                  icon={BookOpen}
                  value={match.supporting_outcome_count}
                  label="outcomes"
                  tone="neutral"
                />
                {match.paper?.title && (
                  <span className="ml-auto hidden max-w-[45%] items-center gap-1 truncate text-xs text-muted-foreground sm:flex">
                    <BookOpen className="h-3 w-3 shrink-0" />
                    <span className="truncate">{match.paper.title}</span>
                  </span>
                )}
              </div>
            </div>

            <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

export default function Finder() {
  const [cargoType, setCargoType] = useState('');
  const [disease, setDisease] = useState('');
  const [route, setRoute] = useState('');

  const { data: options, isLoading: loadingOptions } = useGetFilterOptions();

  const hasFilters = !!(cargoType || disease || route);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['carriers-match', cargoType, disease, route],
    queryFn: () =>
      matchCarriers({
        cargo_type: cargoType || undefined,
        disease: disease || undefined,
        route: route || undefined,
        page_size: 50,
      }),
  });

  const matches = useMemo(() => data?.items ?? [], [data]);

  return (
    <div className="max-w-4xl mx-auto px-6 py-10 space-y-8">
      <div className="space-y-2">
        <h2 className="font-serif text-3xl font-medium text-foreground">
          Carrier Finder
        </h2>
        <p className="max-w-2xl text-muted-foreground">
          Narrow by nucleic acid, disease, and route — each optional. Results are the
          real carrier formulations the database links to your query, ranked by
          experimental evidence.
        </p>
      </div>

      {/* Filters */}
      <Card className="border-border/60 bg-background/95 shadow-sm backdrop-blur">
        <CardContent className="grid grid-cols-1 gap-4 p-5 sm:grid-cols-3">
          <FilterCombobox
            label="Nucleic acid"
            placeholder="Any cargo type"
            searchPlaceholder="Search cargo types…"
            values={options?.cargo_types ?? []}
            selected={cargoType}
            onSelect={setCargoType}
            isLoading={loadingOptions}
          />
          <FilterCombobox
            label="Disease"
            placeholder="Any disease"
            searchPlaceholder="Search diseases…"
            values={options?.diseases ?? []}
            selected={disease}
            onSelect={setDisease}
            isLoading={loadingOptions}
          />
          <FilterCombobox
            label="Route"
            placeholder="Any route"
            searchPlaceholder="Search routes…"
            values={options?.routes ?? []}
            selected={route}
            onSelect={setRoute}
            isLoading={loadingOptions}
          />
        </CardContent>
      </Card>

      {/* Results */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            {hasFilters ? 'Ranked carriers' : 'All carriers'}
          </h3>
          {!isLoading && !isError && (
            <span className="font-mono text-xs text-muted-foreground">
              {data?.total ?? 0} match{(data?.total ?? 0) === 1 ? '' : 'es'}
            </span>
          )}
        </div>

        {isLoading && (
          <div className="space-y-3">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-32 w-full rounded-xl" />
            ))}
          </div>
        )}

        {isError && (
          <Card className="border-destructive/30 bg-destructive/5">
            <CardContent className="flex items-center gap-3 p-6 text-sm text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Could not load carriers from the database. Please try again.
            </CardContent>
          </Card>
        )}

        {!isLoading && !isError && matches.length === 0 && (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center gap-3 py-14 text-center">
              <SearchX className="h-10 w-10 text-muted-foreground/50" />
              <div>
                <p className="font-medium text-foreground">
                  No carriers match this query
                </p>
                <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
                  The database has no formulations linked to this combination of
                  filters. Try removing a filter to broaden the search.
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {!isLoading &&
          !isError &&
          matches.map((m, i) => (
            <MatchCard key={m.formulation_id} match={m} rank={i + 1} />
          ))}
      </div>

      {!isLoading && !isError && matches.length > 0 && (
        <p className="flex items-center justify-center gap-1.5 text-center text-xs text-muted-foreground">
          <Sparkles className="h-3 w-3" />
          Ranking reflects matching experimental arms and favorable outcomes recorded
          in the database. Open any carrier to trace every claim to its source records.
        </p>
      )}
    </div>
  );
}
