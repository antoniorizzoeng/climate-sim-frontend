# Contributing Guidelines

Thank you for considering contributing to climate-sim-frontend!

---

## Development Workflow

1. Fork the repository and create your branch:
   git checkout -b feature/your-feature

2. Install dependencies:
   npm ci

3. Run the development server:
   npm run dev

4. Run lint and formatting checks:
   npm run lint
   npx prettier --check .

5. Commit and push changes.
   Pre-commit hooks will auto-format staged files.

6. Submit a Pull Request with a clear description of what was changed.

---

## Code Style

- Code formatting via Prettier (see .prettierrc)
- Linting via ESLint (Next.js config)
- 2-space indentation and single quotes enforced
- CI checks will fail if formatting or linting issues remain

---

## Testing

Vitest covers component and model behaviour. Playwright exercises the workspace with the browser mock. The CI workflow runs both suites. [Test scripts](package.json)

Pull requests should include or update relevant tests.

### Full-stack Playwright

Run the full-stack suite from the frontend repository with Node.js 22, Docker
Compose v2.24.4 or newer, and the Chromium system libraries installed.

```sh
npm ci
npx playwright install --only-shell chromium
npm run test:e2e:fullstack
```

The command builds the production frontend and the backend from its `main`
branch, with the solver revision set in `docker-compose.e2e.yml`. It starts a
dedicated Compose project and waits for both health checks. Keep host ports
3200 and 8300 free while it runs. The runner removes its containers and scratch
volume with `docker compose down -v`, including after a test failure.

Run a single test with `npm run test:e2e:fullstack -- -g 'NetCDF'`. For a local
Sky run that calls Open-Meteo from the backend, use
`E2E_NETWORK=1 npm run test:e2e:fullstack -- -g 'Sky'`. Sky is skipped in the
pull request and nightly workflow. The mocked Sky test remains part of
`npm run test:e2e`.

Build output goes to `artifacts/e2e-fullstack/compose-up.log`. On failure, see
the container logs and service status in that directory, and Playwright
traces and screenshots in its `playwright/` subdirectory. The full-stack
workflow uploads that directory on failure.

---

## Pull Request Checklist

- [ ] Code is formatted (Prettier)
- [ ] Lint passes (ESLint)
- [ ] Build succeeds (npm run build)
- [ ] Commits follow conventional style
- [ ] Description explains the change clearly

---

Happy hacking!
