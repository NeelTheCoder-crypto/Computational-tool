import { useState } from 'react';
import { Link, useParams } from 'wouter';
import { useGetSheetCatalog, type SheetRecord } from '@workspace/api-client-react';
import { ArrowLeft, ArrowRight, ExternalLink, FileText, TriangleAlert } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

function Field({ title, value, tint }: { title: string; value: string; tint?: string }) {
  return (
    <section className={`rounded-lg border border-border/60 p-5 ${tint ?? 'bg-background'}`}>
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-[0.12em] text-muted-foreground">{title}</h2>
      <p className="whitespace-pre-wrap break-words text-base leading-relaxed text-foreground">{value || 'Not reported in this row.'}</p>
    </section>
  );
}

export function SheetRecordDetail() {
  const { row } = useParams<{ row: string }>();
  const { data, isLoading, isError } = useGetSheetCatalog();
  const record = data?.records.find((item) => String(item.row) === row);
  return (
    <div className="mx-auto max-w-4xl space-y-6 px-5 py-9 sm:px-8">
      <Link href="/" className="inline-flex items-center gap-2 text-base text-muted-foreground hover:text-primary"><ArrowLeft className="h-4 w-4" /> Back to finder</Link>
      {isLoading && <Skeleton className="h-48 w-full" />}
      {isError && <p role="alert" className="flex gap-2 text-base text-destructive"><TriangleAlert className="h-4 w-4" /> The Google Sheet could not be loaded. No old database records are available.</p>}
      {data && !record && <p role="alert" className="text-base text-muted-foreground">This sheet row does not exist. The sheet may have changed.</p>}
      {record && <RecordContent record={record} />}
    </div>
  );
}

function RecordContent({ record }: { record: SheetRecord }) {
  return (
    <>
      <div className="space-y-2">
        <p className="font-mono text-sm uppercase tracking-wider text-primary">Google Sheet · row {record.row}</p>
        <h1 className="font-serif text-3xl font-medium leading-tight sm:text-4xl">{record.formulation_name || record.particle_type || `Sheet row ${record.row}`}</h1>
        <p className="text-base text-muted-foreground">Particle type: {record.particle_type || 'Not reported'}</p>
        {record.is_review && <p className="text-base text-amber-700">This row is a review/background source, not a direct carrier trial.</p>}
        <a href={record.source_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-base font-medium text-primary hover:underline">
          Open original sheet row <ExternalLink className="h-4 w-4" />
        </a>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        {(['diseases', 'routes', 'cargos'] as const).map((key) => (
          <div key={key} className="rounded-lg border border-border/60 bg-muted/20 p-4">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">{key}</h2>
            <p className="mt-2 text-base">{record[key].join(', ') || 'Not clearly stated'}</p>
          </div>
        ))}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field title="Pros · advantages" value={record.advantages} tint="bg-emerald-50/40" />
        <Field title="Cons · limitations" value={record.limitations} tint="bg-rose-50/40" />
      </div>
      <Field title="Composition" value={record.composition} />
      <Field title="Mechanism" value={record.mechanism} />
      <Field title="Methodology" value={record.methodology} />
      <Field title="Reference (as written in sheet)" value={record.reference} />
    </>
  );
}

export function BrowseSheet() {
  const { data, isLoading, isError } = useGetSheetCatalog();
  const [search, setSearch] = useState('');
  const records = data?.records.filter((record) =>
    [record.particle_type, record.formulation_name, record.reference, record.composition]
      .some((value) => (value ?? '').toLowerCase().includes(search.toLowerCase().trim()))
  ) ?? [];
  return (
    <div className="mx-auto max-w-5xl space-y-6 px-5 py-9 sm:px-8">
      <Link href="/" className="inline-flex items-center gap-2 text-base text-muted-foreground hover:text-primary"><ArrowLeft className="h-4 w-4" /> Back to finder</Link>
      <div>
        <p className="text-sm font-semibold uppercase tracking-widest text-primary">Original source</p>
        <h1 className="mt-2 font-serif text-3xl font-medium">All sheet records</h1>
        <p className="mt-2 text-base text-muted-foreground">Every nonblank row is included, even without a named disease, route, or cargo.</p>
      </div>
      <Input aria-label="Search sheet records" placeholder="Search particle type, carrier, reference or composition…" value={search} onChange={(event) => setSearch(event.target.value)} className="max-w-lg text-base" />
      {isLoading && <Skeleton className="h-40 w-full" />}
      {isError && <p role="alert" className="text-base text-destructive">The Google Sheet could not be loaded.</p>}
      {data && <p className="font-mono text-sm text-muted-foreground">Showing {records.length} of {data.records.length} sheet rows</p>}
      <div className="space-y-3">
        {records.map((record) => (
          <Card key={record.row} className="border-border/70 shadow-none">
            <CardContent className="flex items-start justify-between gap-4 p-4 sm:p-5">
              <div className="min-w-0">
                <p className="font-mono text-sm text-muted-foreground">ROW {record.row} · {record.particle_type || 'Particle type not reported'}</p>
                <Link href={`/carrier/${record.row}`} className="mt-1 block font-serif text-xl font-medium hover:text-primary">{record.formulation_name || record.particle_type || `Sheet row ${record.row}`}</Link>
                <p className="mt-1 line-clamp-2 text-base leading-relaxed text-muted-foreground">{record.reference}</p>
                <p className="mt-2 text-sm text-muted-foreground">{[...record.diseases, ...record.routes, ...record.cargos].join(' · ') || 'No matching tags clearly stated'}</p>
              </div>
              <Link href={`/carrier/${record.row}`} aria-label={`Open sheet row ${record.row}`} className="shrink-0 text-primary"><ArrowRight className="h-4 w-4" /></Link>
            </CardContent>
          </Card>
        ))}
        {data && !records.length && <p className="rounded-lg border border-dashed p-6 text-base text-muted-foreground">No sheet rows contain that search text.</p>}
      </div>
      {data && <a href={data.sheet_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-base text-primary hover:underline"><FileText className="h-4 w-4" /> View the source Google Sheet</a>}
    </div>
  );
}