import { setupWorker } from 'msw/browser';
import { handlers } from './handlers';
export function startMock() {
  return setupWorker(...handlers).start({ onUnhandledFrame: 'bypass', quiet: true });
}
