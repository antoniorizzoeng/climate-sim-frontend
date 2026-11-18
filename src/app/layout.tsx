import type { Metadata } from 'next';
import '@fontsource-variable/dm-sans';
import '@fontsource/ibm-plex-mono/400.css';
import '@fontsource/ibm-plex-mono/500.css';
import './globals.css';
export const metadata: Metadata = {
  title: 'ClimateSim · Simulation workspace',
  description: 'An interactive laboratory for two-dimensional advection and diffusion.',
};
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        {process.env.NEXT_PUBLIC_DEMO_BASE_PATH && (
          <aside className="demo-banner" aria-label="Demo information">
            <div className="shell">
              <span>
                <strong>Demo</strong> · Simulated engine. Simulation and nowcast data
                stay in your browser.
              </span>
              <span>
                Run the real stack on your machine ·{' '}
                <a href="https://github.com/antoniorizzoeng/climate-sim-frontend#quick-start">
                  Frontend
                </a>{' '}
                /{' '}
                <a href="https://github.com/antoniorizzoeng/climate-sim-backend">
                  Backend
                </a>
              </span>
            </div>
          </aside>
        )}
        {children}
      </body>
    </html>
  );
}
