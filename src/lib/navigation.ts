import { useSyncExternalStore } from 'react';

export type View = 'workspace' | 'history' | 'sky' | 'settings';
export type SettingsSection = 'maps' | 'units' | 'data' | 'account';

export const mapsSettingsHref = '?view=settings&section=maps';

const viewChange = 'climatesim:view-change';
const currentSearch = () => window.location.search;
const noSearch = () => '';

function subscribe(update: () => void) {
  window.addEventListener('popstate', update);
  window.addEventListener(viewChange, update);
  return () => {
    window.removeEventListener('popstate', update);
    window.removeEventListener(viewChange, update);
  };
}

function readView(params: URLSearchParams): View {
  const view = params.get('view');
  if (view === 'settings' || view === 'sky' || view === 'history') return view;
  return !view && params.has('history_tab') ? 'history' : 'workspace';
}

export function useNavigation(): { view: View; section: SettingsSection } {
  const params = new URLSearchParams(
    useSyncExternalStore(subscribe, currentSearch, noSearch),
  );
  const section = params.get('section');
  return {
    view: readView(params),
    section:
      section === 'units' || section === 'data' || section === 'account'
        ? section
        : 'maps',
  };
}

export function navigate(view: View, section?: SettingsSection) {
  const url = new URL(window.location.href);
  const previous = readView(url.searchParams);
  const returnTo =
    previous === 'settings' ? window.history.state?.settingsReturnTo : url.href;
  if (view === 'workspace') url.searchParams.delete('view');
  else url.searchParams.set('view', view);
  if (section) url.searchParams.set('section', section);
  else url.searchParams.delete('section');
  if (view !== 'history') url.searchParams.delete('history_tab');
  if (url.href === window.location.href) return;
  pushUrl(url, view === 'settings' ? returnTo : undefined);
}

export function closeSettings() {
  const returnTo = window.history.state?.settingsReturnTo;
  if (typeof returnTo === 'string') pushUrl(returnTo);
  else navigate('workspace');
}

function pushUrl(url: URL | string, settingsReturnTo?: string) {
  window.history.pushState({ settingsReturnTo }, '', url);
  window.dispatchEvent(new Event(viewChange));
}
