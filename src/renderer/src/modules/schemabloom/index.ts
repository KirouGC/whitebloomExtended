import type { WhitebloomModule } from '../types'
import { BUD_ICON_NODE_W } from '@renderer/canvas/canvas-constants'
import { lazy } from 'react'

import { SchemaBloomNode } from './SchemaBloomNode'
import { SchemaBloomIcon } from './SchemaBloomIcon'
import { saveSchema, createEmptySchema } from './schema'

// Loaded on first open so its code (and heavy deps) stay out of the startup bundle.
const SchemaBloomEditor = lazy(() => import('./SchemaBloomEditor').then((m) => ({ default: m.SchemaBloomEditor })))

export const schemaBloomModule: WhitebloomModule = {
  id: 'com.whitebloom.schemabloom',
  extensions: ['.bdb'],
  defaultRenderer: 'internal',
  defaultSize: { w: BUD_ICON_NODE_W, h: BUD_ICON_NODE_W },

  recognizes(resource: string): boolean {
    return resource.endsWith('.bdb')
  },

  createDefault(): string {
    return saveSchema(createEmptySchema())
  },

  IconComponent: SchemaBloomIcon,
  accentColor: '--color-accent-blue',
  NodeComponent: SchemaBloomNode,
  EditorComponent: SchemaBloomEditor
}
