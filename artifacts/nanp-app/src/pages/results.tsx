import React, { useEffect, useState, useRef } from 'react';
import { useLocation } from 'wouter';
import { useGetRecommendation } from '@workspace/api-client-react';
import { useQueryContext } from '../context/QueryContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { 
  ArrowLeft, FileText, Beaker, CheckCircle2, XCircle, 
  Dna, Database, BookOpen, AlertCircle
} from 'lucide-react';
import type { RecommendationResult } from '@workspace/api-client-react/src/generated/api.schemas';

const LOADING_MESSAGES = [
  "Querying scientific literature database...",
  "Retrieving experimental evidence...",
  "Cross-referencing formulation parameters...",
  "Synthesizing scientific rationale...",
  "Finalizing recommendation..."
];

export default function Results() {
  const [, setLocation] = useLocation();
  const { query, setQuery } = useQueryContext();
  const getRecommendation = useGetRecommendation();
  
  const [result, setResult] = useState<RecommendationResult | null>(null);
  const [loadingMsgIdx, setLoadingMsgIdx] = useState(0);
  const [progress, setProgress] = useState(0);
  
  const initialized = useRef(false);

  useEffect(() => {
    if (!query) {
      setLocation('/');
      return;
    }

    if (!initialized.current) {
      initialized.current = true;
      getRecommendation.mutate({ data: query }, {
        onSuccess: (data) => {
          setResult(data);
        },
        onError: () => {
          // Handle error state gracefully by keeping result null or handling error
        }
      });
    }
  }, [query, getRecommendation, setLocation]);

  useEffect(() => {
    if (getRecommendation.isPending) {
      const interval = setInterval(() => {
        setLoadingMsgIdx((prev) => (prev + 1) % LOADING_MESSAGES.length);
      }, 3000);
      
      const progressInterval = setInterval(() => {
        setProgress(p => Math.min(p + (100 / 150), 95)); // roughly 15 seconds to 95%
      }, 100);

      return () => {
        clearInterval(interval);
        clearInterval(progressInterval);
      };
    } else {
      setProgress(100);
    }
  }, [getRecommendation.isPending]);

  const handleNewAnalysis = () => {
    setQuery(null);
    setLocation('/');
  };

  if (!query) return null;

  if (getRecommendation.isPending || !result) {
    return (
      <div className="min-h-[100dvh] w-full flex flex-col items-center justify-center p-6 bg-background">
        <div className="w-full max-w-md space-y-8 text-center">
          <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center animate-pulse">
            <Database className="w-8 h-8 text-primary" />
          </div>
          <div className="space-y-4">
            <h2 className="text-xl font-serif text-foreground font-medium animate-pulse">
              {LOADING_MESSAGES[loadingMsgIdx]}
            </h2>
            <Progress value={progress} className="h-1.5 w-full" />
            <p className="text-sm text-muted-foreground font-mono">
              Target: {query.nucleic_acid} • {query.disease} • {query.route_of_administration}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] w-full bg-background pb-20">
      <header className="w-full py-4 px-6 border-b border-border bg-card sticky top-0 z-10 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={handleNewAnalysis} className="gap-2">
            <ArrowLeft className="w-4 h-4" />
            New Analysis
          </Button>
          <div className="h-4 w-px bg-border" />
          <div className="flex items-center gap-2 text-sm text-muted-foreground font-mono">
            <span>{query.nucleic_acid}</span>
            <span className="text-border">•</span>
            <span>{query.disease}</span>
            <span className="text-border">•</span>
            <span>{query.route_of_administration}</span>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto p-6 md:p-8 mt-6 grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Main Column */}
        <div className="lg:col-span-8 space-y-8">
          
          <section>
            <div className="flex items-start justify-between mb-4">
              <div>
                <p className="text-sm font-semibold tracking-wider text-primary uppercase mb-2">Recommended Carrier</p>
                <h1 className="text-4xl font-serif text-foreground mb-2">
                  {result.recommended_carrier}
                </h1>
              </div>
              <Badge variant={result.confidence as any} className="capitalize text-sm px-3 py-1 mt-1">
                {result.confidence} Confidence
              </Badge>
            </div>
            
            <Card className="bg-primary/5 border-primary/10 shadow-none">
              <CardContent className="p-6">
                <h3 className="flex items-center gap-2 text-lg font-serif font-medium text-foreground mb-3">
                  <FileText className="w-5 h-5 text-primary" />
                  Scientific Rationale
                </h3>
                <p className="text-foreground leading-relaxed">
                  {result.scientific_rationale}
                </p>
              </CardContent>
            </Card>
          </section>

          <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <h3 className="flex items-center gap-2 text-lg font-serif font-medium">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                Advantages
              </h3>
              <ul className="space-y-3">
                {result.advantages.map((adv, i) => (
                  <li key={i} className="flex items-start gap-3 text-sm text-muted-foreground">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5 shrink-0" />
                    <span>{adv}</span>
                  </li>
                ))}
              </ul>
            </div>
            
            <div className="space-y-4">
              <h3 className="flex items-center gap-2 text-lg font-serif font-medium">
                <AlertCircle className="w-5 h-5 text-rose-600" />
                Limitations
              </h3>
              <ul className="space-y-3">
                {result.limitations.map((lim, i) => (
                  <li key={i} className="flex items-start gap-3 text-sm text-muted-foreground">
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-500 mt-1.5 shrink-0" />
                    <span>{lim}</span>
                  </li>
                ))}
              </ul>
            </div>
          </section>

          <section className="pt-6 border-t border-border">
            <h3 className="flex items-center gap-2 text-xl font-serif font-medium mb-6">
              <BookOpen className="w-5 h-5 text-primary" />
              Supporting Literature
            </h3>
            <div className="space-y-4">
              {result.supporting_publications.map((pub, i) => (
                <Card key={i} className="overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                  <CardHeader className="bg-muted/30 pb-4">
                    <CardTitle className="text-base leading-snug">{pub.title}</CardTitle>
                    <CardDescription className="text-xs space-y-1">
                      <div>{pub.authors}</div>
                      <div className="text-foreground/70 font-medium">
                        {pub.journal} • {pub.year} {pub.doi && `• DOI: ${pub.doi}`}
                      </div>
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="pt-4 text-sm text-muted-foreground">
                    <span className="font-medium text-foreground mr-2">Relevance:</span>
                    {pub.relevance}
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>
          
        </div>

        {/* Sidebar Column */}
        <div className="lg:col-span-4 space-y-6">
          
          <Card className="bg-card shadow-sm border-border">
            <CardHeader className="pb-4 border-b border-border">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Beaker className="w-5 h-5 text-muted-foreground" />
                Key Components
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              <ul className="space-y-3">
                {result.key_components.map((comp, i) => (
                  <li key={i} className="flex items-center justify-between text-sm py-2 border-b border-border/50 last:border-0 last:pb-0">
                    <span className="font-medium text-foreground">{comp}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          <Card className="bg-card shadow-sm border-border">
            <CardHeader className="pb-4 border-b border-border">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Dna className="w-5 h-5 text-muted-foreground" />
                Supporting Mechanisms
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              <ul className="space-y-4">
                {result.supporting_mechanisms.map((mech, i) => (
                  <li key={i} className="text-sm text-muted-foreground leading-relaxed">
                    {mech}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          {result.alternative_formulations.length > 0 && (
            <div className="pt-4">
              <h4 className="text-sm font-semibold tracking-wider text-muted-foreground uppercase mb-4">
                Alternative Formulations
              </h4>
              <div className="space-y-3">
                {result.alternative_formulations.map((alt, i) => (
                  <Card key={i} className="bg-muted/30 shadow-none border-border">
                    <CardHeader className="p-4 pb-2">
                      <CardTitle className="text-sm font-medium">{alt.name}</CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 pt-0 text-xs text-muted-foreground">
                      <p className="mb-2">{alt.rationale}</p>
                      {alt.materials && alt.materials.length > 0 && (
                        <p className="text-foreground/70 font-mono">
                          Materials: {alt.materials.join(', ')}
                        </p>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

        </div>
      </main>
    </div>
  );
}
