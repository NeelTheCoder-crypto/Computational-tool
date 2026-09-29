import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Route, Switch } from 'wouter';
import Layout from './components/Layout';
import SheetFinder from './pages/sheet-finder';
import { BrowseSheet, SheetRecordDetail } from './pages/sheet-records';
import NotFound from './pages/not-found';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Layout>
        <Switch>
          <Route path="/" component={SheetFinder} />
          <Route path="/browse" component={BrowseSheet} />
          <Route path="/carrier/:row" component={SheetRecordDetail} />
          <Route component={NotFound} />
        </Switch>
      </Layout>
    </QueryClientProvider>
  );
}
