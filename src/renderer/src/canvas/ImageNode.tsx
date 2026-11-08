import { useCallback, useEffect, useState, type MouseEvent } from 'react'
import { type NodeProps, useUpdateNodeInternals } from '@xyflow/react'
import { useNodeVisibility } from './useNodeVisibility'
import { useBoardStore } from '@renderer/stores/board'
import { resourceToImageSrc } from '@renderer/shared/resource-url'
import { NodeResizeHandles } from './NodeResizeHandles'
import { useFixedCornerResize } from './useFixedCornerResize'
import './ImageNode.css'

const MIN_SIZE = 80

type ImageNodeData = {
  resource: string
  size: { w: number; h: number }
}

export function ImageNode({ id, data, selected, dragging, positionAbsoluteX, positionAbsoluteY }: NodeProps) {
  const { resource, size } = data as ImageNodeData
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


  const handleDoubleClick = (e: MouseEvent) => {
    e.stopPropagation()
    void window.api.openFile(resource)
  }

  return (
    <>
      <div
        ref={visibilityRef}
        className={`image-node${selected ? ' image-node--selected' : ''}${isResizing ? ' image-node--resizing nodrag nopan' : ''}`}
        style={{ width: localSize.w, height: localSize.h }}
        onDoubleClick={handleDoubleClick}
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
