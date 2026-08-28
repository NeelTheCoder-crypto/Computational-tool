import { useState, useEffect } from 'react';
import { Link, useParams, useLocation } from 'wouter';
import {
  useListFormulations,
  useListMaterials,
  useListPapers,
  useListOutcomes,
  useGetFilterOptions,
} from '@workspace/api-client-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Search,
  ChevronLeft,
  ChevronRight,
  FlaskConical,
  Atom,
  BookText,
  Activity,
  Inbox,
  ArrowRight,
  RotateCcw,
  Route,
  Dna,
  Microscope,
  FileText,
  AlertTriangle,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const PAGE_SIZE = 25;

type TabKey = 'formulations' | 'materials' | 'papers' | 'outcomes';

const TABS: { key: TabKey; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { key: 'formulations', label: 'Formulations', icon: FlaskConical },
  { key: 'materials', label: 'Materials', icon: Atom },
  { key: 'papers', label: 'Papers', icon: BookText },
  { key: 'outcomes', label: 'Outcomes', icon: Activity },
];

function useDebounced<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

function Pager({
  page,
  pageSize,
  total,
  onPage,
}: {
  page: number;
  pageSize: number;
  total: number;
  onPage: (p: number) => void;
}) {
  const start = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);
  const maxPage = Math.max(1, Math.ceil(total / pageSize));
  return (
    <div className="flex items-center justify-between pt-4">
      <p className="font-mono text-xs text-muted-foreground">
        {start}–{end} of {total}
      </p>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={page <= 1}
          onClick={() => onPage(page - 1)}
        >
          <ChevronLeft className="h-4 w-4" /> Prev
        </Button>
        <span className="font-mono text-xs text-muted-foreground">
          {page} / {maxPage}
        </span>
        <Button
          variant="outline"
          size="sm"
          disabled={page >= maxPage}
          onClick={() => onPage(page + 1)}
        >
          Next <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

function StateRow({ loading, empty }: { loading: boolean; empty: boolean }) {
  if (loading) {
    return (
      <div className="space-y-2 py-4">
        {[0, 1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    );
  }
  if (empty) {
    return (
      <div className="flex flex-col items-center gap-2 py-16 text-center">
        <Inbox className="h-9 w-9 text-muted-foreground/40" />
        <p className="text-sm text-muted-foreground">No records match your search.</p>
      </div>
    );
  }
  return null;
}

type EvidenceFilter = '' | 'with_arms' | 'with_outcomes' | 'disease_linked' | 'no_disease_link';

function FilterSelect({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: React.ReactNode;
}) {
  return (
    <label className="space-y-1.5">
      <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground outline-none ring-offset-background focus:ring-2 focus:ring-ring"
      >
        {children}
      </select>
    </label>
  );
}

function FormulationsTab({ search, page, setPage }: TabProps) {
  const [disease, setDisease] = useState('');
  const [route, setRoute] = useState('');
  const [cargoType, setCargoType] = useState('');
  const [material, setMaterial] = useState('');
  const [evidence, setEvidence] = useState<EvidenceFilter>('');
  const { data: options } = useGetFilterOptions();
  const { data: materials } = useListMaterials({ page_size: 200 });
  const { data, isLoading, isError } = useListFormulations({
    search: search || undefined,
    page,
    page_size: PAGE_SIZE,
    disease: disease || undefined,
    route: route || undefined,
    cargo_type: cargoType || undefined,
    material: material || undefined,
    evidence: evidence || undefined,
  });
  const items = data?.items ?? [];
  const hasFilters = Boolean(disease || route || cargoType || material || evidence);

  useEffect(() => {
    setPage(1);
  }, [disease, route, cargoType, material, evidence, setPage]);

  const resetFilters = () => {
    setDisease('');
    setRoute('');
    setCargoType('');
    setMaterial('');
    setEvidence('');
  };

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-3 rounded-lg border border-border/60 bg-muted/20 p-4 sm:grid-cols-2 lg:grid-cols-5">
        <FilterSelect label="Disease" value={disease} onChange={setDisease}>
          <option value="">Any disease</option>
          {(options?.diseases ?? []).map((value) => <option key={value}>{value}</option>)}
        </FilterSelect>
        <FilterSelect label="Route" value={route} onChange={setRoute}>
          <option value="">Any route</option>
          {(options?.routes ?? []).map((value) => <option key={value}>{value}</option>)}
        </FilterSelect>
        <FilterSelect label="Cargo" value={cargoType} onChange={setCargoType}>
          <option value="">Any cargo</option>
          {(options?.cargo_types ?? []).map((value) => <option key={value}>{value}</option>)}
        </FilterSelect>
        <FilterSelect label="Material" value={material} onChange={setMaterial}>
          <option value="">Any material</option>
          {(materials?.items ?? []).map((item) => {
            const value = item.canonical_name ?? item.abbreviation ?? item.material_id;
            return <option key={item.material_id} value={value}>{value}</option>;
          })}
        </FilterSelect>
        <FilterSelect label="Evidence" value={evidence} onChange={(value) => setEvidence(value as EvidenceFilter)}>
          <option value="">Any evidence</option>
          <option value="with_arms">Experimental arms</option>
          <option value="with_outcomes">Biological outcomes</option>
          <option value="disease_linked">Disease-linked evidence</option>
          <option value="no_disease_link">No disease link recorded</option>
        </FilterSelect>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-foreground">
            {isLoading ? 'Loading catalog…' : `${data?.total ?? 0} formulations`}
          </p>
          <p className="text-xs text-muted-foreground">
            Intended routes and routes observed in experimental arms are kept distinct.
          </p>
        </div>
        {hasFilters && (
          <Button variant="outline" size="sm" onClick={resetFilters}>
            <RotateCcw className="h-4 w-4" /> Clear filters
          </Button>
        )}
      </div>

      {isLoading && <StateRow loading empty={false} />}
      {isError && (
        <div className="flex items-center gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-5 text-sm text-destructive">
          <AlertTriangle className="h-5 w-5 shrink-0" />
          The formulation catalog could not be loaded from the database.
        </div>
      )}
      {!isLoading && !isError && items.length === 0 && (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed py-12 text-center">
          <Inbox className="h-9 w-9 text-muted-foreground/40" />
          <div>
            <p className="font-medium text-foreground">
              {disease ? 'No direct disease-linked formulations are recorded' : 'No formulations match these filters'}
            </p>
            <p className="mx-auto mt-1 max-w-lg text-sm text-muted-foreground">
              {disease
                ? `The catalog contains formulations, but none have an experimental arm connected to “${disease}” under the other active filters.`
                : 'Broaden the relationship filters or return to the complete catalog.'}
            </p>
          </div>
          <Button onClick={resetFilters}>Browse the complete catalog</Button>
        </div>
      )}
      {!isLoading && !isError && items.length > 0 && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {items.map((formulation) => (
            <Card key={formulation.formulation_id} className="border-border/60 shadow-none">
              <CardContent className="flex h-full flex-col gap-4 p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <Link
                      href={`/formulation/${formulation.formulation_id}`}
                      className="font-serif text-xl font-medium text-foreground hover:text-primary"
                    >
                      {formulation.formulation_name ?? formulation.formulation_id.slice(0, 8)}
                    </Link>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {[formulation.carrier_family, formulation.carrier_subtype, formulation.architecture]
                        .filter(Boolean)
                        .join(' · ') || 'Formulation record'}
                    </p>
                  </div>
                  <Link href={`/formulation/${formulation.formulation_id}`} aria-label="Open formulation detail">
                    <ArrowRight className="h-5 w-5 text-muted-foreground" />
                  </Link>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  {[
                    ['arms', formulation.experimental_arm_count ?? 0],
                    ['diseases', formulation.disease_evidence_count ?? 0],
                    ['outcomes', formulation.outcome_count ?? 0],
                  ].map(([label, value]) => (
                    <div key={label} className="rounded-md bg-muted/40 p-2.5">
                      <p className="font-mono text-lg font-semibold">{value}</p>
                      <p className="text-[11px] text-muted-foreground">{label}</p>
                    </div>
                  ))}
                </div>

                <div className="space-y-2 text-xs">
                  <div className="flex items-start gap-2">
                    <Route className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    <span><strong>Intended:</strong> {formulation.intended_route ?? 'not recorded'}</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <Microscope className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    <span><strong>Arm routes:</strong> {(formulation.evidence_routes ?? []).join(', ') || 'none recorded'}</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <Dna className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    <span><strong>Cargo:</strong> {(formulation.cargo_types ?? []).join(', ') || 'not recorded'}</span>
                  </div>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {(formulation.disease_models ?? []).slice(0, 3).map((value) => (
                    <Badge key={`disease-${value}`} variant="secondary" className="font-mono text-[10px]">{value}</Badge>
                  ))}
                  {(formulation.material_names ?? []).slice(0, 3).map((value) => (
                    <Badge key={`material-${value}`} variant="outline" className="font-mono text-[10px]">{value}</Badge>
                  ))}
                </div>

                {formulation.paper_title && (
                  <p className="mt-auto flex items-start gap-2 border-t border-border/60 pt-3 text-xs text-muted-foreground">
                    <FileText className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    <span className="line-clamp-2">{formulation.paper_title}</span>
                  </p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      <Pager page={page} pageSize={PAGE_SIZE} total={data?.total ?? 0} onPage={setPage} />
    </div>
  );
}

function MaterialsTab({ search, page, setPage }: TabProps) {
  const { data, isLoading } = useListMaterials({ search: search || undefined, page, page_size: PAGE_SIZE });
  const items = data?.items ?? [];
  return (
    <>
      {isLoading || items.length === 0 ? (
        <StateRow loading={isLoading} empty={items.length === 0} />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Abbrev.</TableHead>
              <TableHead>Class</TableHead>
              <TableHead>Subclass</TableHead>
              <TableHead className="text-right">MW (Da)</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((m) => (
              <TableRow key={m.material_id}>
                <TableCell className="font-medium">{m.canonical_name ?? '—'}</TableCell>
                <TableCell className="font-mono text-sm text-muted-foreground">{m.abbreviation ?? '—'}</TableCell>
                <TableCell>
                  {m.material_class && (
                    <Badge variant="outline" className="font-mono text-[11px]">{m.material_class}</Badge>
                  )}
                </TableCell>
                <TableCell className="text-muted-foreground text-sm">{m.chemical_subclass ?? '—'}</TableCell>
                <TableCell className="text-right font-mono text-sm tabular-nums text-muted-foreground">
                  {m.molecular_weight_da ?? '—'}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
      <Pager page={page} pageSize={PAGE_SIZE} total={data?.total ?? 0} onPage={setPage} />
    </>
  );
}

function PapersTab({ search, page, setPage }: TabProps) {
  const { data, isLoading } = useListPapers({ search: search || undefined, page, page_size: PAGE_SIZE });
  const items = data?.items ?? [];
  return (
    <>
      {isLoading || items.length === 0 ? (
        <StateRow loading={isLoading} empty={items.length === 0} />
      ) : (
        <div className="divide-y divide-border/60">
          {items.map((p) => (
            <div key={p.paper_id} className="py-3">
              <a
                href={p.url ?? (p.doi ? `https://doi.org/${p.doi}` : undefined)}
                target="_blank"
                rel="noreferrer"
                className={cn(
                  'font-medium leading-snug text-foreground',
                  (p.url || p.doi) && 'hover:text-primary hover:underline'
                )}
              >
                {p.title ?? 'Untitled'}
              </a>
              <p className="mt-1 text-xs text-muted-foreground">
                {[p.authors_text, p.journal, p.publication_year, p.doi ? `DOI: ${p.doi}` : null]
                  .filter(Boolean)
                  .join(' · ')}
              </p>
            </div>
          ))}
        </div>
      )}
      <Pager page={page} pageSize={PAGE_SIZE} total={data?.total ?? 0} onPage={setPage} />
    </>
  );
}

const POLARITY_STYLES: Record<string, string> = {
  favorable: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  positive: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  adverse: 'bg-rose-50 text-rose-700 ring-rose-200',
  negative: 'bg-rose-50 text-rose-700 ring-rose-200',
  neutral: 'bg-muted text-muted-foreground ring-border',
};

function OutcomesTab({ search, page, setPage }: TabProps) {
  const { data, isLoading } = useListOutcomes({ search: search || undefined, page, page_size: PAGE_SIZE });
  const items = data?.items ?? [];
  return (
    <>
      {isLoading || items.length === 0 ? (
        <StateRow loading={isLoading} empty={items.length === 0} />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Domain</TableHead>
              <TableHead>Metric</TableHead>
              <TableHead>Tissue</TableHead>
              <TableHead>Result</TableHead>
              <TableHead>Polarity</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((o) => (
              <TableRow key={o.outcome_id}>
                <TableCell className="font-medium">{o.outcome_domain ?? '—'}</TableCell>
                <TableCell className="font-mono text-sm text-muted-foreground">{o.metric_code ?? '—'}</TableCell>
                <TableCell className="text-muted-foreground text-sm">{o.target_tissue ?? '—'}</TableCell>
                <TableCell className="max-w-xs text-sm text-muted-foreground">
                  <span className="line-clamp-2">
                    {o.result_interpretation ??
                      o.value_text ??
                      ([o.value_operator, o.value_numeric, o.unit].filter((x) => x != null).join(' ') ||
                        '—')}
                  </span>
                </TableCell>
                <TableCell>
                  {o.result_polarity && (
                    <span
                      className={cn(
                        'inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium capitalize ring-1',
                        POLARITY_STYLES[o.result_polarity] ?? POLARITY_STYLES.neutral
                      )}
                    >
                      {o.result_polarity}
                    </span>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
      <Pager page={page} pageSize={PAGE_SIZE} total={data?.total ?? 0} onPage={setPage} />
    </>
  );
}

interface TabProps {
  search: string;
  page: number;
  setPage: (p: number) => void;
}

export default function Explorer() {
  const params = useParams();
  const [, setLocation] = useLocation();
  const tab = (TABS.find((t) => t.key === params.tab)?.key ?? 'formulations') as TabKey;

  const [searchInput, setSearchInput] = useState('');
  const [page, setPage] = useState(1);
  const search = useDebounced(searchInput);

  // Reset page when search or tab changes
  useEffect(() => {
    setPage(1);
  }, [search, tab]);

  const switchTab = (key: TabKey) => {
    setSearchInput('');
    setPage(1);
    setLocation(key === 'formulations' ? '/explore' : `/explore/${key}`);
  };

  const tabProps: TabProps = { search, page, setPage };

  return (
    <div className="max-w-5xl mx-auto px-6 py-10 space-y-6">
      <div className="space-y-2">
        <h2 className="font-serif text-3xl font-medium text-foreground">
          Database Explorer
        </h2>
        <p className="text-muted-foreground">
          Browse the underlying records directly — every formulation, material, paper,
          and outcome in the database.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-1 border-b border-border">
        {TABS.map((t) => {
          const active = t.key === tab;
          return (
            <button
              key={t.key}
              onClick={() => switchTab(t.key)}
              className={cn(
                'flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors -mb-px',
                active
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              )}
            >
              <t.icon className="h-4 w-4" />
              {t.label}
            </button>
          );
        })}
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder={`Search ${tab}…`}
          className="pl-9"
        />
      </div>

      <Card className="border-border/60">
        <CardContent className="p-4 sm:p-5">
          {tab === 'formulations' && <FormulationsTab {...tabProps} />}
          {tab === 'materials' && <MaterialsTab {...tabProps} />}
          {tab === 'papers' && <PapersTab {...tabProps} />}
          {tab === 'outcomes' && <OutcomesTab {...tabProps} />}
        </CardContent>
      </Card>
    </div>
  );
}
