import type { StrokeOptions } from 'perfect-freehand'

/**
 * perfect-freehand options shared by every ink renderer (board, PDF, export).
 *
 * Pressure-sensitive strokes taper with pen pressure (or simulated pressure from
 * mouse speed). With pressure off the stroke keeps a constant width.
 */
/** Streamline for strokes drawn from now on: the tip stays under the pen. */
export const LIVE_STREAMLINE = 0.2
/** What strokes saved before per-stroke streamline existed were drawn with. */
export const LEGACY_STREAMLINE = 0.44

export function strokeOutlineOptions(
  size: number,
  pressure = true,
  streamline: number = LEGACY_STREAMLINE
): StrokeOptions {
  return pressure
    ? { size, thinning: 0.62, smoothing: 0.58, streamline, simulatePressure: true, last: true }
    : { size, thinning: 0, smoothing: 0.58, streamline, simulatePressure: false, last: true }
}

export function strokeStreamline(dynamics: { streamline?: number } | undefined): number {
  return typeof dynamics?.streamline === 'number' ? dynamics.streamline : LEGACY_STREAMLINE
}

/** Strokes saved before the option existed have no flag: they were pressure-sensitive. */
export function strokeUsesPressure(dynamics: { pressure?: boolean } | undefined): boolean {
  return dynamics?.pressure !== false
}
