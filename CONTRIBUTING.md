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

If you later add tests (e.g., Jest or Playwright):
npm run test
npm run test:coverage

Pull requests should include or update relevant tests.

---

## Pull Request Checklist

- [ ] Code is formatted (Prettier)
- [ ] Lint passes (ESLint)
- [ ] Build succeeds (npm run build)
- [ ] Commits follow conventional style
- [ ] Description explains the change clearly

---

Happy hacking!
