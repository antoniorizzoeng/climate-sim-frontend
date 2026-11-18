// Generated from api/openapi.yaml by npm run api:generate.
export interface paths {
  '/health': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: operations['health'];
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
    patch?: never;
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
    patch?: never;
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
    /** Raw engine output (CDF-5, u(time, y, x)). Only when status is done. */
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
      extra_dims: components['schemas']['ExtraDim'][];
      units?: string | null;
      long_name?: string | null;
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
      /** @description Original filename or the drawn name */
      name: string;
      size_bytes?: number;
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
      /** @description Replaces missing cells. Required (422 otherwise) when the selected plane has missing cells. */
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
    };
    RunSource:
      components['schemas']['FieldSource'] | components['schemas']['PresetSource'];
    /** @description Each edge defaults to dirichlet. */
    BoundaryConfig: {
      left?: components['schemas']['BoundaryCondition'];
      right?: components['schemas']['BoundaryCondition'];
      bottom?: components['schemas']['BoundaryCondition'];
      top?: components['schemas']['BoundaryCondition'];
    };
    RunRequest: {
      source: components['schemas']['RunSource'];
      /** @default 1 */
      dx?: number;
      /** @default 1 */
      dy?: number;
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
      /** @description MPI ranks. Omitted → default_processes, automatically reduced so the MPI_Dims_create grid fits nx and ny. An explicit value that does not fit, or exceeds cpu_count, is rejected. */
      processes?: number;
    };
    ResolvedRun: {
      nx: number;
      ny: number;
      dt: number;
      steps: number;
      out_every: number;
      expected_frames: number;
      processes: number;
      dt_max: number | null;
      /** @description ≈ 8·nx·ny·expected_frames + header */
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
      /** @description Fixed default colour range for the whole run, from frame 0 (widened to include 0 when any edge is dirichlet). Advection–diffusion with these schemes cannot leave this range, so colours never shift during playback. A constant field renders as the colormap midpoint. */
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
      /** @default 6 */
      hours?: number;
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
    };
    CloudFraction: number;
    SkyCover: {
      low: components['schemas']['CloudFraction'];
      mid: components['schemas']['CloudFraction'];
      high: components['schemas']['CloudFraction'];
      total: components['schemas']['CloudFraction'];
      /** @description One minus total cloud fraction. */
      clear: components['schemas']['CloudFraction'];
    };
    Nowcast: {
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
            /** @description Open-Meteo site layers and its own total, linearly interpolated between UTC hours. */
            model: components['schemas']['SkyCover'];
            /** @description Exponentially weighted transport and model values for each layer and for total. Clear is one minus blended total. */
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
      /** @description Longest stretch of consecutive ten-minute samples with blended clear fraction at least 0.70 and good or fair seeing. Ties go to the earliest stretch. Null until done or when no sample qualifies. */
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
          };
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
            items: components['schemas']['Field'][];
            next_cursor: string | null;
          };
        };
      };
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
            items: components['schemas']['Run'][];
            next_cursor: string | null;
          };
        };
      };
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
      422: components['responses']['ValidationError'];
    };
  };
  getFrameValues: {
    parameters: {
      query?: {
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
  exportRun: {
    parameters: {
      query?: {
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
