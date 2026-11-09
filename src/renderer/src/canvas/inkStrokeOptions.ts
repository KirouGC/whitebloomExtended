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

/** Direct ("raw") strokes skip perfect-freehand entirely. */
export function strokeIsRaw(dynamics: { raw?: boolean } | undefined): boolean {
  return dynamics?.raw === true
}

/** Polyline through the pen points, exactly as drawn (a single point becomes a dot). */
export function rawStrokePath(points: Array<[number, number]>): Path2D {
  const path = new Path2D()
  if (points.length === 0) return path
  path.moveTo(points[0][0], points[0][1])
  if (points.length === 1) path.lineTo(points[0][0] + 0.001, points[0][1])
  for (let i = 1; i < points.length; i += 1) path.lineTo(points[i][0], points[i][1])
  return path
}

/** Stroke a raw path with round caps/joins at a constant width (current transform units). */
export function strokeRawPath(
  context: CanvasRenderingContext2D,
  path: Path2D,
  width: number,
  color: string,
  opacity: number
): void {
  context.save()
  context.globalAlpha = opacity
  context.strokeStyle = color
  context.lineWidth = width
  context.lineCap = 'round'
  context.lineJoin = 'round'
  context.stroke(path)
  context.restore()
}

/** Strokes saved before the option existed have no flag: they were pressure-sensitive. */
export function strokeUsesPressure(dynamics: { pressure?: boolean } | undefined): boolean {
  return dynamics?.pressure !== false
}
