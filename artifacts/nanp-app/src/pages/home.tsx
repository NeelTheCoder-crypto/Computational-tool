import React from 'react';
import { useGetDatabaseStats, useGetOptions } from '@workspace/api-client-react';
import { useQueryContext } from '../context/QueryContext';
import { useLocation } from 'wouter';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Database, FileText, FlaskConical, Beaker, Activity } from 'lucide-react';

export default function Home() {
  const [, setLocation] = useLocation();
  const { setQuery } = useQueryContext();
  const { data: stats } = useGetDatabaseStats();
  const { data: options } = useGetOptions();

  const [nucleicAcid, setNucleicAcid] = React.useState<string>('');
  const [disease, setDisease] = React.useState<string>('');
  const [route, setRoute] = React.useState<string>('');

  const handleAnalyze = () => {
    if (nucleicAcid && disease && route) {
      setQuery({
        nucleic_acid: nucleicAcid,
        disease: disease,
        route_of_administration: route,
      });
      setLocation('/results');
    }
  };

  const isReady = nucleicAcid && disease && route;

  return (
    <div className="min-h-[100dvh] w-full flex flex-col scientific-grid">
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

      <main className="flex-1 flex flex-col items-center justify-center p-6 w-full max-w-5xl mx-auto">
        <div className="text-center mb-12 max-w-2xl">
          <h2 className="text-4xl md:text-5xl font-serif text-foreground font-medium leading-tight mb-6">
            Identify optimal nucleic acid delivery carriers.
          </h2>
          <p className="text-lg text-muted-foreground">
            A precision scientific decision-support tool. Enter your therapeutic target to receive AI-synthesized carrier recommendations backed by peer-reviewed literature.
          </p>
        </div>

        <Card className="w-full max-w-3xl shadow-xl shadow-primary/5 border-border/60 bg-background/95 backdrop-blur">
          <CardContent className="p-8">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="space-y-3">
                <label className="text-sm font-medium text-foreground block">
                  Nucleic Acid Type
                </label>
                <Select value={nucleicAcid} onValueChange={setNucleicAcid}>
                  <SelectTrigger data-testid="select-nucleic-acid">
                    <SelectValue placeholder="Select type..." />
                  </SelectTrigger>
                  <SelectContent>
                    {options?.nucleic_acids?.map((na) => (
                      <SelectItem key={na} value={na}>
                        {na}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-3">
                <label className="text-sm font-medium text-foreground block">
                  Target Disease
                </label>
                <Select value={disease} onValueChange={setDisease}>
                  <SelectTrigger data-testid="select-disease">
                    <SelectValue placeholder="Select disease..." />
                  </SelectTrigger>
                  <SelectContent>
                    {options?.diseases?.map((d) => (
                      <SelectItem key={d} value={d}>
                        {d}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-3">
                <label className="text-sm font-medium text-foreground block">
                  Route of Administration
                </label>
                <Select value={route} onValueChange={setRoute}>
                  <SelectTrigger data-testid="select-route">
                    <SelectValue placeholder="Select route..." />
                  </SelectTrigger>
                  <SelectContent>
                    {options?.routes_of_administration?.map((r) => (
                      <SelectItem key={r} value={r}>
                        {r}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="mt-8 flex justify-end">
              <Button 
                onClick={handleAnalyze} 
                disabled={!isReady} 
                size="lg" 
                className="w-full md:w-auto font-medium"
                data-testid="button-analyze"
              >
                Synthesize Recommendation
              </Button>
            </div>
          </CardContent>
        </Card>

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
