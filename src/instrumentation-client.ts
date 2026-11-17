// This entry runs only in the browser, before React hydrates the workspace.
declare global {
  interface Window {
    startClimateMock?: () => Promise<unknown>;
  }
}
if (process.env.NEXT_PUBLIC_MOCK_API === '1') {
  let worker: Promise<unknown> | undefined;
  window.startClimateMock = () => {
    worker ??= import('./mocks/browser')
      .then((m) => m.startMock())
      .catch((error) => {
        worker = undefined;
        throw error;
      });
    return worker;
  };
}
export {};
