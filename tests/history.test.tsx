import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, expect, it, vi } from 'vitest';
import { History } from '@/components/History';
import { baseUrl } from '@/lib/api';
import { field, simulation } from './fixtures/simulation';

const recent = simulation({ id: 'newer-run' });
const expired = simulation({ id: 'older-run', status: 'expired' });
const server = setupServer();
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
          ? { items: [expired], next_cursor: null }
          : { items: [recent], next_cursor: deleted ? null : recent.id },
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
  await screen.findByText('Run newer-ru');
  expect(previous).toBeDisabled();
  fireEvent.click(next);
  await screen.findByText('expired');
  expect(screen.getByText(/^.*· Expires /)).toBeVisible();
  expect(next).toBeDisabled();
  fireEvent.click(previous);
  await screen.findByText('Run newer-ru');
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
  await screen.findByText('Run newer-ru');
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
    .mockImplementation(() => HttpResponse.json({ items: [], next_cursor: null }));
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
      HttpResponse.json({ items: available ? [field] : [], next_cursor: null }),
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
      HttpResponse.json({ items: [], next_cursor: null }),
    ),
    http.get(baseUrl + '/fields', () =>
      HttpResponse.json({
        items: [{ ...field, state: 'archived' }],
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
