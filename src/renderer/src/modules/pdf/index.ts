import type { WhitebloomModule } from '../types'
import { lazy } from 'react'

import { PdfIcon } from './PdfIcon'
import { PdfNodeComponent } from './PdfNodeComponent'

// Loaded on first open so its code (and heavy deps) stay out of the startup bundle.
const PdfEditor = lazy(() => import('./PdfEditor').then((m) => ({ default: m.PdfEditor })))

export const pdfModule: WhitebloomModule = {
  id: 'com.whitebloom.pdf',
  majorModeLabel: 'PDF',
  extensions: ['.pdf'],
  defaultRenderer: 'internal',
  defaultSize: { w: 180, h: 120 },
  editorDataSource: 'resource',
  IconComponent: PdfIcon,
  accentColor: '--color-accent-red',
  NodeComponent: PdfNodeComponent,
  EditorComponent: PdfEditor
}
