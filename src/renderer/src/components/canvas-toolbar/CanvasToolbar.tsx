import { Hand, Layers3, MousePointer2, Pen, Shapes, Type } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { ShortcutTip } from '../petal/ShortcutTip'
import './CanvasToolbar.css'
import type { Tool } from '@renderer/canvas/tools'

type CanvasToolbarProps = {
  activeTool: Tool
  onToolChange: (tool: Tool) => void
  acetateVisible: boolean
  onAcetateToggle: () => void
  onShapesClick?: (anchor: { x: number; y: number }) => void
}

export default function CanvasToolbar({
  activeTool,
  onToolChange,
  acetateVisible,
  onAcetateToggle,
  onShapesClick
}: CanvasToolbarProps): React.JSX.Element {
  const { t } = useTranslation()

  const preventMouseFocus = (event: React.MouseEvent<HTMLButtonElement>): void => {
    event.preventDefault()
  }

  return (
    <div className="canvas-toolbar">
      <ShortcutTip label={t('canvasToolbar.pointerLabel')} shortcut="V">
        <button
          type="button"
          data-tool-button="pointer"
          onMouseDown={preventMouseFocus}
          onClick={() => onToolChange('pointer')}
          className={`canvas-toolbar__button${activeTool === 'pointer' ? ' canvas-toolbar__button--active' : ''}`}
          aria-label={t('canvasToolbar.pointerLabel')}
          aria-keyshortcuts="V"
        >
          <MousePointer2 size={16} strokeWidth={2} />
        </button>
      </ShortcutTip>
      <ShortcutTip label={t('canvasToolbar.handLabel')} shortcut="H">
        <button
          type="button"
          data-tool-button="hand"
          onMouseDown={preventMouseFocus}
          onClick={() => onToolChange('hand')}
          className={`canvas-toolbar__button${activeTool === 'hand' ? ' canvas-toolbar__button--active' : ''}`}
          aria-label={t('canvasToolbar.handLabel')}
          aria-keyshortcuts="H"
        >
          <Hand size={16} strokeWidth={2} />
        </button>
      </ShortcutTip>
      <ShortcutTip label={t('canvasToolbar.addTextLabel')} shortcut="T">
        <button
          type="button"
          data-tool-button="text"
          onMouseDown={preventMouseFocus}
          onClick={() => onToolChange('text')}
          className={`canvas-toolbar__button${activeTool === 'text' ? ' canvas-toolbar__button--active' : ''}`}
          aria-label={t('canvasToolbar.addTextLabel')}
          aria-keyshortcuts="T"
        >
          <Type size={16} strokeWidth={2} />
        </button>
      </ShortcutTip>
      <ShortcutTip label={t('canvasToolbar.shapesTip')} shortcut="S">
        <button
          type="button"
          data-tool-button="shapes"
          onMouseDown={preventMouseFocus}
          onClick={(e) => {
            if (!onShapesClick) return
            const rect = e.currentTarget.getBoundingClientRect()
            onShapesClick({ x: rect.left, y: rect.top })
          }}
          className={`canvas-toolbar__button${activeTool === 'shape' ? ' canvas-toolbar__button--active' : ''}`}
          aria-label={t('canvasToolbar.shapesLabel')}
          aria-keyshortcuts="S"
        >
          <Shapes size={16} strokeWidth={2} />
        </button>
      </ShortcutTip>
      <ShortcutTip label={t('canvasToolbar.inkLabel')} shortcut="P">
        <button
          type="button"
          data-tool-button="ink"
          onMouseDown={preventMouseFocus}
          onClick={() => onToolChange('ink')}
          className={`canvas-toolbar__button${activeTool === 'ink' ? ' canvas-toolbar__button--active' : ''}`}
          aria-label={t('canvasToolbar.inkLabel')}
          aria-keyshortcuts="P"
        >
          <Pen size={16} strokeWidth={2} />
        </button>
      </ShortcutTip>
      <ShortcutTip label={t('canvasToolbar.acetateLabel')} shortcut="L">
        <button
          type="button"
          data-tool-button="acetate"
          onMouseDown={preventMouseFocus}
          onClick={onAcetateToggle}
          className={`canvas-toolbar__button${acetateVisible ? ' canvas-toolbar__button--toggle-active' : ''}`}
          aria-label={t('canvasToolbar.acetateLabel')}
          aria-keyshortcuts="L"
        >
          <Layers3 size={16} strokeWidth={2} />
        </button>
      </ShortcutTip>
    </div>
  )
}
