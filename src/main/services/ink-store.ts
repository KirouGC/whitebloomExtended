import { createHash } from 'crypto'
import { constants } from 'fs'
import { access, mkdir, readFile, stat, writeFile } from 'fs/promises'
import { dirname, join } from 'path'
import {
  createEmptyInkAcetate,
  createEmptyInkWorkspaceIndex,
  createInkTargetId,
  CURRENT_INK_VERSION,
  INK_ACETATE_DIRECTORY,
  INK_ACETATE_FILE_EXTENSION,
  INK_WORKSPACE_INDEX_FILENAME,
  type InkAcetate,
  type InkSurfaceBinding,
  type InkStroke,
  type InkTargetIndexEntry,
  type InkWorkspaceIndex
} from '../../shared/ink'

// Queues are used only for write serialization; the resolved value is never
// consumed from the map, so Promise<unknown> avoids awkward casts across
// operations with different return types.
const writeQueues = new Map<string, Promise<unknown>>()

async function pathExists(targetPath: string): Promise<boolean> {
  try {
    await access(targetPath, constants.F_OK)
    return true
  } catch {
    return false
  }
}

function getInkIndexPath(workspaceRoot: string): string {
  return join(workspaceRoot, INK_WORKSPACE_INDEX_FILENAME)
}

function buildQueueKey(workspaceRoot: string, targetId: string): string {
  return `${workspaceRoot}::${targetId}`
}

function buildAcetateRelativePath(targetId: string): string {
  const hash = createHash('sha1').update(targetId).digest('hex')
  return `${INK_ACETATE_DIRECTORY}/${hash}${INK_ACETATE_FILE_EXTENSION}`
}

function resolveAcetatePath(workspaceRoot: string, relativePath: string): string {
  return join(workspaceRoot, relativePath.replace(/\//g, '\\'))
}

function normalizeInkWorkspaceIndex(value: unknown): InkWorkspaceIndex {
  if (!value || typeof value !== 'object') {
    return createEmptyInkWorkspaceIndex()
  }

  const candidate = value as Partial<InkWorkspaceIndex>
  return {
    version: CURRENT_INK_VERSION,
    acetates: Array.isArray(candidate.acetates)
      ? candidate.acetates.filter((entry) => entry && typeof entry.id === 'string')
      : [],
    targets: Array.isArray(candidate.targets)
      ? candidate.targets.filter((entry) => entry && typeof entry.id === 'string')
      : []
  }
}

function normalizeInkAcetate(value: unknown): InkAcetate | null {
  if (!value || typeof value !== 'object') return null

  const candidate = value as Partial<InkAcetate>
  if (!candidate.id || !candidate.target || !Array.isArray(candidate.strokes)) {
    return null
  }

  const nowIso = new Date().toISOString()
  return {
    version: CURRENT_INK_VERSION,
    id: candidate.id,
    name: typeof candidate.name === 'string' && candidate.name.trim() ? candidate.name.trim() : undefined,
    target: candidate.target,
    strokes: candidate.strokes as InkStroke[],
    createdAt: typeof candidate.createdAt === 'string' ? candidate.createdAt : nowIso,
    updatedAt: typeof candidate.updatedAt === 'string' ? candidate.updatedAt : nowIso
  }
}

async function readInkIndex(workspaceRoot: string): Promise<InkWorkspaceIndex> {
  const indexPath = getInkIndexPath(workspaceRoot)
  if (!(await pathExists(indexPath))) {
    return createEmptyInkWorkspaceIndex()
  }

  return normalizeInkWorkspaceIndex(JSON.parse(await readFile(indexPath, 'utf-8')))
}

async function writeInkIndex(workspaceRoot: string, index: InkWorkspaceIndex): Promise<void> {
  await writeFile(getInkIndexPath(workspaceRoot), JSON.stringify(index, null, 2), 'utf-8')
}

// ── Acetate file cache + coalesced writes ─────────────────────────────────────
// Ink layers can be several MB. Re-reading and re-writing the whole file on every
// stroke was slow (and churned cloud-synced folders), so layers stay in memory and
// disk writes are coalesced: while one write runs, newer states just replace the
// pending one and only the latest is written next.

type CachedAcetate = { acetate: InkAcetate; mtimeMs: number | null }
const acetateCache = new Map<string, CachedAcetate>()
const acetateWriters = new Map<string, { writing: Promise<void> | null; pending: boolean }>()

async function fileMtime(filePath: string): Promise<number | null> {
  try {
    return (await stat(filePath)).mtimeMs
  } catch {
    return null
  }
}

async function readAcetateAtPath(acetatePath: string): Promise<InkAcetate | null> {
  const cached = acetateCache.get(acetatePath)
  const writer = acetateWriters.get(acetatePath)
  // While our own write is pending, memory is the source of truth.
  if (cached && (writer?.writing || writer?.pending)) return cached.acetate
  const mtimeMs = await fileMtime(acetatePath)
  if (mtimeMs === null) return cached?.acetate ?? null
  // Reuse the cached layer unless the file changed on disk (e.g. synced from elsewhere).
  if (cached && cached.mtimeMs === mtimeMs) return cached.acetate
  const acetate = normalizeInkAcetate(JSON.parse(await readFile(acetatePath, 'utf-8')))
  if (acetate) acetateCache.set(acetatePath, { acetate, mtimeMs })
  return acetate
}

async function writeAcetateAtPath(acetatePath: string, acetate: InkAcetate): Promise<void> {
  const previous = acetateCache.get(acetatePath)
  acetateCache.set(acetatePath, { acetate, mtimeMs: previous?.mtimeMs ?? null })
  scheduleAcetateWrite(acetatePath)
}

function scheduleAcetateWrite(acetatePath: string): void {
  let writer = acetateWriters.get(acetatePath)
  if (!writer) {
    writer = { writing: null, pending: false }
    acetateWriters.set(acetatePath, writer)
  }
  writer.pending = true
  if (writer.writing) return
  const state = writer
  state.writing = (async () => {
    while (state.pending) {
      state.pending = false
      const cached = acetateCache.get(acetatePath)
      if (!cached) break
      try {
        await mkdir(dirname(acetatePath), { recursive: true })
        // Compact JSON: about half the size of the old pretty-printed format.
        await writeFile(acetatePath, JSON.stringify(cached.acetate), 'utf-8')
        const latest = acetateCache.get(acetatePath)
        if (latest) latest.mtimeMs = await fileMtime(acetatePath)
      } catch (error) {
        console.error('[ink] failed to write acetate', acetatePath, error)
      }
    }
    state.writing = null
  })()
}

/** Wait for every pending ink write (call before the app quits). */
export async function flushInkWrites(): Promise<void> {
  const pendingWrites = [...acetateWriters.values()].map((writer) => writer.writing).filter(Boolean)
  await Promise.all(pendingWrites)
  if ([...acetateWriters.values()].some((writer) => writer.writing || writer.pending)) {
    await flushInkWrites()
  }
}

export function hasPendingInkWrites(): boolean {
  return [...acetateWriters.values()].some((writer) => writer.writing !== null || writer.pending)
}

function ensureTargetEntry(
  index: InkWorkspaceIndex,
  binding: InkSurfaceBinding,
  acetateId: string
): InkTargetIndexEntry {
  const targetId = createInkTargetId(binding.surfaceType, binding.resource)
  const existing = index.targets.find((entry) => entry.id === targetId)
  if (existing) {
    existing.resource = binding.resource
    existing.surfaceType = binding.surfaceType
    existing.acetateIds = existing.acetateIds.includes(acetateId)
      ? existing.acetateIds
      : [acetateId, ...existing.acetateIds]
    return existing
  }

  const next: InkTargetIndexEntry = {
    id: targetId,
    surfaceType: binding.surfaceType,
    resource: binding.resource,
    acetateIds: [acetateId]
  }
  index.targets.push(next)
  return next
}

async function clearInkLayerImmediate(
  workspaceRoot: string,
  binding: InkSurfaceBinding
): Promise<InkStroke[]> {
  const targetId = createInkTargetId(binding.surfaceType, binding.resource)
  const index = await readInkIndex(workspaceRoot)
  const targetEntry = index.targets.find((entry) => entry.id === targetId)
  const acetateId = targetEntry?.acetateIds[0]
  if (!acetateId) return []

  const acetateEntry = index.acetates.find((entry) => entry.id === acetateId)
  if (!acetateEntry) return []

  const acetatePath = resolveAcetatePath(workspaceRoot, acetateEntry.relativePath)
  const current = await readAcetateAtPath(acetatePath)
  if (!current || current.strokes.length === 0) return []

  const clearedStrokes = current.strokes
  const nowIso = new Date().toISOString()
  const nextAcetate: InkAcetate = { ...current, strokes: [], updatedAt: nowIso }
  await writeAcetateAtPath(acetatePath, nextAcetate)
  acetateEntry.updatedAt = nowIso
  await writeInkIndex(workspaceRoot, index)
  return clearedStrokes
}

export async function clearInkLayer(
  workspaceRoot: string,
  binding: InkSurfaceBinding
): Promise<InkStroke[]> {
  const queueKey = buildQueueKey(workspaceRoot, createInkTargetId(binding.surfaceType, binding.resource))
  const previous = writeQueues.get(queueKey) ?? Promise.resolve(null)
  const next = previous
    .catch(() => null)
    .then(async () => await clearInkLayerImmediate(workspaceRoot, binding))

  writeQueues.set(queueKey, next)

  try {
    return await next
  } finally {
    if (writeQueues.get(queueKey) === next) writeQueues.delete(queueKey)
  }
}

async function setInkStrokesImmediate(
  workspaceRoot: string,
  binding: InkSurfaceBinding,
  strokes: InkStroke[]
): Promise<InkAcetate> {
  await mkdir(join(workspaceRoot, INK_ACETATE_DIRECTORY), { recursive: true })

  const targetId = createInkTargetId(binding.surfaceType, binding.resource)
  const index = await readInkIndex(workspaceRoot)
  const existingTarget = index.targets.find((entry) => entry.id === targetId)
  const acetateId = existingTarget?.acetateIds[0] ?? createHash('sha1').update(targetId).digest('hex')
  const relativePath =
    index.acetates.find((entry) => entry.id === acetateId)?.relativePath ??
    buildAcetateRelativePath(targetId)
  const acetatePath = resolveAcetatePath(workspaceRoot, relativePath)
  const nowIso = new Date().toISOString()

  const current =
    (await readAcetateAtPath(acetatePath)) ??
    createEmptyInkAcetate(acetateId, { ...binding, targetId }, nowIso)

  const nextAcetate: InkAcetate = { ...current, target: { ...binding, targetId }, strokes, updatedAt: nowIso }
  await writeAcetateAtPath(acetatePath, nextAcetate)

  const acetateEntry = index.acetates.find((entry) => entry.id === acetateId)
  if (acetateEntry) {
    acetateEntry.updatedAt = nowIso
  } else {
    index.acetates.push({
      id: acetateId,
      name: nextAcetate.name,
      targetId,
      surfaceType: binding.surfaceType,
      coordinateSpace: binding.coordinateSpace,
      relativePath,
      createdAt: nextAcetate.createdAt,
      updatedAt: nowIso
    })
  }

  ensureTargetEntry(index, binding, acetateId)
  await writeInkIndex(workspaceRoot, index)
  return nextAcetate
}

export async function setInkStrokes(
  workspaceRoot: string,
  binding: InkSurfaceBinding,
  strokes: InkStroke[]
): Promise<InkAcetate> {
  const queueKey = buildQueueKey(workspaceRoot, createInkTargetId(binding.surfaceType, binding.resource))
  const previous = writeQueues.get(queueKey) ?? Promise.resolve(null)
  const next = previous
    .catch(() => null)
    .then(async () => await setInkStrokesImmediate(workspaceRoot, binding, strokes))

  writeQueues.set(queueKey, next)

  try {
    return await next
  } finally {
    if (writeQueues.get(queueKey) === next) writeQueues.delete(queueKey)
  }
}

async function deleteInkStrokeImmediate(
  workspaceRoot: string,
  binding: InkSurfaceBinding,
  strokeId: string
): Promise<InkAcetate | null> {
  const targetId = createInkTargetId(binding.surfaceType, binding.resource)
  const index = await readInkIndex(workspaceRoot)
  const targetEntry = index.targets.find((entry) => entry.id === targetId)
  const acetateId = targetEntry?.acetateIds[0]
  if (!acetateId) return null

  const acetateEntry = index.acetates.find((entry) => entry.id === acetateId)
  if (!acetateEntry) return null

  const acetatePath = resolveAcetatePath(workspaceRoot, acetateEntry.relativePath)
  const current = await readAcetateAtPath(acetatePath)
  if (!current) return null

  const nowIso = new Date().toISOString()
  const nextAcetate: InkAcetate = {
    ...current,
    strokes: current.strokes.filter((s) => s.id !== strokeId),
    updatedAt: nowIso
  }

  await writeAcetateAtPath(acetatePath, nextAcetate)
  acetateEntry.updatedAt = nowIso
  await writeInkIndex(workspaceRoot, index)
  return nextAcetate
}

export async function deleteInkStroke(
  workspaceRoot: string,
  binding: InkSurfaceBinding,
  strokeId: string
): Promise<InkAcetate | null> {
  const queueKey = buildQueueKey(workspaceRoot, createInkTargetId(binding.surfaceType, binding.resource))
  const previous = writeQueues.get(queueKey) ?? Promise.resolve(null)
  const next = previous
    .catch(() => null)
    .then(async () => await deleteInkStrokeImmediate(workspaceRoot, binding, strokeId))

  writeQueues.set(queueKey, next)

  try {
    return await next
  } finally {
    if (writeQueues.get(queueKey) === next) writeQueues.delete(queueKey)
  }
}

export async function loadInkAcetate(
  workspaceRoot: string,
  binding: InkSurfaceBinding
): Promise<InkAcetate | null> {
  const targetId = createInkTargetId(binding.surfaceType, binding.resource)
  const index = await readInkIndex(workspaceRoot)
  const targetEntry = index.targets.find((entry) => entry.id === targetId)
  const acetateId = targetEntry?.acetateIds[0]
  if (!acetateId) return null

  const acetateEntry = index.acetates.find((entry) => entry.id === acetateId)
  if (!acetateEntry) return null

  return await readAcetateAtPath(resolveAcetatePath(workspaceRoot, acetateEntry.relativePath))
}

async function appendInkStrokeImmediate(
  workspaceRoot: string,
  binding: InkSurfaceBinding,
  stroke: InkStroke
): Promise<InkAcetate> {
  await mkdir(join(workspaceRoot, INK_ACETATE_DIRECTORY), { recursive: true })

  const targetId = createInkTargetId(binding.surfaceType, binding.resource)
  const index = await readInkIndex(workspaceRoot)
  const existingTarget = index.targets.find((entry) => entry.id === targetId)
  const acetateId = existingTarget?.acetateIds[0] ?? createHash('sha1').update(targetId).digest('hex')
  const relativePath =
    index.acetates.find((entry) => entry.id === acetateId)?.relativePath ??
    buildAcetateRelativePath(targetId)
  const acetatePath = resolveAcetatePath(workspaceRoot, relativePath)
  const nowIso = new Date().toISOString()

  const current =
    (await readAcetateAtPath(acetatePath)) ??
    createEmptyInkAcetate(
      acetateId,
      {
        ...binding,
        targetId
      },
      nowIso
    )

  const nextAcetate: InkAcetate = {
    ...current,
    target: {
      ...binding,
      targetId
    },
    strokes: [...current.strokes, stroke],
    updatedAt: nowIso
  }

  await writeAcetateAtPath(acetatePath, nextAcetate)

  const acetateEntry = index.acetates.find((entry) => entry.id === acetateId)
  if (acetateEntry) {
    acetateEntry.targetId = targetId
    acetateEntry.surfaceType = binding.surfaceType
    acetateEntry.coordinateSpace = binding.coordinateSpace
    acetateEntry.relativePath = relativePath
    acetateEntry.updatedAt = nowIso
    acetateEntry.name = nextAcetate.name
  } else {
    index.acetates.push({
      id: acetateId,
      name: nextAcetate.name,
      targetId,
      surfaceType: binding.surfaceType,
      coordinateSpace: binding.coordinateSpace,
      relativePath,
      createdAt: nextAcetate.createdAt,
      updatedAt: nowIso
    })
  }

  ensureTargetEntry(index, binding, acetateId)
  await writeInkIndex(workspaceRoot, index)
  return nextAcetate
}

export async function appendInkStroke(
  workspaceRoot: string,
  binding: InkSurfaceBinding,
  stroke: InkStroke
): Promise<InkAcetate> {
  const queueKey = buildQueueKey(
    workspaceRoot,
    createInkTargetId(binding.surfaceType, binding.resource)
  )
  const previous = writeQueues.get(queueKey) ?? Promise.resolve(null as unknown as InkAcetate)
  const next = previous
    .catch(() => null as unknown as InkAcetate)
    .then(async () => await appendInkStrokeImmediate(workspaceRoot, binding, stroke))

  writeQueues.set(queueKey, next)

  try {
    return await next
  } finally {
    if (writeQueues.get(queueKey) === next) {
      writeQueues.delete(queueKey)
    }
  }
}

// ── Delta updates (only the strokes that changed cross IPC) ──────────────────

export type InkDelta = {
  /** Strokes to add, or to replace when a stroke with the same id exists. */
  add: InkStroke[]
  /** Stroke ids to remove. */
  removeIds: string[]
}

async function applyInkDeltaImmediate(
  workspaceRoot: string,
  binding: InkSurfaceBinding,
  delta: InkDelta
): Promise<void> {
  const targetId = createInkTargetId(binding.surfaceType, binding.resource)
  const index = await readInkIndex(workspaceRoot)
  const existingTarget = index.targets.find((entry) => entry.id === targetId)
  const acetateId = existingTarget?.acetateIds[0] ?? createHash('sha1').update(targetId).digest('hex')
  const relativePath =
    index.acetates.find((entry) => entry.id === acetateId)?.relativePath ??
    buildAcetateRelativePath(targetId)
  const acetatePath = resolveAcetatePath(workspaceRoot, relativePath)
  const nowIso = new Date().toISOString()

  const current =
    (await readAcetateAtPath(acetatePath)) ??
    createEmptyInkAcetate(acetateId, { ...binding, targetId }, nowIso)

  const drop = new Set(delta.removeIds)
  for (const stroke of delta.add) drop.add(stroke.id)
  const strokes = current.strokes.filter((stroke) => !drop.has(stroke.id))
  strokes.push(...delta.add)
  strokes.sort((a, b) => a.createdAt.localeCompare(b.createdAt))

  const nextAcetate: InkAcetate = { ...current, target: { ...binding, targetId }, strokes, updatedAt: nowIso }
  await writeAcetateAtPath(acetatePath, nextAcetate)

  const acetateEntry = index.acetates.find((entry) => entry.id === acetateId)
  const isNewTarget = !existingTarget || !acetateEntry
  if (acetateEntry) {
    acetateEntry.updatedAt = nowIso
  } else {
    index.acetates.push({
      id: acetateId,
      name: nextAcetate.name,
      targetId,
      surfaceType: binding.surfaceType,
      coordinateSpace: binding.coordinateSpace,
      relativePath,
      createdAt: nextAcetate.createdAt,
      updatedAt: nowIso
    })
  }
  ensureTargetEntry(index, binding, acetateId)
  // The index only needs rewriting when the layer is new (timestamps are cosmetic).
  if (isNewTarget) await writeInkIndex(workspaceRoot, index)
}

export async function applyInkDelta(
  workspaceRoot: string,
  binding: InkSurfaceBinding,
  delta: InkDelta
): Promise<void> {
  const queueKey = buildQueueKey(workspaceRoot, createInkTargetId(binding.surfaceType, binding.resource))
  const previous = writeQueues.get(queueKey) ?? Promise.resolve(null)
  const next = previous.catch(() => null).then(async () => await applyInkDeltaImmediate(workspaceRoot, binding, delta))
  writeQueues.set(queueKey, next)
  try {
    await next
  } finally {
    if (writeQueues.get(queueKey) === next) writeQueues.delete(queueKey)
  }
}
