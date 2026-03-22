declare module "potrace" {
  interface PotraceOptions {
    threshold?: number;
    turnPolicy?: "black" | "white" | "left" | "right" | "minority" | "majority";
    turdSize?: number;
    optCurve?: boolean;
    optTolerance?: number;
    alphaMax?: number;
    color?: string;
    background?: string;
    blackOnWhite?: boolean;
  }

  type TraceCallback = (err: Error | null, svg: string, instance?: unknown) => void;

  interface PotraceClass {
    THRESHOLD_AUTO: number;
    COLOR_AUTO: string;
    COLOR_TRANSPARENT: string;
    TURNPOLICY_BLACK: string;
    TURNPOLICY_WHITE: string;
    TURNPOLICY_LEFT: string;
    TURNPOLICY_RIGHT: string;
    TURNPOLICY_MINORITY: string;
    TURNPOLICY_MAJORITY: string;
  }

  function trace(
    file: string | Buffer,
    options: PotraceOptions,
    callback: TraceCallback
  ): void;
  function trace(
    file: string | Buffer,
    callback: TraceCallback
  ): void;

  function posterize(
    file: string | Buffer,
    options: PotraceOptions,
    callback: TraceCallback
  ): void;
  function posterize(
    file: string | Buffer,
    callback: TraceCallback
  ): void;

  const Potrace: PotraceClass;

  export { trace, posterize, Potrace, PotraceOptions, TraceCallback };
}
