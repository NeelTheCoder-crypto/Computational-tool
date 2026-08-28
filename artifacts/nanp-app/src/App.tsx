import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Route, Switch } from 'wouter';
import Layout from './components/Layout';
import Finder from './pages/finder';
import Explorer from './pages/explorer';
import FormulationDetail from './pages/formulation';
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
          <Route path="/" component={Finder} />
          <Route path="/explore" component={Explorer} />
          <Route path="/explore/:tab" component={Explorer} />
          <Route path="/formulation/:id" component={FormulationDetail} />
          <Route component={NotFound} />
        </Switch>
      </Layout>
    </QueryClientProvider>
  );
}
