/**
 * Minimal QueryContext stub kept for compatibility with results.tsx during the
 * transition to the database-explorer frontend (task #7).  The main app entry
 * (App.tsx) no longer uses this context; results.tsx is legacy dead-code that
 * will be replaced when task #7 ships.
 */
import React, { createContext, useContext, useState } from 'react';

interface RecommendationQuery {
  nucleic_acid: string;
  disease: string;
  route_of_administration: string;
}

interface QueryContextValue {
  query: RecommendationQuery | null;
  setQuery: (q: RecommendationQuery | null) => void;
}

const QueryContext = createContext<QueryContextValue>({
  query: null,
  setQuery: () => undefined,
});

export function QueryContextProvider({ children }: { children: React.ReactNode }) {
  const [query, setQuery] = useState<RecommendationQuery | null>(null);
  return (
    <QueryContext.Provider value={{ query, setQuery }}>
      {children}
    </QueryContext.Provider>
  );
}

export function useQueryContext() {
  return useContext(QueryContext);
}
