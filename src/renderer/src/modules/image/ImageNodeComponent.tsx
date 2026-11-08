import { useCallback, useEffect, useState } from 'react'
import { useInternalNode, useUpdateNodeInternals } from '@xyflow/react'
import { useNodeVisibility } from '../../canvas/useNodeVisibility'
import { useBoardStore } from '@renderer/stores/board'
import { resourceToImageSrc } from '@renderer/shared/resource-url'
import { NodeResizeHandles } from '../../canvas/NodeResizeHandles'
import { useFixedCornerResize } from '../../canvas/useFixedCornerResize'
import type { BudNodeProps } from '../types'
import '../../canvas/ImageNode.css'

const MIN_SIZE = 80

export function ImageNodeComponent({ id, resource, size, selected, dragging, onBloom }: BudNodeProps) {
  const internalNode = useInternalNode(id)
  const positionAbsoluteX = internalNode?.internals.positionAbsolute.x ?? 0
  const positionAbsoluteY = internalNode?.internals.positionAbsolute.y ?? 0

  const updateNodePosition = useBoardStore((s) => s.updateNodePosition)
  const updateNodeSize = useBoardStore((s) => s.updateNodeSize)
  const updateNodeInternals = useUpdateNodeInternals()

  const { ref: visibilityRef, isVisible } = useNodeVisibility<HTMLDivElement>()
  const [localSize, setLocalSize] = useState({ w: size.w, h: size.h })
  const [imageSrc, setImageSrc] = useState('')

  useEffect(() => {
    try {
      setImageSrc(resourceToImageSrc(resource))
    } catch {
      setImageSrc('')
    }
  }, [resource])

  const handleResizePreview = useCallback(
    ({ size: nextSize }: { position: { x: number; y: number }; size: { w: number; h: number } }) => {
      setLocalSize(nextSize)
    },
    []
  )

  const handleResizeCommit = useCallback(
    ({ position, size: nextSize }: { position: { x: number; y: number }; size: { w: number; h: number } }) => {
      setLocalSize(nextSize)
      updateNodePosition(id, position.x, position.y)
      updateNodeSize(id, nextSize.w, nextSize.h)
    },
    [id, updateNodePosition, updateNodeSize]
  )

  const { activeCorner, beginResize, isResizing } = useFixedCornerResize({
    nodeId: id,
    position: { x: positionAbsoluteX, y: positionAbsoluteY },
    size: localSize,
    minWidth: MIN_SIZE,
    minHeight: MIN_SIZE,
    keepAspectRatio: true,
    onPreviewChange: handleResizePreview,
    onCommitChange: handleResizeCommit
  })

  useEffect(() => {
    if (isResizing) return
    setLocalSize({ w: size.w, h: size.h })
  }, [isResizing, size.w, size.h])

  useEffect(() => {
    updateNodeInternals(id)
  }, [id, localSize.h, localSize.w, updateNodeInternals])


  return (
    <>
      <div
        ref={visibilityRef}
        className={`image-node${selected ? ' image-node--selected' : ''}${isResizing ? ' image-node--resizing nodrag nopan' : ''}`}
        style={{ width: localSize.w, height: localSize.h }}
        onDoubleClick={(e) => { e.stopPropagation(); onBloom() }}
      >
        <div className="image-node__frame">
          {isVisible && imageSrc ? (
            <img
              className="image-node__img"
              src={imageSrc}
              decoding="async"
              draggable={false}
            />
          ) : null}
        </div>
      </div>
      <NodeResizeHandles
        visible={(selected || isResizing) && !dragging}
        activeCorner={activeCorner}
        onPointerDown={(corner, event) => beginResize(corner, event)}
      />
    </>
  )
}
