import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, expect, it, vi } from 'vitest';
import { History } from '@/components/History';
import { baseUrl } from '@/lib/api';
import { field, simulation, storage } from './fixtures/simulation';

const recent = simulation({ id: 'newer-run', name: 'Recent simulation' });
const expired = simulation({ id: 'older-run', status: 'expired' });
const server = setupServer(
  http.get(baseUrl + '/storage', () => HttpResponse.json(storage)),
);
beforeAll(() => server.listen({ onUnhandledFrame: 'error' }));
afterEach(() => {
  server.resetHandlers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
afterAll(() => server.close());

function history() {
  const handlers = { openField: vi.fn(), openRun: vi.fn(), onDelete: vi.fn() };
  render(<History {...handlers} />);
  return handlers;
}

it('paginates with the next cursor, opens and reruns an expired record, and refreshes after deletion', async () => {
  let deleted = false;
  const queries: (string | null)[] = [];
  const rerun = simulation({ id: 'restored-run', status: 'queued', frames: 0 });
  server.use(
    http.get(baseUrl + '/runs', ({ request }) => {
      const cursor = new URL(request.url).searchParams.get('cursor');
      queries.push(cursor);
      return HttpResponse.json(
        cursor
          ? { items: [expired], total: 1, total_bytes: 1024, next_cursor: null }
          : {
              items: [recent],
              total: 1,
              total_bytes: 1024,
              next_cursor: deleted ? null : recent.id,
            },
      );
    }),
    http.post(baseUrl + '/runs/' + expired.id + '/rerun', () =>
      HttpResponse.json(rerun),
    ),
    http.delete(baseUrl + '/runs/' + expired.id, () => {
      deleted = true;
      return new HttpResponse(null, { status: 204 });
    }),
  );
  const actions = history();
  const previous = screen.getByRole('button', { name: 'Previous' });
  const next = screen.getByRole('button', { name: 'Next' });
  await screen.findByText('Recent simulation');
  expect(previous).toBeDisabled();
  fireEvent.click(next);
  await screen.findByText('expired');
  expect(screen.getByText(/^.*· Expires /)).toBeVisible();
  expect(next).toBeDisabled();
  fireEvent.click(previous);
  await screen.findByText('Recent simulation');
  fireEvent.click(next);
  await screen.findByText('expired');
  fireEvent.click(screen.getByRole('button', { name: 'View' }));
  expect(actions.openRun).toHaveBeenLastCalledWith(expired);
  fireEvent.click(screen.getByRole('button', { name: 'Rerun' }));
  await waitFor(() => expect(actions.openRun).toHaveBeenLastCalledWith(rerun));
  fireEvent.click(screen.getByRole('button', { name: 'Delete ' + expired.id }));
  fireEvent.click(screen.getByRole('button', { name: 'Keep' }));
  expect(
    screen.queryByRole('button', { name: 'Confirm delete' }),
  ).not.toBeInTheDocument();
  expect(deleted).toBe(false);
  fireEvent.click(screen.getByRole('button', { name: 'Delete ' + expired.id }));
  fireEvent.click(screen.getByRole('button', { name: 'Confirm delete' }));
  await screen.findByText('Recent simulation');
  expect(actions.onDelete).toHaveBeenCalledExactlyOnceWith(expired.id);
  expect(screen.getByText('Page 1')).toBeVisible();
  expect(next).toBeDisabled();
  expect(queries).toEqual([null, recent.id, null, recent.id, null]);
});

it('retries loading, opens a field and surfaces a delete conflict before successful removal', async () => {
  let available = true;
  const listing = vi
    .fn()
    .mockReturnValueOnce(
      HttpResponse.json({ detail: 'History temporarily unavailable' }, { status: 503 }),
    )
    .mockImplementation(() =>
      HttpResponse.json({ items: [], total: 0, total_bytes: 0, next_cursor: null }),
    );
  const del = vi
    .fn()
    .mockReturnValueOnce(
      HttpResponse.json({ detail: 'An active run uses this field.' }, { status: 409 }),
    )
    .mockImplementation(() => {
      available = false;
      return new HttpResponse(null, { status: 204 });
    });
  server.use(
    http.get(baseUrl + '/runs', listing),
    http.get(baseUrl + '/fields', () =>
      HttpResponse.json({
        items: available ? [field] : [],
        total: 1,
        total_bytes: 1024,
        next_cursor: null,
      }),
    ),
    http.delete(baseUrl + '/fields/' + field.id, del),
  );
  const actions = history();
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'History temporarily unavailable',
  );
  fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
  await screen.findByText('No saved runs yet.');
  fireEvent.click(screen.getByRole('button', { name: 'Fields' }));
  await screen.findByText(field.name);
  expect(screen.getByText(/^.*· Archives /)).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: 'Use field' }));
  expect(actions.openField).toHaveBeenCalledExactlyOnceWith(field);
  fireEvent.click(screen.getByRole('button', { name: 'Delete ' + field.id }));
  const confirm = screen.getByRole('button', { name: 'Confirm delete' });
  fireEvent.click(confirm);
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'An active run uses this field.',
  );
  expect(actions.onDelete).not.toHaveBeenCalled();
  fireEvent.click(confirm);
  await screen.findByText('No saved fields yet.');
  expect(actions.onDelete).toHaveBeenCalledExactlyOnceWith(field.id);
});

it('downloads the original of an archived drawn field with a NetCDF extension', async () => {
  const download = vi.fn();
  const revoke = vi.fn();
  vi.stubGlobal(
    'URL',
    class extends URL {
      static createObjectURL = () => 'blob:field';
      static revokeObjectURL = revoke;
    },
  );
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
    this: HTMLAnchorElement,
  ) {
    download(this.download);
  });
  server.use(
    http.get(baseUrl + '/runs', () =>
      HttpResponse.json({ items: [], total: 0, total_bytes: 0, next_cursor: null }),
    ),
    http.get(baseUrl + '/fields', () =>
      HttpResponse.json({
        items: [{ ...field, state: 'archived' }],
        total: 1,
        total_bytes: 1024,
        next_cursor: null,
      }),
    ),
    http.get(
      baseUrl + '/fields/' + field.id + '/original',
      () => new HttpResponse('CDF'),
    ),
  );
  history();
  fireEvent.click(screen.getByRole('button', { name: 'Fields' }));
  await screen.findByText('archived');
  fireEvent.click(screen.getByRole('button', { name: 'Original' }));
  await waitFor(() =>
    expect(download).toHaveBeenCalledExactlyOnceWith(field.name + '.nc'),
  );
  await waitFor(() => expect(revoke).toHaveBeenCalledWith('blob:field'), {
    timeout: 2000,
  });
});

it('debounces server filters together, preserves the URL and resets pagination', async () => {
  const requests: URLSearchParams[] = [];
  window.history.replaceState(null, '', '/?keep=value');
  server.use(
    http.get(baseUrl + '/runs', ({ request }) => {
      const params = new URL(request.url).searchParams;
      requests.push(params);
      return HttpResponse.json({
        items: [recent],
        next_cursor: params.has('cursor') ? null : 'page2',
        total: 24,
        total_bytes: 1536,
      });
    }),
  );
  history();
  await screen.findByText('24 matching runs · 1.5 KiB');
  fireEvent.click(screen.getByRole('button', { name: 'Next' }));
  await screen.findByText('Page 2');
  await waitFor(() => expect(requests.at(-1)?.get('cursor')).toBe('page2'));
  fireEvent.change(screen.getByLabelText('Search by name'), {
    target: { value: 'Arc' },
  });
  fireEvent.change(screen.getByLabelText('Search by name'), {
    target: { value: 'Arctic' },
  });
  fireEvent.change(screen.getByLabelText('Created from'), {
    target: { value: '2026-03-28' },
  });
  fireEvent.change(screen.getByLabelText('Created through'), {
    target: { value: '2026-03-29' },
  });
  fireEvent.change(screen.getByLabelText('Sort'), { target: { value: 'size_desc' } });
  await screen.findByText('Page 1');
  const expected = {
    q: 'Arctic',
    created_from: new Date('2026-03-28T00:00:00').toISOString(),
    created_to: new Date('2026-03-30T00:00:00').toISOString(),
    sort: 'size_desc',
  };
  await waitFor(() =>
    expect(Object.fromEntries(requests.at(-1)!)).toEqual({ ...expected, limit: '10' }),
  );
  expect(requests).toHaveLength(3);
  expect(Object.fromEntries(new URLSearchParams(window.location.search))).toEqual({
    ...expected,
    keep: 'value',
    history_tab: 'runs',
  });
  window.history.replaceState(null, '', '/');
});

it('restores field filters from the URL and renders the storage breakdown', async () => {
  window.history.replaceState(
    null,
    '',
    '/?q=ice&sort=name_desc&history_tab=fields&created_from=2026-02-02T12:00:00Z&created_to=2026-02-04T12:00:00Z',
  );
  server.use(
    http.get(baseUrl + '/fields', () =>
      HttpResponse.json({ items: [], next_cursor: null, total: 0, total_bytes: 0 }),
    ),
  );
  history();
  expect(await screen.findByText('2 KiB used by Climate Sim')).toBeVisible();
  for (const text of [
    'runs 1 KiB',
    'fields 512 B',
    'nowcasts 512 B',
    '6 KiB free of 8 KiB',
  ])
    expect(screen.getByText(text)).toBeVisible();
  expect(screen.getByRole('button', { name: 'Fields', pressed: true })).toBeVisible();
  expect(screen.getByLabelText('Search by name')).toHaveValue('ice');
  expect(screen.getByLabelText('Sort')).toHaveValue('name_desc');
  await screen.findByText('0 matching fields · 0 B');
  window.history.replaceState(null, '', '/');
});

it.each([
  ['runs', recent],
  ['fields', field],
] as const)(
  'renames %s inline via PATCH, including retry after rejection',
  async (tab, item) => {
    let name = item.name;
    let patch: unknown;
    server.use(
      http.get(baseUrl + '/runs', () =>
        HttpResponse.json({
          items: [{ ...recent, name }],
          total: 1,
          total_bytes: 1024,
          next_cursor: null,
        }),
      ),
      http.get(baseUrl + '/fields', () =>
        HttpResponse.json({
          items: [{ ...field, name }],
          total: 1,
          total_bytes: 32,
          next_cursor: null,
        }),
      ),
      http.patch(baseUrl + '/' + tab + '/' + item.id, async ({ request }) => {
        patch = await request.json();
        if (name === item.name && (patch as { name: string }).name === 'rejected')
          return HttpResponse.json({ detail: 'Rename unavailable' }, { status: 503 });
        name = (patch as { name: string }).name;
        return HttpResponse.json({ ...item, name });
      }),
    );
    history();
    if (tab === 'fields')
      fireEvent.click(screen.getByRole('button', { name: 'Fields' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Rename ' + item.name }));
    const input = screen.getByLabelText('New name');
    fireEvent.change(input, { target: { value: ' ' } });
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
    fireEvent.change(input, { target: { value: 'rejected' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await screen.findByText('Rename unavailable');
    fireEvent.change(input, { target: { value: '  November clouds  ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await screen.findByText('November clouds');
    expect(patch).toEqual({ name: 'November clouds' });
  },
);
