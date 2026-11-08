import type { WhitebloomModule } from '../types'
import { lazy } from 'react'

import { MarkdownBloomIcon } from './MarkdownBloomIcon'
import { MarkdownBloomNode } from './MarkdownBloomNode'

function isMarkdownResource(resource: string): boolean {
  const normalized = resource.toLowerCase()
  return normalized.endsWith('.md') || normalized.endsWith('.markdown')
}

// Loaded on first open so its code (and heavy deps) stay out of the startup bundle.
const MarkdownBloomEditor = lazy(() => import('./MarkdownBloomEditor').then((m) => ({ default: m.MarkdownBloomEditor })))

export const markdownBloomModule: WhitebloomModule = {
  id: 'com.whitebloom.markdownbloom',
  majorModeLabel: 'Markdown',
  extensions: ['.md', '.markdown'],
  defaultRenderer: 'internal',
  defaultSize: { w: 248, h: 184 },

  recognizes(resource: string): boolean {
    return isMarkdownResource(resource)
  },

  createDefault(): string {
    return '# Untitled\n\n'
  },

  IconComponent: MarkdownBloomIcon,
  accentColor: '--color-accent-blue',
  NodeComponent: MarkdownBloomNode,
  EditorComponent: MarkdownBloomEditor
}
