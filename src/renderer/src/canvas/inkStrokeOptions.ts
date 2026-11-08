import type { StrokeOptions } from 'perfect-freehand'

/**
 * perfect-freehand options shared by every ink renderer (board, PDF, export).
 *
 * Pressure-sensitive strokes taper with pen pressure (or simulated pressure from
 * mouse speed). With pressure off the stroke keeps a constant width.
 */
export function strokeOutlineOptions(size: number, pressure = true): StrokeOptions {
  return pressure
    ? { size, thinning: 0.62, smoothing: 0.58, streamline: 0.44, simulatePressure: true, last: true }
    : { size, thinning: 0, smoothing: 0.58, streamline: 0.44, simulatePressure: false, last: true }
}

/** Strokes saved before the option existed have no flag: they were pressure-sensitive. */
export function strokeUsesPressure(dynamics: { pressure?: boolean } | undefined): boolean {
  return dynamics?.pressure !== false
}
