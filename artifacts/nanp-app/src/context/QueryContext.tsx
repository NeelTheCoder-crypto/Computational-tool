import React, { createContext, useContext, useState, ReactNode } from 'react';
import type { RecommendationInput } from '@workspace/api-client-react';

interface QueryContextType {
  query: RecommendationInput | null;
  setQuery: (query: RecommendationInput | null) => void;
}

const QueryContext = createContext<QueryContextType | undefined>(undefined);

export function QueryProvider({ children }: { children: ReactNode }) {
  const [query, setQuery] = useState<RecommendationInput | null>(null);

  return (
    <QueryContext.Provider value={{ query, setQuery }}>
      {children}
    </QueryContext.Provider>
  );
}

export function useQueryContext() {
  const context = useContext(QueryContext);
  if (context === undefined) {
    throw new Error('useQueryContext must be used within a QueryProvider');
  }
  return context;
}
