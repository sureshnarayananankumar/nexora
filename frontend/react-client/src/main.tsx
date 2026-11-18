import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import '@fontsource-variable/inter';
import '@fontsource/jetbrains-mono/500.css';
import './styles/global.css';
import './styles/app.css';
import { App } from './App';
import { ApiError } from './api/client';
import { IS_DEMO } from './lib/demo';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 20_000,
      refetchOnWindowFocus: false,
      retry: (count, err) => !(err instanceof ApiError && err.status >= 400 && err.status < 500) && count < 2,
    },
  },
});

async function start() {
  if (IS_DEMO) {
    // Demo build only: tree-shaken out of normal builds because IS_DEMO is a build-time constant.
    const { installDemoApi } = await import('../../demo-api/demo-api.js');
    installDemoApi({ banner: 'Live demo with sample data · sign in with the prefilled account · changes stay in this tab' });
  }
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter basename={import.meta.env.BASE_URL.replace(/\/$/, '')}>
          <App />
        </BrowserRouter>
      </QueryClientProvider>
    </StrictMode>,
  );
}

void start();
