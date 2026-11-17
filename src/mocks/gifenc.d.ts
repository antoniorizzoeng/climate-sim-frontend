declare module 'gifenc' {
  export function GIFEncoder(): {
    writeFrame(
      indices: Uint8Array,
      width: number,
      height: number,
      options: { palette?: number[][]; delay: number },
    ): void;
    finish(): void;
    bytes(): Uint8Array<ArrayBuffer>;
  };
}
