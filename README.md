# ClimateSim frontend

An interactive workspace for 2D and 3D advection–diffusion simulations. Draw a scalar field, extrude a drawing into layers, or select a plane or volume from a NetCDF file. Set the flow and inspect the simulation as frames arrive.

## Run the full stack with Docker

From this checkout, run:

```sh
docker compose up --build
```

Open [localhost:3000](http://localhost:3000) once both services are healthy. Compose builds the standalone Next.js frontend and the MPI backend from [climate-sim-backend on main](https://github.com/antoniorizzoeng/climate-sim-backend/tree/main). The first build downloads and compiles the solver. The browser calls the API at `http://localhost:8000`, with CORS enabled for `http://localhost:3000`. Both ports must be free. To use a separately started frontend on port 3100, launch just the API with `CORS_ORIGINS=http://localhost:3100 docker compose up --build backend`. The named `simulations` volume stores fields, runs and exports under `/data`. Use `docker compose down` to stop the stack and preserve the data.

## Try the mock workspace

Use the current Node.js 22 LTS patch release (22.22.2 or later in the 22.x line) and npm.

```sh
npm ci
npm run dev:mock
```

Open [localhost:3000](http://localhost:3000). Choose an example or paint on the initial hotspot, choose **Conditions**, then select **Run simulation**. Use **Space** to play or pause and **← / →** to step through written frames. Hover over a cell to see its coordinates and value. The run inspector offers MP4, GIF, native-resolution PNG, and raw NetCDF downloads.

The browser mock uses MSW and requires service workers on localhost or HTTPS. Its fields, runs, and exports live in memory for the current page session. Uploading any file produces a sample dataset with a temperature variable, time and level coordinates, a humidity variable, and missing cells. The mock retains the original uploaded bytes for download. It uses a lightweight transport approximation for playback. Mock downloads encode the selected simulation, including its requested frame rate and colors. MP4 encoding in mock mode requires browser WebCodecs support.

## Connect the backend

```sh
NEXT_PUBLIC_API_URL=http://localhost:8000 npm run dev
```

The URL shown is the default. For production, set the same public variable when running `npm run build`, then run the standalone server as shown in the Dockerfile. The API must allow the frontend origin and expose the float32 grid headers. The mock starts only with `NEXT_PUBLIC_MOCK_API=1`.

## Working with fields and runs

- **Upload** a NetCDF file or drop it on the upload control. Select the variable and an index for each extra dimension. The preview colors missing cells with the chosen replacement. The fill starts at the finite plane mean. Supply a value explicitly for an all-missing plane.
- **Load into canvas** copies the selected plane, sampling with a stride when the longest side exceeds 512 cells. Extremely thin sampled axes expand to the four-cell drawing minimum. Running the upload directly uses the original grid. Drawings support 4–1024 cells per axis. The eraser restores the lower end of the drawing range. Drawing and hover both place row zero at the bottom.
- **Conditions** displays the joint advection–diffusion stability limit, clamps the time step, and pairs opposite periodic edges. Available boundaries come from the engine configuration. Starting a run calls server validation and shows any warnings before submission.
- **Playback** uses the resolved output interval and the final step to label simulation time. The scrubber grows as frames become readable. The player decodes upcoming float32 grids and shares them between the current and first-frame views. Choose **Smooth pixels** for interpolation or **Compare frames** to see the initial and current fields on the same scale. The sparkline tracks the mean of loaded grids. Display grids over 512 cells per axis are sampled, with exact hover values fetched on demand. PNG downloads use the engine’s native resolution and selected range.
- **3D playback** opens on the central Z slice. Choose an axis and layer, project the maximum or mean along an axis, or orbit the volume in WebGL2. PNG, MP4, and GIF use the selected slice or projection. Volume view keeps the last plane selection for these exports.
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
