import type { ReactNode } from 'react'
import './ShortcutTip.css'

type ShortcutTipProps = {
  /** What the control does, e.g. "Select". */
  label: string
  /** Keyboard shortcut shown as a key cap, e.g. "V". */
  shortcut?: string
  children: ReactNode
}

/**
 * Small hover bubble above a toolbar control showing its name and shortcut
 * (like Paint / Whiteboard). Pure CSS: appears after a short hover delay.
 */
export function ShortcutTip({ label, shortcut, children }: ShortcutTipProps): React.JSX.Element {
  return (
    <span className="wb-tip">
      {children}
      <span className="wb-tip__bubble" role="tooltip">
        <span className="wb-tip__label">{label}</span>
        {shortcut ? <kbd className="wb-tip__key">{shortcut}</kbd> : null}
      </span>
    </span>
  )
}
