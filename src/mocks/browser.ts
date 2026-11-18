import { setupWorker } from 'msw/browser';
import { http, HttpResponse } from 'msw';
import { baseUrl } from '@/lib/api';
import { handlers } from './handlers';

export function startMock() {
  const basePath = process.env.NEXT_PUBLIC_DEMO_BASE_PATH;
  // Keep unmatched demo API requests in the browser as well.
  const demoFallback = basePath
    ? [http.all(`${baseUrl}/*`, () => HttpResponse.error())]
    : [];
  return setupWorker(...handlers, ...demoFallback).start({
    onUnhandledFrame: 'bypass',
    quiet: true,
    serviceWorker: { url: `${basePath ?? ''}/mockServiceWorker.js` },
  });
}
