import { useMemo, useState } from 'react';
import { Link } from 'wouter';
import { useGetSheetCatalog, type SheetRecord } from '@workspace/api-client-react';
import { ArrowRight, BookOpen, Check, ExternalLink, RotateCcw, Search, TriangleAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

type Criteria = { disease: string; route: string; cargo: string };
const empty: Criteria = { disease: '', route: '', cargo: '' };

function SelectInput({ label, value, values, onChange }: {
  label: string;
  value: string;
  values: string[];
  onChange: (value: string) => void;
}) {
  return (
    <label className="block min-w-0 space-y-2">
      <span className="text-sm font-semibold uppercase tracking-[0.12em] text-muted-foreground">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-13 w-full rounded-lg border border-border bg-background px-3 text-base text-foreground outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        <option value="">Any {label.toLowerCase()}</option>
        {values.map((option) => <option key={option} value={option}>{option}</option>)}
      </select>
    </label>
  );
}

function getCoverage(record: SheetRecord, criteria: Criteria) {
  const matched = [
    criteria.disease && record.diseases.includes(criteria.disease) ? `Disease: ${criteria.disease}` : null,
    criteria.route && record.routes.includes(criteria.route) ? `Route: ${criteria.route}` : null,
    criteria.cargo && record.cargos.includes(criteria.cargo) ? `Cargo: ${criteria.cargo}` : null,
  ].filter((item): item is string => Boolean(item));
  const missing = [
    criteria.disease && !record.diseases.includes(criteria.disease) ? `Disease: ${criteria.disease}` : null,
    criteria.route && !record.routes.includes(criteria.route) ? `Route: ${criteria.route}` : null,
    criteria.cargo && !record.cargos.includes(criteria.cargo) ? `Cargo: ${criteria.cargo}` : null,
  ].filter((item): item is string => Boolean(item));
  return { matched, missing };
}

function ResultCard({ record, criteria, top = false }: {
  record: SheetRecord;
  criteria: Criteria;
  top?: boolean;
}) {
  const { matched, missing } = getCoverage(record, criteria);
  const total = Object.values(criteria).filter(Boolean).length;
  return (
    <Card className={top ? 'border-primary/45 bg-primary/[0.025] shadow-sm' : 'border-border/70 shadow-none'}>
      <CardContent className="space-y-5 p-5 sm:p-7">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-sm font-semibold uppercase tracking-wider text-primary">
            {top && !missing.length && !record.is_review
              ? 'Best-supported sheet match'
              : top
                ? 'Closest related sheet row'
                : matched.length === total
                  ? 'All selected inputs stated'
                  : 'Related sheet record'}
          </span>
          <span className="font-mono text-sm text-muted-foreground">Sheet row {record.row}</span>
        </div>
        <div>
          <h3 className="font-serif text-2xl font-medium text-foreground">
            {record.formulation_name || record.particle_type || `Sheet row ${record.row}`}
          </h3>
          {record.formulation_name && <p className="mt-1 text-sm text-muted-foreground">{record.particle_type}</p>}
          {record.is_review && <p className="mt-1 text-sm text-amber-700">Background / review source, not a carrier trial</p>}
        </div>
        <p className="line-clamp-2 text-base leading-relaxed text-muted-foreground">{record.reference || 'No reference stated'}</p>
        <div className="flex flex-wrap gap-2 text-sm">
          {matched.map((item) => <span key={item} className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-emerald-800"><Check className="h-3 w-3" />{item}</span>)}
          {missing.map((item) => <span key={item} className="rounded-full border border-border px-2.5 py-1 text-muted-foreground">Not stated: {item}</span>)}
        </div>
        <div className="grid gap-5 border-t border-border/60 pt-5 text-base sm:grid-cols-2">
          <div>
            <p className="mb-2 font-semibold text-foreground">Composition</p>
            <p className="line-clamp-5 whitespace-pre-line leading-relaxed text-muted-foreground">{record.composition || 'Not reported in this row.'}</p>
          </div>
          <div>
            <p className="mb-2 font-semibold text-foreground">Methodology</p>
            <p className="line-clamp-5 whitespace-pre-line leading-relaxed text-muted-foreground">{record.methodology || 'Not reported in this row.'}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link href={`/carrier/${record.row}`} className="inline-flex items-center gap-1.5 text-base font-semibold text-primary hover:underline">
            See pros &amp; cons and full record <ArrowRight className="h-4 w-4" />
          </Link>
          <a href={record.source_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary">
            Open row in Google Sheets <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </div>
      </CardContent>
    </Card>
  );
}

export default function SheetFinder() {
  const { data, isLoading, isError, refetch, isFetching } = useGetSheetCatalog();
  const [input, setInput] = useState<Criteria>(empty);
  const [selection, setSelection] = useState<Criteria | null>(null);
  const active = selection ? Object.values(selection).filter(Boolean).length : 0;
  const ranked = useMemo(() => {
    if (!selection || !data) return [];
    return data.records
      .map((record) => ({ record, count: getCoverage(record, selection).matched.length }))
      .filter(({ count }) => count > 0)
      .sort((a, b) => b.count - a.count || Number(a.record.is_review) - Number(b.record.is_review) || a.record.row - b.record.row);
  }, [data, selection]);
  const directCount = ranked.filter(({ count }) => count === active).length;
  return (
    <div className="mx-auto max-w-5xl space-y-8 px-5 py-10 sm:px-8 sm:py-14">
      <div className="space-y-3">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-primary">Research carrier finder</p>
        <h1 className="max-w-2xl font-serif text-4xl font-medium leading-tight text-foreground sm:text-5xl">
          Find a carrier for your research question.
        </h1>
        <p className="max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg">
          Choose a disease, administration route, and therapeutic nucleic acid. Matches come only from the
          supplied Google Sheet; a missing input means it was not clearly stated in that row.
        </p>
      </div>
      <Card className="border-border/70 bg-background shadow-sm">
        <CardContent className="p-5 sm:p-7">
          <form className="space-y-5" onSubmit={(event) => { event.preventDefault(); setSelection({ ...input }); }}>
            <div className="grid gap-4 sm:grid-cols-3">
              <SelectInput label="Disease" value={input.disease} values={data?.options.diseases ?? []} onChange={(disease) => setInput((prev) => ({ ...prev, disease }))} />
              <SelectInput label="Route" value={input.route} values={data?.options.routes ?? []} onChange={(route) => setInput((prev) => ({ ...prev, route }))} />
              <SelectInput label="Cargo" value={input.cargo} values={data?.options.cargos ?? []} onChange={(cargo) => setInput((prev) => ({ ...prev, cargo }))} />
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Button type="submit" disabled={isLoading || isError || !Object.values(input).some(Boolean)} className="h-11 gap-2 px-5 text-base">
                <Search className="h-4 w-4" /> Find carriers
              </Button>
              {(selection || Object.values(input).some(Boolean)) && (
                <Button type="button" variant="ghost" onClick={() => { setInput(empty); setSelection(null); }} className="h-11 gap-2 text-base">
                  <RotateCcw className="h-4 w-4" /> Clear
                </Button>
              )}
              <span className="text-sm text-muted-foreground">Select any or all three inputs.</span>
            </div>
          </form>
        </CardContent>
      </Card>

      {isLoading && <div className="space-y-3"><Skeleton className="h-24 w-full" /><Skeleton className="h-28 w-full" /></div>}
      {isError && (
        <div role="alert" className="flex flex-wrap items-center gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-5 text-base text-destructive">
          <TriangleAlert className="h-5 w-5" /> The Google Sheet is unavailable or its columns changed. No results from the old database will be shown.
          <Button type="button" variant="outline" size="sm" onClick={() => void refetch()} disabled={isFetching}>Retry</Button>
        </div>
      )}
      {data && !selection && (
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-border/60 bg-background p-5 sm:p-6">
          <div>
            <p className="font-serif text-xl">{data.records.length} source records, one Google Sheet</p>
            <p className="mt-1 text-base text-muted-foreground">Some rows have no named disease, route, or cargo. They remain available to browse.</p>
          </div>
          <Link href="/browse" className="inline-flex items-center gap-2 text-base font-semibold text-primary hover:underline">
            <BookOpen className="h-4 w-4" /> Browse all sheet records <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      )}
      {data && selection && (
        <section className="space-y-5" aria-live="polite">
          <div>
            <h2 className="font-serif text-2xl font-medium">Results from the sheet</h2>
            <p className="mt-1 text-base text-muted-foreground">
              {directCount > 0
                ? `${directCount} row${directCount === 1 ? '' : 's'} explicitly mention${directCount === 1 ? 's' : ''} all ${active} selected input${active === 1 ? '' : 's'}.`
                : `No row clearly states all ${active} selected inputs together. Related records are shown below, with gaps labeled.`}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">Ranked by the number of selected inputs stated in the same row; studies precede reviews at equal coverage. This is not a clinical recommendation.</p>
          </div>
          {ranked.length ? (
            <>
              <div className="grid gap-4">{ranked.slice(0, 12).map(({ record }, index) =>
                <ResultCard key={record.row} record={record} criteria={selection} top={index === 0} />
              )}</div>
              {ranked.length > 12 && <p className="text-base text-muted-foreground">Showing the 12 most relevant of {ranked.length} related rows.</p>}
            </>
          ) : (
            <div className="rounded-lg border border-dashed border-border p-6 text-base text-muted-foreground">
              None of the sheet rows explicitly state these inputs. No carrier can be supported for this query from this sheet.
            </div>
          )}
          <Link href="/browse" className="inline-flex items-center gap-2 text-base font-medium text-primary hover:underline">Browse all {data.records.length} sheet records <ArrowRight className="h-4 w-4" /></Link>
        </section>
      )}
    </div>
  );
}