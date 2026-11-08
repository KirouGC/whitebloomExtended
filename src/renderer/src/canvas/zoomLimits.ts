/**
 * Board zoom range, shared by every tool (pointer, hand, ink) so switching tools
 * never clamps the current zoom. React Flow's defaults (0.5–2) were much tighter
 * than the ink overlay's own wheel zoom.
 */
export const BOARD_MIN_ZOOM = 0.02
export const BOARD_MAX_ZOOM = 16
