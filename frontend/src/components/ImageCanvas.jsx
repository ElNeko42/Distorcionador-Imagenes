import { useRef, useEffect, useCallback } from 'react'

// Seeded PRNG (mulberry32)
function mulberry32(seed) {
  let a = seed * 2654435761
  return () => {
    a |= 0
    a = (a + 0x6D2B79F5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// Compute per-column widths, per-row heights, and per-row horizontal offsets
function computeDistortion(seed, cols, rows, density, intensity, hBalance) {
  const rand = mulberry32(seed * 10000)

  // Stretched cells get up to 10x their base size.
  // Non-stretched cells compress (making room) so the ratio can be 5–10:1.
  const colWidths = Array.from({ length: cols }, () => {
    const prob = rand()
    const mag = rand()
    if (prob < density * hBalance) {
      return (1 / cols) * (1 + intensity * 9 * mag)   // up to 10x base
    }
    return (1 / cols) * Math.max(0.06, 1 - intensity * mag * 0.88)  // compressed
  })

  const rowHeights = Array.from({ length: rows }, () => {
    const prob = rand()
    const mag = rand()
    if (prob < density * (1 - hBalance)) {
      return (1 / rows) * (1 + intensity * 9 * mag)
    }
    return (1 / rows) * Math.max(0.06, 1 - intensity * mag * 0.88)
  })

  // Per-row horizontal displacement — creates the "sliding bands / data-moshing" effect
  const rowOffsets = Array.from({ length: rows }, () => {
    if (rand() < density * 0.55) {
      return (rand() * 2 - 1) * intensity * 0.22  // ±22% of image width
    }
    return 0
  })

  return { colWidths, rowHeights, rowOffsets }
}

function drawScene(canvas, img, config, labels, rotation, seed) {
  const ctx = canvas.getContext('2d')
  const { gridComplexity, gridDensity, stretchIntensity, hBalance,
          imageScale, showGrid, showLabels } = config

  const cols = Math.round(gridComplexity)
  const rows = Math.round(gridComplexity)

  ctx.clearRect(0, 0, canvas.width, canvas.height)
  ctx.fillStyle = '#f5f5f5'
  ctx.fillRect(0, 0, canvas.width, canvas.height)

  if (!img) return

  // Apply rotation to an offscreen canvas
  const rotated = document.createElement('canvas')
  const angle = (rotation * Math.PI) / 180
  const sin = Math.abs(Math.sin(angle))
  const cos = Math.abs(Math.cos(angle))
  rotated.width = img.naturalWidth * cos + img.naturalHeight * sin
  rotated.height = img.naturalWidth * sin + img.naturalHeight * cos
  const rCtx = rotated.getContext('2d')
  rCtx.translate(rotated.width / 2, rotated.height / 2)
  rCtx.rotate(angle)
  rCtx.drawImage(img, -img.naturalWidth / 2, -img.naturalHeight / 2)

  const imgW = rotated.width
  const imgH = rotated.height

  const { colWidths, rowHeights, rowOffsets } = computeDistortion(
    seed, cols, rows, gridDensity, stretchIntensity, hBalance
  )

  // Total distorted dimensions (before fit-scaling)
  const totalW = colWidths.reduce((s, w) => s + w, 0) * imgW
  const totalH = rowHeights.reduce((s, h) => s + h, 0) * imgH

  const fitScale = Math.min(
    (canvas.width * 0.92) / totalW,
    (canvas.height * 0.92) / totalH
  ) * imageScale
  const drawW = totalW * fitScale
  const drawH = totalH * fitScale

  const offsetX = (canvas.width - drawW) / 2
  const offsetY = (canvas.height - drawH) / 2

  const srcCellW = imgW / cols
  const srcCellH = imgH / rows

  // Cumulative column x-positions (relative to the row's base x — offsets added per row)
  const colRelX = [0]
  for (let c = 0; c < cols; c++) {
    colRelX.push(colRelX[c] + colWidths[c] * imgW * fitScale)
  }

  // Cumulative row y-positions
  const dstRowY = [offsetY]
  for (let r = 0; r < rows; r++) {
    dstRowY.push(dstRowY[r] + rowHeights[r] * imgH * fitScale)
  }

  // Draw each cell — each row is shifted horizontally by its own offset
  for (let r = 0; r < rows; r++) {
    const rowBaseX = offsetX + rowOffsets[r] * drawW
    for (let c = 0; c < cols; c++) {
      const sx = c * srcCellW
      const sy = r * srcCellH
      const dx = rowBaseX + colRelX[c]
      const dy = dstRowY[r]
      const dw = colRelX[c + 1] - colRelX[c]
      const dh = dstRowY[r + 1] - dstRowY[r]
      ctx.drawImage(rotated, sx, sy, srcCellW, srcCellH, dx, dy, dw, dh)
    }
  }

  // Grid lines — vertical lines follow each row's horizontal offset
  if (showGrid) {
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)'
    ctx.lineWidth = 0.8
    for (let r = 0; r < rows; r++) {
      const bx = offsetX + rowOffsets[r] * drawW
      // Horizontal boundary line for this row
      ctx.beginPath()
      ctx.moveTo(bx + colRelX[0], dstRowY[r])
      ctx.lineTo(bx + colRelX[cols], dstRowY[r])
      ctx.stroke()
      // Vertical column dividers within this row
      for (let c = 0; c <= cols; c++) {
        ctx.beginPath()
        ctx.moveTo(bx + colRelX[c], dstRowY[r])
        ctx.lineTo(bx + colRelX[c], dstRowY[r + 1])
        ctx.stroke()
      }
    }
    // Bottom boundary
    const lastBx = offsetX + rowOffsets[rows - 1] * drawW
    ctx.beginPath()
    ctx.moveTo(lastBx + colRelX[0], dstRowY[rows])
    ctx.lineTo(lastBx + colRelX[cols], dstRowY[rows])
    ctx.stroke()
  }

  // Draw labels
  if (showLabels && labels.length > 0) {
    labels.forEach(label => {
      const lx = offsetX + (label.x / 100) * drawW
      const ly = offsetY + (label.y / 100) * drawH

      ctx.font = 'bold 11px system-ui, sans-serif'
      ctx.textBaseline = 'top'

      const textW = ctx.measureText(label.text).width
      const countW = ctx.measureText(label.count).width

      // Label background
      ctx.fillStyle = 'rgba(0, 0, 0, 0.72)'
      ctx.fillRect(lx, ly, textW + 8, 14)

      // Count background
      ctx.fillStyle = 'rgba(0, 0, 0, 0.45)'
      ctx.fillRect(lx, ly + 14, countW + 6, 11)

      // Label text
      ctx.fillStyle = '#ffffff'
      ctx.font = 'bold 10px system-ui, sans-serif'
      ctx.fillText(label.text, lx + 4, ly + 2)

      // Count text
      ctx.fillStyle = '#cccccc'
      ctx.font = '9px system-ui, sans-serif'
      ctx.fillText(label.count, lx + 3, ly + 15)
    })
  }
}

export default function ImageCanvas({ imageSrc, config, labels, rotation, seed, onCanvasReady }) {
  const canvasRef = useRef(null)
  const imgRef = useRef(null)
  const containerRef = useRef(null)

  const render = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    drawScene(canvas, imgRef.current, config, labels, rotation, seed)
  }, [config, labels, rotation, seed])

  // Load image and re-render when src changes
  useEffect(() => {
    if (!imageSrc) {
      imgRef.current = null
      render()
      return
    }
    const img = new Image()
    img.onload = () => {
      imgRef.current = img
      render()
    }
    img.src = imageSrc
  }, [imageSrc, render])

  // Re-render on config / label / rotation / seed changes
  useEffect(() => {
    render()
  }, [render])

  // Resize canvas to container
  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    const observer = new ResizeObserver(() => {
      const canvas = canvasRef.current
      if (!canvas) return
      canvas.width = container.clientWidth
      canvas.height = container.clientHeight
      render()
    })
    observer.observe(container)
    return () => observer.disconnect()
  }, [render])

  // Expose canvas ref for export
  useEffect(() => {
    onCanvasReady(canvasRef.current)
  }, [onCanvasReady])

  return (
    <div ref={containerRef} className="canvas-container">
      <canvas ref={canvasRef} className="main-canvas" />
      {!imageSrc && (
        <div className="canvas-placeholder">
          <div className="placeholder-icon">⬛</div>
          <p>Sube una imagen para comenzar</p>
        </div>
      )}
    </div>
  )
}
