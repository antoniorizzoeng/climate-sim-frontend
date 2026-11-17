# ClimateSim frontend

An interactive workspace for the two-dimensional advection–diffusion solver. Draw a scalar field or select a plane from a NetCDF file, set its environment, and inspect the simulation as frames arrive.

## Try the mock workspace

Use the current Node.js 22 LTS patch release (22.22.2 or later in the 22.x line) and npm.

```sh
npm ci
npm run dev:mock
```

Open [localhost:3000](http://localhost:3000). Paint on the initial hotspot, choose **Conditions**, then select **Run simulation**. Use **Space** to play or pause and **← / →** to step through written frames. Hover over a cell to see its coordinates and value. The run inspector offers MP4, GIF, native-resolution PNG, and raw NetCDF downloads.

The browser mock uses MSW. Its fields, runs, and exports live in memory for the current page session. Uploading any file produces a sample dataset with a temperature variable, time and level coordinates, a humidity variable, and missing cells. The mock retains the original uploaded bytes for download. It uses a lightweight transport approximation for playback. Mock downloads encode the selected simulation, including its requested frame rate and colors. MP4 encoding in mock mode requires browser WebCodecs support.

## Connect the backend

```sh
NEXT_PUBLIC_API_URL=http://localhost:8000 npm run dev
```

The URL shown is the default. For production, set the same public variable when running `npm run build`, then use `npm start`. The API must allow the frontend origin and expose the float32 grid headers. The mock starts only with `NEXT_PUBLIC_MOCK_API=1`.

## Working with fields and runs

- **Upload** a NetCDF file or drop it on the upload control. Select the variable and an index for each extra dimension. The preview colors missing cells with the chosen replacement. The fill starts at the finite plane mean. Supply a value explicitly for an all-missing plane.
- **Load into canvas** copies the selected plane, sampling with a stride when the longest side exceeds 512 cells. Extremely thin sampled axes expand to the four-cell drawing minimum. Running the upload directly uses the original grid. Drawings support 4–1024 cells per axis. The eraser restores the lower end of the drawing range. Drawing and hover both place row zero at the bottom.
- **Conditions** displays the joint advection–diffusion stability limit, clamps the time step, and pairs opposite periodic edges. Available boundaries come from the engine configuration. Starting a run calls server validation and shows any warnings before submission.
- **Playback** uses the resolved output interval and the final step to label simulation time. The scrubber grows as frames become readable. Frame downloads keep the selected color range. Hover reads one float32 cell.
- **History** pages through fields and runs. Fields remain active for seven days after use and archived for another thirty. An archived original remains downloadable and running the field reactivates it. Completed run outputs expire after seven days. Use **Rerun** while the source remains available.

## Development checks

```sh
npm run api:generate
npm run format
npm run lint
npm run typecheck
npm test
npm run build
npx playwright install chromium
npm run test:e2e
```

Playwright starts its own mock server on port 3100. On Linux hosts missing Chromium system libraries, CI uses `npx playwright install --with-deps chromium`.

The API source of truth is [api/openapi.yaml](api/openapi.yaml). Regenerate [src/lib/schema.ts](src/lib/schema.ts) after contract changes. The App Router workspace owns draft and run selection state. Components handle the drawing surface, input forms, frame cache, downloads, and history. Browser and component tests share the handlers in [src/mocks](src/mocks).
