// Generated from api/openapi.yaml by npm run api:generate.
export interface paths {
  '/health': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    /** Returns 503 when the run worker has stopped or is retrying a metadata write. */
    get: operations['health'];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/storage': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    /** Disk used by stored data and free space on the data volume (single local user; per-user quotas come later). */
    get: operations['getStorage'];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/config': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: operations['getServerConfig'];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/fields': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: operations['listFields'];
    put?: never;
    /** Upload a NetCDF file. The original is kept for download; selected planes are normalised per run. */
    post: operations['uploadField'];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/fields/drawn': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    /** Store a field drawn in the browser (single variable "u", no extra dimensions). */
    post: operations['createDrawnField'];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/fields/{fieldId}': {
    parameters: {
      query?: never;
      header?: never;
      path: {
        fieldId: components['parameters']['FieldId'];
      };
      cookie?: never;
    };
    get: operations['getField'];
    put?: never;
    post?: never;
    delete: operations['deleteField'];
    options?: never;
    head?: never;
    patch: operations['renameField'];
    trace?: never;
  };
  '/fields/{fieldId}/original': {
    parameters: {
      query?: never;
      header?: never;
      path: {
        fieldId: components['parameters']['FieldId'];
      };
      cookie?: never;
    };
    /** The uploaded file as received (drawn fields are served as CDF-5). Available while active or archived. */
    get: operations['downloadFieldOriginal'];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/fields/{fieldId}/preview.png': {
    parameters: {
      query?: never;
      header?: never;
      path: {
        fieldId: components['parameters']['FieldId'];
      };
      cookie?: never;
    };
    get: operations['getFieldPreview'];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/fields/{fieldId}/stats': {
    parameters: {
      query?: never;
      header?: never;
      path: {
        fieldId: components['parameters']['FieldId'];
      };
      cookie?: never;
    };
    /** Statistics of one plane (variable + extra-dimension indices). */
    get: operations['getFieldPlaneStats'];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/fields/{fieldId}/values': {
    parameters: {
      query?: never;
      header?: never;
      path: {
        fieldId: components['parameters']['FieldId'];
      };
      cookie?: never;
    };
    /** Raw float32 values of one plane or a window of it (hover readout, loading an upload into the canvas). */
    get: operations['getFieldValues'];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/runs': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    /** User runs only. The layer runs owned by a nowcast are excluded (their bytes count in /storage under nowcasts). */
    get: operations['listRuns'];
    put?: never;
    post: operations['createRun'];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/runs/validate': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    /** Same checks as POST /runs without starting anything, plus resolved values and cost estimates. */
    post: operations['validateRun'];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/runs/{runId}': {
    parameters: {
      query?: never;
      header?: never;
      path: {
        runId: components['parameters']['RunId'];
      };
      cookie?: never;
    };
    /** Status and progress. Poll ~2/s while running, ~every 2 s while queued; stop at done/error/expired. */
    get: operations['getRun'];
    put?: never;
    post?: never;
    /** Stops mpirun if queued/running (returns after all ranks exited), then deletes the run and its files. */
    delete: operations['deleteRun'];
    options?: never;
    head?: never;
    patch: operations['renameRun'];
    trace?: never;
  };
  '/runs/{runId}/rerun': {
    parameters: {
      query?: never;
      header?: never;
      path: {
        runId: components['parameters']['RunId'];
      };
      cookie?: never;
    };
    get?: never;
    put?: never;
    /** Start a new run with the same request (works for expired runs while the field exists). */
    post: operations['rerun'];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/runs/{runId}/frames/{n}.png': {
    parameters: {
      query?: never;
      header?: never;
      path: {
        runId: components['parameters']['RunId'];
        n: components['parameters']['FrameIndex'];
      };
      cookie?: never;
    };
    get: operations['getFramePng'];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/runs/{runId}/frames/{n}/values': {
    parameters: {
      query?: never;
      header?: never;
      path: {
        runId: components['parameters']['RunId'];
        n: components['parameters']['FrameIndex'];
      };
      cookie?: never;
    };
    get: operations['getFrameValues'];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/runs/{runId}/frames/{n}/volume': {
    parameters: {
      query?: never;
      header?: never;
      path: {
        runId: components['parameters']['RunId'];
        n: components['parameters']['FrameIndex'];
      };
      cookie?: never;
    };
    /** Sample one frame for client-side 3D rendering. */
    get: operations['getFrameVolume'];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/runs/{runId}/export.{format}': {
    parameters: {
      query?: never;
      header?: never;
      path: {
        runId: components['parameters']['RunId'];
        format: 'mp4' | 'gif';
      };
      cookie?: never;
    };
    /** Animation of all frames, rendered frame by frame into ffmpeg in a background worker (identical requests are coalesced and cached). Returns 202 with Retry-After until ready, then 200 with the file. Only when status is done. */
    get: operations['exportRun'];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/runs/{runId}/result.nc': {
    parameters: {
      query?: never;
      header?: never;
      path: {
        runId: components['parameters']['RunId'];
      };
      cookie?: never;
    };
    /** Raw engine output (CDF-5, u(time, y, x) or u(time, z, y, x)). Only when status is done. */
    get: operations['downloadResult'];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/nowcasts': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: operations['listNowcasts'];
    put?: never;
    /**
     * Advect cloud cover around an observing site for the next 1–12 hours.
     * @description Uses hourly Open-Meteo low, mid and high cloud cover and winds at 850, 500 and 300 hPa.
     *     Three FIFO runs transport the initial cloud layers on a local grid with zero-gradient edges.
     *     Transport omits cloud formation, dissipation and vertical motion. It is most useful for a few hours,
     *     especially before air from outside the domain reaches the site. The blend starts with transport and gives
     *     increasing weight to the Open-Meteo forecast as lead time grows. The transport weight is exp(−t/τ), where t
     *     is hours from data_time and τ is blend_tau_hours. At t = τ, transport contributes about 37%.
     *     Grid footprints must stay short of the poles.
     *     Coordinates of the site and surrounding grid are sent to Open-Meteo. A failed wind-file probe or
     *     unavailable forecast yields an error record with a diagnostic. Attribute model data to Open-Meteo.
     */
    post: operations['createNowcast'];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/nowcasts/{id}': {
    parameters: {
      query?: never;
      header?: never;
      path: {
        id: components['parameters']['NowcastId'];
      };
      cookie?: never;
    };
    get: operations['getNowcast'];
    put?: never;
    post?: never;
    /** Stop and delete the nowcast and its three layer runs. */
    delete: operations['deleteNowcast'];
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/nowcasts/{id}/refresh': {
    parameters: {
      query?: never;
      header?: never;
      path: {
        id: components['parameters']['NowcastId'];
      };
      cookie?: never;
    };
    get?: never;
    put?: never;
    /** Create a separate nowcast with the same parameters, bypassing the local hourly cache. */
    post: operations['refreshNowcast'];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
}
export type webhooks = Record<string, never>;
export interface components {
  schemas: {
    MessageError: {
      detail: string;
    };
    ValidationError: {
      detail: components['schemas']['ValidationIssue'][];
    };
    ValidationIssue: {
      loc: (string | number)[];
      msg: string;
      type: string;
    };
    /**
     * @default viridis
     * @enum {string}
     */
    Colormap:
      | 'viridis'
      | 'inferno'
      | 'magma'
      | 'plasma'
      | 'cividis'
      | 'turbo'
      | 'coolwarm'
      | 'gray';
    /** @enum {string} */
    BoundaryCondition: 'dirichlet' | 'neumann' | 'periodic';
    ServerConfig: {
      cpu_count: number;
      /** @description Ranks used when RunRequest.processes is omitted (all cores) */
      default_processes: number;
      colormaps: components['schemas']['Colormap'][];
      presets: components['schemas']['Preset'][];
      supported_boundary_conditions: components['schemas']['BoundaryCondition'][];
      disk_free_bytes: number;
      retention: {
        /** @constant */
        active_days: 7;
        /** @constant */
        archive_days: 30;
      };
    };
    /** @enum {string} */
    Preset: 'gaussian_hotspot' | 'constant_zero';
    ExtraDim: {
      name: string;
      size: number;
      /** @description Coordinate values (e.g. decoded times as ISO strings) when available, for the index picker labels. */
      values?: (number | string)[] | null;
    };
    Variable: {
      name: string;
      nx: number;
      ny: number;
      /** @description Size of the vertical dimension or 1 when absent */
      nz: number;
      /** @description Name of the vertical dimension when present */
      z_dim?: string;
      extra_dims: components['schemas']['ExtraDim'][];
      units?: string | null;
      long_name?: string | null;
      /** @description Spacing derived from 1-D coordinate variables with recognised CF units; null when unknown. */
      spacing?: components['schemas']['GridSpacing'] | null;
    };
    GridSpacing: {
      /** @description Mean spacing along x in length_unit */
      dx: number;
      dy: number;
      /** @description Only for a vertical length coordinate (not pressure) */
      dz?: number | null;
      /** @enum {string} */
      length_unit: 'm' | 'km';
      /** @description True when converted from degrees or when the coordinate spacing is non-uniform by more than 1%. */
      approximate: boolean;
    };
    /** @description Unit system of a run request. cell/t are grid units. */
    Units: {
      /** @enum {string} */
      length: 'cell' | 'm' | 'km';
      /** @enum {string} */
      time: 't' | 's' | 'h';
    };
    RenameRequest: {
      /** @description Trimmed; must not be blank */
      name: string;
    };
    StorageUsage: {
      /** @description runs_bytes + fields_bytes + nowcasts_bytes */
      used_bytes: number;
      runs_bytes: number;
      /** @description Active and archived fields */
      fields_bytes: number;
      /** @description Nowcast records including their layer runs */
      nowcasts_bytes: number;
      /** @description Free space on the data volume */
      free_bytes: number;
      /** @description Size of the data volume */
      total_bytes: number;
    };
    PlaneStats: {
      var: string;
      index: {
        [key: string]: number;
      };
      nx: number;
      ny: number;
      /** @description Over finite */
      min: number | null;
      max: number | null;
      /** @description Suggested default fill value */
      mean: number | null;
      missing_count: number;
    };
    Field: {
      id: string;
      /** @enum {string} */
      source: 'upload' | 'drawn';
      /** @description Display name; initially the original filename or the drawn name; editable with PATCH */
      name: string;
      /** @description Bytes on disk for this field (original */
      size_bytes: number;
      /** Format: date-time */
      created_at: string;
      /** Format: date-time */
      last_used_at?: string;
      /** @enum {string} */
      state: 'active' | 'archived';
      /**
       * Format: date-time
       * @description When it becomes archived (if active) or is deleted (if archived)
       */
      expires_at: string;
      variables: components['schemas']['Variable'][];
      default_var: string;
      /** @description Stats of default_var at index 0 (null-safe) */
      default_stats: components['schemas']['PlaneStats'];
    };
    FieldSource: {
      /**
       * @description discriminator enum property added by openapi-typescript
       * @enum {string}
       */
      kind: 'field';
      field_id: string;
      /** @description Defaults to Field.default_var */
      var?: string;
      /** @description Extra-dimension indices (default 0) */
      index?: {
        [key: string]: number;
      };
      /**
       * @description Select all layers when the third-to-last dimension is vertical. Otherwise use the selected plane.
       * @default false
       */
      volume?: boolean;
      /**
       * @description Number of layers to initialize from a selected plane (including a drawing). Applies to planes only.
       * @default 1
       */
      replicate_z?: number;
      /** @description Replaces missing cells. Required (422 otherwise) when the selected plane or volume has missing cells. */
      fill_value?: number | null;
    };
    PresetSource: {
      /**
       * @description discriminator enum property added by openapi-typescript
       * @enum {string}
       */
      kind: 'preset';
      preset: components['schemas']['Preset'];
      nx: number;
      ny: number;
      /** @default 1 */
      nz?: number;
    };
    RunSource:
      components['schemas']['FieldSource'] | components['schemas']['PresetSource'];
    /** @description Each edge defaults to dirichlet. */
    BoundaryConfig: {
      left?: components['schemas']['BoundaryCondition'];
      right?: components['schemas']['BoundaryCondition'];
      bottom?: components['schemas']['BoundaryCondition'];
      top?: components['schemas']['BoundaryCondition'];
      front?: components['schemas']['BoundaryCondition'];
      back?: components['schemas']['BoundaryCondition'];
    };
    RunRequest: {
      source: components['schemas']['RunSource'];
      /** @default 1 */
      dx?: number;
      /** @default 1 */
      dy?: number;
      /** @default 1 */
      dz?: number;
      /** @description Vertical diffusion coefficient. Defaults to D. */
      Dz?: number;
      /** @default 0 */
      vz?: number;
      /**
       * @description Diffusion coefficient
       * @default 0
       */
      D?: number;
      /** @default 0 */
      vx?: number;
      /** @default 0 */
      vy?: number;
      dt: number;
      steps: number;
      /** @description Mutually exclusive with frames */
      out_every?: number;
      /** @description Frames to keep (incl. initial and final). Default 101 when neither is given. */
      frames?: number;
      bc?: components['schemas']['BoundaryConfig'];
      /** @description Display name. Omitted → derived by the server (preset label or field name, plus the creation time). */
      name?: string;
      units?: components['schemas']['Units'];
      /** @description MPI ranks. Clients should omit it (the web app does). Omitted → chosen by the server from the grid size and cpu_count (enough cells per rank to be worth it), then reduced so the MPI_Dims_create grid fits nx and ny. For volumes, all ranks must fit a Cartesian factorization across nx, ny and nz. An explicit value that does not fit, or exceeds cpu_count, is rejected. */
      processes?: number;
    };
    ResolvedRun: {
      nx: number;
      ny: number;
      nz: number;
      dz: number;
      dt: number;
      steps: number;
      out_every: number;
      expected_frames: number;
      processes: number;
      dt_max: number | null;
      /** @description ≈ 8·nx·ny·nz·expected_frames + header */
      estimated_output_bytes: number;
    };
    RunValidation: {
      ok: boolean;
      errors: components['schemas']['ValidationIssue'][];
      /** @description Non-blocking, e.g. estimated output larger than free disk space, very long expected run. */
      warnings: string[];
      resolved: components['schemas']['ResolvedRun'] | null;
    };
    Run: {
      id: string;
      /** @description Display name (request.name or the server-derived default; editable with PATCH) */
      name: string;
      /** @description Bytes on disk for this run now (frames */
      size_bytes: number;
      /** @enum {string} */
      status: 'queued' | 'running' | 'done' | 'error' | 'expired';
      /** Format: date-time */
      created_at: string;
      /** Format: date-time */
      started_at?: string | null;
      /** Format: date-time */
      finished_at?: string | null;
      /**
       * Format: date-time
       * @description When outputs are deleted (done/error) or the record is deleted (expired)
       */
      expires_at: string | null;
      request: components['schemas']['RunRequest'];
      resolved: components['schemas']['ResolvedRun'];
      /** @description 1 = next; null unless queued */
      queue_position: number | null;
      step: number;
      time: number;
      /** @description Frames 0..frames-1 are written and readable */
      frames: number;
      elapsed_seconds?: number | null;
      /** @description Fixed default colour range for the whole run, from frame 0 (widened to include 0 when any edge is dirichlet). Advection–diffusion with these schemes cannot leave this range, so colours never shift during playback. A constant field renders as the colormap midpoint. Slices and projections of a nonuniform volume use the run range even when every pixel in the view has the same value. */
      display_range: number[] | null;
      /** @description Error text when status is error */
      message: string | null;
    };
    NowcastParams: {
      lat: number;
      lon: number;
      /**
       * @description Half the width of the square domain.
       * @default 300
       */
      radius_km?: number;
      /**
       * @description Horizon for window=now; ignored for tonight.
       * @default 6
       */
      hours?: number;
      /**
       * @description now: the next `hours` hours. tonight: from data_time until the end of the coming (or current) astronomical night (Sun below −18°), at most 24 h ahead. 422 when the site has no astronomical darkness in the next 24 h.
       * @default now
       * @enum {string}
       */
      window?: 'now' | 'tonight';
      /**
       * @description Simulation cells per side.
       * @default 96
       */
      resolution?: number;
      /**
       * @description E-folding time in hours for the transport weight in the blend.
       * @default 2
       */
      blend_tau_hours?: number;
      /**
       * @description Observer elevation above sea level in metres (1.5.0). Null → the elevation Open-Meteo reports for the site (90 m terrain model). Cloud below the observer is not counted in total/clear.
       * @default null
       */
      elevation_m?: number | null;
    };
    SiteElevation: {
      elevation_m: number;
      /** @enum {string} */
      source: 'user' | 'open-meteo';
      /** @description Share of each layer counted as above the observer (0 = entirely below the site, 1 = entirely above), derived once per record from the layer's altitude band at the site. total uses cover × weight per layer. */
      layer_weights: {
        low: number;
        mid: number;
        high: number;
      };
    };
    CloudFraction: number;
    SkyCover: {
      /** @description Raw layer cover (including any part below the observer). */
      low: components['schemas']['CloudFraction'];
      mid: components['schemas']['CloudFraction'];
      high: components['schemas']['CloudFraction'];
      /** @description Cloud above the observer (1.5.0): random overlap of cover × layer_weights. For the model series this replaces Open-Meteo's own total when any weight is below 1. Records without site_elevation keep the 1.4 meaning. */
      total: components['schemas']['CloudFraction'];
      /** @description One minus total cloud fraction. */
      clear: components['schemas']['CloudFraction'];
    };
    Nowcast: {
      /** @description Null for records created before 1.5.0 or before the forecast was fetched. */
      site_elevation: components['schemas']['SiteElevation'] | null;
      id: string;
      /** @enum {string} */
      status: 'fetching' | 'queued' | 'running' | 'done' | 'error';
      /** Format: date-time */
      created_at: string;
      params: components['schemas']['NowcastParams'];
      /**
       * Format: date-time
       * @description UTC valid hour of initial cloud cover. Open-Meteo best match can combine model cycles.
       */
      data_time: string | null;
      layers: {
        /** @enum {string} */
        layer: 'low' | 'mid' | 'high';
        run_id: string;
        /** @enum {integer} */
        pressure_hpa: 850 | 500 | 300;
      }[];
      /** @description Null until done. Includes the initial hour and the final frame at ten-minute spacing. */
      site:
        | {
            /** Format: date-time */
            time: string;
            /** @description Bilinear site samples. Total uses random overlap across layers. */
            nowcast: components['schemas']['SkyCover'];
            /** @description Open-Meteo site layers, linearly interpolated between UTC hours. Total is cloud above the observer (SkyCover.total); records before 1.5.0 keep Open-Meteo's own total. */
            model: components['schemas']['SkyCover'];
            /** @description Exponentially weighted transport and model values for each layer and for total (cloud above the observer). Clear is one minus blended total. */
            blend: components['schemas']['SkyCover'];
            /** @description Hourly 250 hPa wind speed in m/s held until the next hour. */
            jet_ms: number;
            /**
             * @description Rule of thumb from jet_ms only. Good below 20, fair from 20 through 35, poor above 35.
             * @enum {string}
             */
            seeing: 'good' | 'fair' | 'poor';
          }[]
        | null;
      /** @description Longest stretch of consecutive ten-minute samples with blended clear fraction at least 0.70 and good or fair seeing. When `night` is present only samples between dusk and dawn qualify (1.4.0). Ties go to the earliest stretch. Null until done or when no sample qualifies. */
      best_window: {
        /**
         * Format: date-time
         * @description Time of the first qualifying sample.
         */
        start: string;
        /**
         * Format: date-time
         * @description Time of the last qualifying sample (inclusive).
         */
        end: string;
        /** @description Mean blended clear fraction across the stretch. */
        mean_clear: components['schemas']['CloudFraction'];
        /**
         * @description Worst seeing category across the stretch.
         * @enum {string}
         */
        seeing: 'good' | 'fair';
      } | null;
      /** @description Local cell-centred equirectangular grid. The site is at fractional indices ((nx−1)/2, (ny−1)/2). */
      grid: {
        nx: number;
        ny: number;
        /** @description Eastward cell spacing in metres. */
        dx_m: number;
        /** @description Northward cell spacing in metres. */
        dy_m: number;
        /** @description Latitude of the southwest cell centre in degrees. */
        lat0: number;
        /** @description Longitude of the southwest cell centre in degrees. */
        lon0: number;
      };
      /** @description Darkness and Moon for the night covered by the record (null when the site has no astronomical night in the horizon). Times are UTC. Accuracy target: Sun events within 2 minutes, Moon altitude within 1°. */
      night: {
        /**
         * Format: date-time
         * @description End of astronomical twilight (Sun at −18°
         */
        dusk: string;
        /**
         * Format: date-time
         * @description Start of astronomical twilight (Sun at −18°
         */
        dawn: string;
        /** @description Every 10 minutes from max(dusk, data_time) to dawn. */
        moon: {
          /** Format: date-time */
          time: string;
          /** @description Topocentric altitude of the Moon's centre */
          altitude_deg: number;
          /** @description Illuminated fraction of the disc */
          illumination: number;
        }[];
      } | null;
      message: string | null;
      /**
       * Format: date-time
       * @description Seven days from completion for a terminal record.
       */
      expires_at: string;
    };
  };
  responses: {
    /** @description Sky nowcast record */
    NowcastRecord: {
      headers: {
        [name: string]: unknown;
      };
      content: {
        'application/json': components['schemas']['Nowcast'];
      };
    };
    /** @description Invalid request */
    ValidationError: {
      headers: {
        [name: string]: unknown;
      };
      content: {
        'application/json': components['schemas']['ValidationError'];
      };
    };
    /** @description Error */
    MessageError: {
      headers: {
        [name: string]: unknown;
      };
      content: {
        'application/json': components['schemas']['MessageError'];
      };
    };
    /** @description The native plane exceeds the available RAM allowance, or the requested downscale cannot fit the configured rendering budget. */
    PngMemoryLimit: {
      headers: {
        [name: string]: unknown;
      };
      content: {
        'application/json': components['schemas']['MessageError'];
      };
    };
    /** @description Little-endian float32, row-major [h, w], j = j0 first */
    Float32Grid: {
      headers: {
        /** @description Columns in this response */
        'X-Nx'?: number;
        /** @description Rows in this response */
        'X-Ny'?: number;
        'X-I0'?: number;
        'X-J0'?: number;
        'X-Stride'?: number;
        [name: string]: unknown;
      };
      content: {
        'application/octet-stream': unknown;
      };
    };
  };
  parameters: {
    NowcastId: string;
    FieldId: string;
    RunId: string;
    /** @description Axis perpendicular to the view */
    Axis: 'z' | 'y' | 'x';
    /** @description Zero-based layer along axis, default floor(axis length / 2). Ignored for projections. */
    Slice: number;
    /** @description Reduce along the selected axis */
    Projection: 'none' | 'max' | 'mean';
    FrameIndex: number;
    /** @description Variable name; defaults to Field.default_var. */
    Var: string;
    /** @description Extra-dimension indices, e.g. index[time]=3&index[depth]=0; missing ones default to 0. */
    Index: {
      [key: string]: number;
    };
    Colormap: components['schemas']['Colormap'];
    /** @description Must be given with vmax; finite and vmin < vmax */
    Vmin: number;
    Vmax: number;
    /** @description Downscale (area average) so the long side is at most this many pixels. Omit for native resolution (one pixel per cell). */
    MaxSide: number;
    I0: number;
    J0: number;
    /** @description Window width in cells (default to the edge) */
    W: number;
    /** @description Window height in cells (default to the edge) */
    H: number;
    /** @description Take every stride-th cell in both axes */
    Stride: number;
    Limit: number;
    /** @description Case-insensitive substring match on name (and id prefix) */
    Q: string;
    /** @description Inclusive lower bound on created_at */
    CreatedFrom: string;
    /** @description Exclusive upper bound on created_at */
    CreatedTo: string;
    /** @description Ties break on id. A cursor is only valid with the same q, created_from, created_to and sort (422 otherwise). */
    Sort:
      | 'created_desc'
      | 'created_asc'
      | 'size_desc'
      | 'size_asc'
      | 'name_asc'
      | 'name_desc';
    Cursor: string;
  };
  requestBodies: never;
  headers: never;
  pathItems: never;
}
export type $defs = Record<string, never>;
export interface operations {
  health: {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      /** @description OK */
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': {
            /** @enum {string} */
            status: 'ok';
            /** @description Engine binary path and version */
            engine: string;
            /** @description info.version of this contract, e.g. 1.4.0 */
            api_version: string;
          };
        };
      };
      503: components['responses']['MessageError'];
    };
  };
  getStorage: {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      /** @description OK */
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['StorageUsage'];
        };
      };
    };
  };
  getServerConfig: {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      /** @description OK */
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['ServerConfig'];
        };
      };
    };
  };
  listFields: {
    parameters: {
      query?: {
        limit?: components['parameters']['Limit'];
        cursor?: components['parameters']['Cursor'];
        /** @description Case-insensitive substring match on name (and id prefix) */
        q?: components['parameters']['Q'];
        /** @description Inclusive lower bound on created_at */
        created_from?: components['parameters']['CreatedFrom'];
        /** @description Exclusive upper bound on created_at */
        created_to?: components['parameters']['CreatedTo'];
        /** @description Ties break on id. A cursor is only valid with the same q, created_from, created_to and sort (422 otherwise). */
        sort?: components['parameters']['Sort'];
      };
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      /** @description Filtered and sorted (default created_desc) */
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': {
            items: components['schemas']['Field'][];
            next_cursor: string | null;
            /** @description Number of matching items across all pages */
            total: number;
            /** @description Sum of size_bytes of matching items */
            total_bytes: number;
          };
        };
      };
      422: components['responses']['ValidationError'];
    };
  };
  uploadField: {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody: {
      content: {
        'multipart/form-data': {
          /** Format: binary */
          file: Blob;
        };
      };
    };
    responses: {
      /** @description Stored */
      201: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Field'];
        };
      };
      422: components['responses']['ValidationError'];
    };
  };
  createDrawnField: {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody: {
      content: {
        'multipart/form-data': {
          nx: number;
          ny: number;
          /** @default drawn */
          name?: string;
          /**
           * Format: binary
           * @description Little-endian float32, row-major [ny, nx], j = 0 first; exactly 4·nx·ny bytes; all finite.
           */
          data: Blob;
        };
      };
    };
    responses: {
      /** @description Stored */
      201: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Field'];
        };
      };
      422: components['responses']['ValidationError'];
    };
  };
  getField: {
    parameters: {
      query?: never;
      header?: never;
      path: {
        fieldId: components['parameters']['FieldId'];
      };
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      /** @description OK */
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Field'];
        };
      };
      404: components['responses']['MessageError'];
    };
  };
  deleteField: {
    parameters: {
      query?: never;
      header?: never;
      path: {
        fieldId: components['parameters']['FieldId'];
      };
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      /** @description Deleted */
      204: {
        headers: {
          [name: string]: unknown;
        };
        content?: never;
      };
      404: components['responses']['MessageError'];
      /** @description A queued or running run depends on this field */
      409: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['MessageError'];
        };
      };
    };
  };
  renameField: {
    parameters: {
      query?: never;
      header?: never;
      path: {
        fieldId: components['parameters']['FieldId'];
      };
      cookie?: never;
    };
    requestBody: {
      content: {
        'application/json': components['schemas']['RenameRequest'];
      };
    };
    responses: {
      /** @description Renamed (the original filename is still used for downloads) */
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Field'];
        };
      };
      404: components['responses']['MessageError'];
      422: components['responses']['ValidationError'];
    };
  };
  downloadFieldOriginal: {
    parameters: {
      query?: never;
      header?: never;
      path: {
        fieldId: components['parameters']['FieldId'];
      };
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      /** @description File download */
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/x-netcdf': unknown;
        };
      };
      404: components['responses']['MessageError'];
    };
  };
  getFieldPreview: {
    parameters: {
      query?: {
        /** @description Variable name; defaults to Field.default_var. */
        var?: components['parameters']['Var'];
        /** @description Extra-dimension indices, e.g. index[time]=3&index[depth]=0; missing ones default to 0. */
        index?: components['parameters']['Index'];
        colormap?: components['parameters']['Colormap'];
        /** @description Must be given with vmax; finite and vmin < vmax */
        vmin?: components['parameters']['Vmin'];
        vmax?: components['parameters']['Vmax'];
        /** @description Downscale (area average) so the long side is at most this many pixels. Omit for native resolution (one pixel per cell). */
        max_side?: components['parameters']['MaxSide'];
      };
      header?: never;
      path: {
        fieldId: components['parameters']['FieldId'];
      };
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      /** @description Missing cells are transparent. Default range is the plane's finite min/max. */
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'image/png': unknown;
        };
      };
      404: components['responses']['MessageError'];
      409: components['responses']['MessageError'];
      413: components['responses']['PngMemoryLimit'];
      422: components['responses']['ValidationError'];
    };
  };
  getFieldPlaneStats: {
    parameters: {
      query?: {
        /** @description Variable name; defaults to Field.default_var. */
        var?: components['parameters']['Var'];
        /** @description Extra-dimension indices, e.g. index[time]=3&index[depth]=0; missing ones default to 0. */
        index?: components['parameters']['Index'];
      };
      header?: never;
      path: {
        fieldId: components['parameters']['FieldId'];
      };
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      /** @description OK */
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['PlaneStats'];
        };
      };
      404: components['responses']['MessageError'];
      409: components['responses']['MessageError'];
      422: components['responses']['ValidationError'];
    };
  };
  getFieldValues: {
    parameters: {
      query?: {
        /** @description Variable name; defaults to Field.default_var. */
        var?: components['parameters']['Var'];
        /** @description Extra-dimension indices, e.g. index[time]=3&index[depth]=0; missing ones default to 0. */
        index?: components['parameters']['Index'];
        i0?: components['parameters']['I0'];
        j0?: components['parameters']['J0'];
        /** @description Window width in cells (default to the edge) */
        w?: components['parameters']['W'];
        /** @description Window height in cells (default to the edge) */
        h?: components['parameters']['H'];
        /** @description Take every stride-th cell in both axes */
        stride?: components['parameters']['Stride'];
      };
      header?: never;
      path: {
        fieldId: components['parameters']['FieldId'];
      };
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      200: components['responses']['Float32Grid'];
      404: components['responses']['MessageError'];
      409: components['responses']['MessageError'];
      422: components['responses']['ValidationError'];
    };
  };
  listRuns: {
    parameters: {
      query?: {
        limit?: components['parameters']['Limit'];
        cursor?: components['parameters']['Cursor'];
        /** @description Case-insensitive substring match on name (and id prefix) */
        q?: components['parameters']['Q'];
        /** @description Inclusive lower bound on created_at */
        created_from?: components['parameters']['CreatedFrom'];
        /** @description Exclusive upper bound on created_at */
        created_to?: components['parameters']['CreatedTo'];
        /** @description Ties break on id. A cursor is only valid with the same q, created_from, created_to and sort (422 otherwise). */
        sort?: components['parameters']['Sort'];
      };
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      /** @description Filtered and sorted (default created_desc) */
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': {
            items: components['schemas']['Run'][];
            next_cursor: string | null;
            /** @description Number of matching items across all pages */
            total: number;
            /** @description Sum of size_bytes of matching items */
            total_bytes: number;
          };
        };
      };
      422: components['responses']['ValidationError'];
    };
  };
  createRun: {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody: {
      content: {
        'application/json': components['schemas']['RunRequest'];
      };
    };
    responses: {
      /** @description Accepted (queued, or running if the queue was empty) */
      202: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Run'];
        };
      };
      404: components['responses']['MessageError'];
      422: components['responses']['ValidationError'];
    };
  };
  validateRun: {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody: {
      content: {
        'application/json': components['schemas']['RunRequest'];
      };
    };
    responses: {
      /** @description Validation result for a well-formed body */
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['RunValidation'];
        };
      };
      422: components['responses']['ValidationError'];
    };
  };
  getRun: {
    parameters: {
      query?: never;
      header?: never;
      path: {
        runId: components['parameters']['RunId'];
      };
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      /** @description OK */
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Run'];
        };
      };
      404: components['responses']['MessageError'];
    };
  };
  deleteRun: {
    parameters: {
      query?: never;
      header?: never;
      path: {
        runId: components['parameters']['RunId'];
      };
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      /** @description Deleted */
      204: {
        headers: {
          [name: string]: unknown;
        };
        content?: never;
      };
      404: components['responses']['MessageError'];
    };
  };
  renameRun: {
    parameters: {
      query?: never;
      header?: never;
      path: {
        runId: components['parameters']['RunId'];
      };
      cookie?: never;
    };
    requestBody: {
      content: {
        'application/json': components['schemas']['RenameRequest'];
      };
    };
    responses: {
      /** @description Renamed */
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Run'];
        };
      };
      404: components['responses']['MessageError'];
      422: components['responses']['ValidationError'];
    };
  };
  rerun: {
    parameters: {
      query?: never;
      header?: never;
      path: {
        runId: components['parameters']['RunId'];
      };
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      /** @description New run accepted */
      202: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Run'];
        };
      };
      404: components['responses']['MessageError'];
      422: components['responses']['ValidationError'];
    };
  };
  getFramePng: {
    parameters: {
      query?: {
        /** @description Axis perpendicular to the view */
        axis?: components['parameters']['Axis'];
        /** @description Zero-based layer along axis, default floor(axis length / 2). Ignored for projections. */
        slice?: components['parameters']['Slice'];
        /** @description Reduce along the selected axis */
        projection?: components['parameters']['Projection'];
        colormap?: components['parameters']['Colormap'];
        /** @description Must be given with vmax; finite and vmin < vmax */
        vmin?: components['parameters']['Vmin'];
        vmax?: components['parameters']['Vmax'];
        /** @description Downscale (area average) so the long side is at most this many pixels. Omit for native resolution (one pixel per cell). */
        max_side?: components['parameters']['MaxSide'];
      };
      header?: never;
      path: {
        runId: components['parameters']['RunId'];
        n: components['parameters']['FrameIndex'];
      };
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      /** @description Default colour range is Run.display_range. Immutable (Cache-Control) once written. */
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'image/png': unknown;
        };
      };
      /** @description n ≥ expected_frames, unknown run, or outputs expired */
      404: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['MessageError'];
        };
      };
      /** @description Frame not written yet */
      409: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['MessageError'];
        };
      };
      413: components['responses']['PngMemoryLimit'];
      422: components['responses']['ValidationError'];
    };
  };
  getFrameValues: {
    parameters: {
      query?: {
        /** @description Axis perpendicular to the view */
        axis?: components['parameters']['Axis'];
        /** @description Zero-based layer along axis, default floor(axis length / 2). Ignored for projections. */
        slice?: components['parameters']['Slice'];
        /** @description Reduce along the selected axis */
        projection?: components['parameters']['Projection'];
        i0?: components['parameters']['I0'];
        j0?: components['parameters']['J0'];
        /** @description Window width in cells (default to the edge) */
        w?: components['parameters']['W'];
        /** @description Window height in cells (default to the edge) */
        h?: components['parameters']['H'];
        /** @description Take every stride-th cell in both axes */
        stride?: components['parameters']['Stride'];
      };
      header?: never;
      path: {
        runId: components['parameters']['RunId'];
        n: components['parameters']['FrameIndex'];
      };
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      200: components['responses']['Float32Grid'];
      404: components['responses']['MessageError'];
      409: components['responses']['MessageError'];
      422: components['responses']['ValidationError'];
    };
  };
  getFrameVolume: {
    parameters: {
      query?: {
        max_side?: number;
      };
      header?: never;
      path: {
        runId: components['parameters']['RunId'];
        n: components['parameters']['FrameIndex'];
      };
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      /** @description Little-endian float32 in row-major [z, y, x] order, x fastest. All axes start at zero and use stride ceil(max(nx, ny, nz) / max_side). The headers give the sampled dimensions. A single-layer run has X-Nz = 1. */
      200: {
        headers: {
          'X-Nx'?: number;
          'X-Ny'?: number;
          'X-Nz'?: number;
          [name: string]: unknown;
        };
        content: {
          'application/octet-stream': unknown;
        };
      };
      404: components['responses']['MessageError'];
      409: components['responses']['MessageError'];
      422: components['responses']['ValidationError'];
    };
  };
  exportRun: {
    parameters: {
      query?: {
        /** @description Axis perpendicular to the view */
        axis?: components['parameters']['Axis'];
        /** @description Zero-based layer along axis, default floor(axis length / 2). Ignored for projections. */
        slice?: components['parameters']['Slice'];
        /** @description Reduce along the selected axis */
        projection?: components['parameters']['Projection'];
        fps?: number;
        colormap?: components['parameters']['Colormap'];
        /** @description Must be given with vmax; finite and vmin < vmax */
        vmin?: components['parameters']['Vmin'];
        vmax?: components['parameters']['Vmax'];
        /** @description Downscale (area average) so the long side is at most this many pixels. Omit for native resolution (one pixel per cell). */
        max_side?: components['parameters']['MaxSide'];
      };
      header?: never;
      path: {
        runId: components['parameters']['RunId'];
        format: 'mp4' | 'gif';
      };
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      /** @description File download (Content-Disposition attachment) */
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'video/mp4': unknown;
          'image/gif': unknown;
        };
      };
      /** @description Being generated */
      202: {
        headers: {
          'Retry-After'?: number;
          [name: string]: unknown;
        };
        content: {
          'application/json': {
            progress: number;
          };
        };
      };
      404: components['responses']['MessageError'];
      409: components['responses']['MessageError'];
      422: components['responses']['ValidationError'];
    };
  };
  downloadResult: {
    parameters: {
      query?: never;
      header?: never;
      path: {
        runId: components['parameters']['RunId'];
      };
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      /** @description File download */
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/x-netcdf': unknown;
        };
      };
      404: components['responses']['MessageError'];
      409: components['responses']['MessageError'];
    };
  };
  listNowcasts: {
    parameters: {
      query?: {
        limit?: components['parameters']['Limit'];
        cursor?: components['parameters']['Cursor'];
      };
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      /** @description Most recent first */
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': {
            items: components['schemas']['Nowcast'][];
            next_cursor: string | null;
          };
        };
      };
      422: components['responses']['ValidationError'];
    };
  };
  createNowcast: {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody: {
      content: {
        'application/json': components['schemas']['NowcastParams'];
      };
    };
    responses: {
      202: components['responses']['NowcastRecord'];
      422: components['responses']['ValidationError'];
    };
  };
  getNowcast: {
    parameters: {
      query?: never;
      header?: never;
      path: {
        id: components['parameters']['NowcastId'];
      };
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      200: components['responses']['NowcastRecord'];
      404: components['responses']['MessageError'];
    };
  };
  deleteNowcast: {
    parameters: {
      query?: never;
      header?: never;
      path: {
        id: components['parameters']['NowcastId'];
      };
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      /** @description Deleted */
      204: {
        headers: {
          [name: string]: unknown;
        };
        content?: never;
      };
      404: components['responses']['MessageError'];
    };
  };
  refreshNowcast: {
    parameters: {
      query?: never;
      header?: never;
      path: {
        id: components['parameters']['NowcastId'];
      };
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      202: components['responses']['NowcastRecord'];
      404: components['responses']['MessageError'];
    };
  };
}
