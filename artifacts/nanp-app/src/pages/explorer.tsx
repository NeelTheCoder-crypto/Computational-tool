import { useState, useEffect } from 'react';
import { Link, useParams, useLocation } from 'wouter';
import {
  useListFormulations,
  useListMaterials,
  useListPapers,
  useListOutcomes,
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

function FormulationsTab({ search, page, setPage }: TabProps) {
  const { data, isLoading } = useListFormulations({ search: search || undefined, page, page_size: PAGE_SIZE });
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
              <TableHead>Family</TableHead>
              <TableHead>Subtype</TableHead>
              <TableHead>Route</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((f) => (
              <TableRow key={f.formulation_id} className="group">
                <TableCell className="font-medium">
                  <Link href={`/formulation/${f.formulation_id}`} className="hover:text-primary hover:underline">
                    {f.formulation_name ?? f.formulation_id.slice(0, 8)}
                  </Link>
                </TableCell>
                <TableCell>
                  {f.carrier_family && (
                    <Badge variant="secondary" className="font-mono text-[11px]">{f.carrier_family}</Badge>
                  )}
                </TableCell>
                <TableCell className="text-muted-foreground text-sm">{f.carrier_subtype ?? '—'}</TableCell>
                <TableCell className="text-muted-foreground text-sm">
                  {f.intended_route ?? f.intended_mucosal_site ?? '—'}
                </TableCell>
                <TableCell>
                  <Link href={`/formulation/${f.formulation_id}`}>
                    <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                  </Link>
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
