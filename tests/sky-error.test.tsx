import { expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { Sky } from '@/components/sky/Sky';
import { baseUrl } from '@/lib/api';
import { handlers } from '@/mocks/handlers';
import { createNowcast } from '@/mocks/nowcasts';

it('shows the diagnostic from a failed wind-file probe when reopening a nowcast', async () => {
  const record = createNowcast({ lat: 28.76, lon: -17.89 });
  const diagnostic =
    'Installed engine ignores wind.mode=file. Sky nowcasts require engine issue #58';
  const server = setupServer(
    http.get(baseUrl + '/nowcasts/:id', () =>
      HttpResponse.json({ ...record, status: 'error', message: diagnostic }),
    ),
    ...handlers,
  );
  server.listen({ onUnhandledFrame: 'error' });
  try {
    render(<Sky online />);
    fireEvent.click(await screen.findByRole('button', { name: /28.760°/ }));
    expect(await screen.findByRole('alert')).toHaveTextContent(diagnostic);
    expect(screen.getByRole('button', { name: 'Refresh nowcast' })).toBeEnabled();
    expect(screen.queryByLabelText('Frame scrubber')).not.toBeInTheDocument();
  } finally {
    server.close();
  }
});
