import { useBoardStore } from '../stores/board'
import { useHistoryStore } from './store'
import type { BoardEdge, BoardNode } from '../shared/types'

/**
 * Snapshot-based undo/redo for the board document (nodes + edges).
 *
 * Every change to the board store is recorded automatically, so *every* edit is
 * undoable (create, move, resize, text, styles, delete, edges, clusters…), not
 * only the few commands that implemented their own undo. Rapid changes (a drag,
 * a resize) are coalesced into one step once the board has been still for a
 * moment. Entries go into the shared history stack, so they interleave correctly
 * with ink undo entries.
 */

type BoardDoc = { nodes: BoardNode[]; edges: BoardEdge[] }

const SETTLE_MS = 350

let installed = false
let base: BoardDoc | null = null
let pendingBefore: BoardDoc | null = null
let settleTimer: ReturnType<typeof setTimeout> | null = null
let applying = false

function currentDoc(): BoardDoc {
  const s = useBoardStore.getState()
  return { nodes: s.nodes, edges: s.edges }
}

/**
 * Comparable form of a document, ignoring bookkeeping and auto-measured sizes
 * (auto-width text re-measures itself on render; that is not a user edit).
 */
const IGNORED_KEYS = new Set(['updatedAt', 'updatedBy', 'created', 'createdBy'])

function signature(doc: BoardDoc): string {
  const nodes = doc.nodes.map((node) => {
    const candidate = node as BoardNode & { type?: string; widthMode?: string }
    const isAutoText = candidate.type === 'text' && (candidate.widthMode ?? 'auto') === 'auto'
    return isAutoText ? { ...node, size: undefined } : node
  })
  return JSON.stringify({ nodes, edges: doc.edges }, (key, value) =>
    IGNORED_KEYS.has(key) ? undefined : value
  )
}

function clearTimer(): void {
  if (settleTimer) clearTimeout(settleTimer)
  settleTimer = null
}

function commit(): void {
  clearTimer()
  if (!pendingBefore) return
  const before = pendingBefore
  const after = currentDoc()
  pendingBefore = null
  base = after
  if (signature(before) === signature(after)) return

  useHistoryStore.getState().push({
    id: `board-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    modeKey: 'canvas-mode',
    envelopes: [],
    undoFn: () => restore(before),
    redoFn: () => restore(after)
  })
}

function restore(doc: BoardDoc): void {
  clearTimer()
  pendingBefore = null
  applying = true
  try {
    const state = useBoardStore.getState()
    useBoardStore.setState({
      nodes: doc.nodes,
      edges: doc.edges,
      isDirty: state.transient !== true
    })
  } finally {
    applying = false
  }
  // Layout echoes after a restore (text re-measuring itself, etc.) don't change the
  // signature, so commit() drops them without touching the redo stack.
  base = doc
}

/** Commit any in-progress gesture now (call before undo/redo or pushing other entries). */
export function flushBoardHistory(): void {
  if (pendingBefore) commit()
}

/** Forget the current baseline (new board opened / history cleared). */
export function resetBoardHistory(): void {
  clearTimer()
  pendingBefore = null
  base = currentDoc()
}

export function installBoardHistory(): void {
  if (installed) return
  installed = true
  base = currentDoc()

  useBoardStore.subscribe((state, prev) => {
    if (state.path !== prev.path) {
      resetBoardHistory()
      return
    }
    if (applying) return
    if (state.nodes === prev.nodes && state.edges === prev.edges) return

    if (!pendingBefore) pendingBefore = base ?? { nodes: prev.nodes, edges: prev.edges }
    clearTimer()
    settleTimer = setTimeout(commit, SETTLE_MS)
  })
}
