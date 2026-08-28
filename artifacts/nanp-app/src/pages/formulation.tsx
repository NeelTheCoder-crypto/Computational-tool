import { Link, useParams } from 'wouter';
import { useGetFormulationDetail } from '@workspace/api-client-react';
import type { FormulationArm, Outcome } from '@workspace/api-client-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  ArrowLeft,
  BookOpen,
  FlaskConical,
  Atom,
  Dna,
  Crosshair,
  Cog,
  Ruler,
  CheckCircle2,
  AlertTriangle,
  MinusCircle,
  AlertCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';

function Section({
  icon: Icon,
  title,
  count,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  count?: number;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        <Icon className="h-4 w-4" />
        {title}
        {count != null && (
          <span className="font-mono text-muted-foreground/70">({count})</span>
        )}
      </h3>
      {children}
    </section>
  );
}

function polarityStyle(p?: string | null) {
  if (!p) return { cls: 'bg-muted text-muted-foreground ring-border', Icon: MinusCircle };
  const v = p.toLowerCase();
  if (v.includes('favor') || v.includes('positive'))
    return { cls: 'bg-emerald-50 text-emerald-700 ring-emerald-200', Icon: CheckCircle2 };
  if (v.includes('adverse') || v.includes('negative'))
    return { cls: 'bg-rose-50 text-rose-700 ring-rose-200', Icon: AlertTriangle };
  return { cls: 'bg-muted text-muted-foreground ring-border', Icon: MinusCircle };
}

function OutcomeRow({ outcome }: { outcome: Outcome }) {
  const { cls, Icon } = polarityStyle(outcome.result_polarity);
  const result =
    outcome.result_interpretation ??
    outcome.value_text ??
    [outcome.value_operator, outcome.value_numeric, outcome.unit]
      .filter((x) => x != null)
      .join(' ');
  return (
    <div className="flex items-start gap-2.5 rounded-md bg-muted/40 px-3 py-2">
      <span className={cn('mt-0.5 inline-flex rounded-full p-0.5 ring-1', cls)}>
        <Icon className="h-3.5 w-3.5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm text-foreground">{result || 'Recorded outcome'}</p>
        <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">
          {[outcome.outcome_domain, outcome.metric_code, outcome.target_tissue]
            .filter(Boolean)
            .join(' · ') || '—'}
        </p>
      </div>
    </div>
  );
}

function ArmCard({ arm }: { arm: FormulationArm }) {
  const meta = [
    arm.administration_route,
    arm.disease_model,
    arm.species,
    arm.experiment_type,
  ].filter(Boolean);
  const dose =
    arm.dose_value != null
      ? `${arm.dose_value}${arm.dose_unit ? ` ${arm.dose_unit}` : ''}${
          arm.number_of_doses ? ` × ${arm.number_of_doses}` : ''
        }`
      : null;
  return (
    <Card className="border-border/60 shadow-none">
      <CardContent className="space-y-3 p-4">
        <div>
          <p className="font-medium text-foreground">
            {arm.arm_name ?? arm.objective ?? 'Experimental arm'}
          </p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {meta.map((m, i) => (
              <Badge key={i} variant="secondary" className="font-mono text-[11px]">
                {m}
              </Badge>
            ))}
            {dose && (
              <Badge variant="outline" className="font-mono text-[11px]">
                {dose}
              </Badge>
            )}
          </div>
        </div>
        {arm.outcomes.length > 0 ? (
          <div className="space-y-1.5">
            {arm.outcomes.map((o) => (
              <OutcomeRow key={o.outcome_id} outcome={o} />
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">No outcomes recorded for this arm.</p>
        )}
      </CardContent>
    </Card>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-md bg-muted px-2.5 py-1 font-mono text-xs text-foreground">
      {children}
    </span>
  );
}

export default function FormulationDetail() {
  const params = useParams();
  const id = params.id ?? '';
  const { data, isLoading, isError } = useGetFormulationDetail(id);

  return (
    <div className="max-w-4xl mx-auto px-6 py-8 space-y-8">
      <Link
        href="/"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Back
      </Link>

      {isLoading && (
        <div className="space-y-4">
          <Skeleton className="h-10 w-2/3" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      )}

      {isError && (
        <Card className="border-destructive/30 bg-destructive/5">
          <CardContent className="flex items-center gap-3 p-6 text-sm text-destructive">
            <AlertCircle className="h-5 w-5" />
            Could not load this formulation from the database.
          </CardContent>
        </Card>
      )}

      {!isLoading && !isError && data && (
        <>
          {/* Header */}
          <div className="space-y-3">
            <h2 className="font-serif text-3xl font-medium leading-tight text-foreground">
              {data.formulation_name ?? `Formulation ${data.formulation_id.slice(0, 8)}`}
            </h2>
            <div className="flex flex-wrap gap-1.5">
              {data.carrier_family && (
                <Badge variant="secondary" className="font-mono text-xs">{data.carrier_family}</Badge>
              )}
              {data.carrier_subtype && (
                <Badge variant="outline" className="font-mono text-xs">{data.carrier_subtype}</Badge>
              )}
              {data.intended_route && (
                <Badge variant="outline" className="font-mono text-xs">route: {data.intended_route}</Badge>
              )}
              {data.intended_mucosal_site && (
                <Badge variant="outline" className="font-mono text-xs">site: {data.intended_mucosal_site}</Badge>
              )}
              {data.optimized_flag && (
                <Badge className="bg-emerald-600 text-white text-xs">Optimized</Badge>
              )}
            </div>
            {data.architecture && (
              <p className="text-sm text-muted-foreground">{data.architecture}</p>
            )}
            {data.description && (
              <p className="whitespace-pre-line text-sm leading-relaxed text-foreground/80">
                {data.description}
              </p>
            )}
          </div>

          {/* Paper */}
          {data.paper && (
            <Section icon={BookOpen} title="Source paper">
              <div className="rounded-lg border border-border bg-muted/30 px-4 py-3">
                <a
                  href={data.paper.url ?? (data.paper.doi ? `https://doi.org/${data.paper.doi}` : undefined)}
                  target="_blank"
                  rel="noreferrer"
                  className={cn(
                    'font-medium leading-snug text-foreground',
                    (data.paper.url || data.paper.doi) && 'hover:text-primary hover:underline'
                  )}
                >
                  {data.paper.title ?? 'Untitled'}
                </a>
                <p className="mt-1 text-xs text-muted-foreground">
                  {[
                    data.paper.authors_text,
                    data.paper.journal,
                    data.paper.publication_year,
                    data.paper.doi ? `DOI: ${data.paper.doi}` : null,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </p>
              </div>
            </Section>
          )}

          <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
            {/* Materials */}
            {data.materials.length > 0 && (
              <Section icon={Atom} title="Materials" count={data.materials.length}>
                <div className="space-y-1.5">
                  {data.materials.map((m) => (
                    <div
                      key={m.material_id}
                      className="flex items-center justify-between gap-2 rounded-md bg-muted/40 px-3 py-1.5 text-sm"
                    >
                      <span className="font-medium text-foreground">
                        {m.canonical_name ?? m.abbreviation ?? m.material_id.slice(0, 8)}
                      </span>
                      <span className="shrink-0 font-mono text-[11px] text-muted-foreground">
                        {[m.material_role, m.material_class].filter(Boolean).join(' · ')}
                      </span>
                    </div>
                  ))}
                </div>
              </Section>
            )}

            {/* Cargos */}
            {data.cargos.length > 0 && (
              <Section icon={Dna} title="Cargos" count={data.cargos.length}>
                <div className="space-y-1.5">
                  {data.cargos.map((c) => (
                    <div
                      key={c.cargo_id}
                      className="flex items-center justify-between gap-2 rounded-md bg-muted/40 px-3 py-1.5 text-sm"
                    >
                      <span className="font-medium text-foreground">
                        {c.canonical_name ?? c.cargo_id.slice(0, 8)}
                      </span>
                      <span className="shrink-0 font-mono text-[11px] text-muted-foreground">
                        {[c.cargo_type, c.cargo_role].filter(Boolean).join(' · ')}
                      </span>
                    </div>
                  ))}
                </div>
              </Section>
            )}

            {/* Targeting */}
            {data.targeting.length > 0 && (
              <Section icon={Crosshair} title="Targeting" count={data.targeting.length}>
                <div className="space-y-1.5">
                  {data.targeting.map((t) => (
                    <div key={t.targeting_id} className="rounded-md bg-muted/40 px-3 py-1.5 text-sm">
                      <span className="font-medium text-foreground">
                        {t.target_name ?? t.target_type ?? 'Target'}
                      </span>
                      <p className="font-mono text-[11px] text-muted-foreground">
                        {[t.target_type, t.target_cell_type, t.targeting_strategy].filter(Boolean).join(' · ')}
                      </p>
                    </div>
                  ))}
                </div>
              </Section>
            )}

            {/* Processes */}
            {data.processes.length > 0 && (
              <Section icon={Cog} title="Processes" count={data.processes.length}>
                <div className="space-y-1.5">
                  {data.processes.map((p) => (
                    <div key={p.process_id} className="rounded-md bg-muted/40 px-3 py-1.5 text-sm">
                      <span className="font-medium text-foreground">
                        {p.process_stage ?? 'Process'}
                      </span>
                      <p className="font-mono text-[11px] text-muted-foreground">
                        {[p.method, p.device].filter(Boolean).join(' · ')}
                      </p>
                    </div>
                  ))}
                </div>
              </Section>
            )}
          </div>

          {/* Physicochemical */}
          {data.physicochemical.length > 0 && (
            <Section icon={Ruler} title="Physicochemical measurements" count={data.physicochemical.length}>
              <div className="flex flex-wrap gap-2">
                {data.physicochemical.map((m) => (
                  <Chip key={m.measurement_id}>
                    {m.metric_code ?? 'metric'}:{' '}
                    {m.value_numeric != null
                      ? `${m.value_numeric}${m.unit ? ` ${m.unit}` : ''}`
                      : m.value_text ?? '—'}
                  </Chip>
                ))}
              </div>
            </Section>
          )}

          {/* Arms + outcomes */}
          <Section icon={FlaskConical} title="Experimental arms" count={data.arms.length}>
            {data.arms.length > 0 ? (
              <div className="space-y-3">
                {data.arms.map((arm) => (
                  <ArmCard key={arm.arm_id} arm={arm} />
                ))}
              </div>
            ) : (
              <p className="rounded-md border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
                No experimental arms recorded for this formulation.
              </p>
            )}
          </Section>
        </>
      )}
    </div>
  );
}
