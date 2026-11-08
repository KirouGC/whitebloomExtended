import type { WhitebloomModule } from '../types'
import { FocusWriterNode } from './FocusWriterNode'
import { lazy } from 'react'

import { FocusWriterIcon } from './FocusWriterIcon'

// Loaded on first open so its code (and heavy deps) stay out of the startup bundle.
const FocusWriterEditor = lazy(() => import('./FocusWriterEditor').then((m) => ({ default: m.FocusWriterEditor })))

export const focusWriterModule: WhitebloomModule = {
  id: 'com.whitebloom.focus-writer',
  majorModeLabel: 'Focus Writer',
  extensions: ['.blt'],
  defaultRenderer: 'internal',

  recognizes(resource: string): boolean {
    return resource.endsWith('.blt')
  },

  createDefault(): string {
    return ''
  },

  IconComponent: FocusWriterIcon,
  accentColor: '--color-accent-pink',
  NodeComponent: FocusWriterNode,
  EditorComponent: FocusWriterEditor
}
