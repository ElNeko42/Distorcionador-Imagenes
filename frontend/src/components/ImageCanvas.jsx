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

// Compute distortion using a deterministic ranked approach.
// Critical rule: only compress cells on an axis that HAS stretched cells.
// If hBalance=1 → no rows stretch → rows stay at base size (prevents image collapsing).
function computeDistortion(seed, cols, rows, density, intensity, hBalance) {
  const rand = mulberry32(seed * 10000)

  // --- Column widths (horizontal stretch) ---
  const colRaw = Array.from({ length: cols }, () => ({ key: rand(), mag: rand() }))
  const numColStretch = Math.round(cols * density * hBalance)  // 0 is valid
  const colRanked = [...colRaw.map((d, i) => ({ ...d, i }))].sort((a, b) => a.key - b.key)
  const colStretched = new Set(colRanked.slice(0, numColStretch).map(d => d.i))

  const colWidths = colRaw.map((d, i) => {
    if (colStretched.has(i)) {
      // Stretched: 1x to ~9x base
      return (1 / cols) * (1 + intensity * 8 * (0.3 + 0.7 * d.mag))
    }
    if (numColStretch === 0) return 1 / cols  // no cols stretch → keep base size
    // Compressed (only when other cols stretch): ~3% to 20% of base
    return (1 / cols) * Math.max(0.03, (1 - intensity) * (0.3 + 0.7 * d.mag))
  })

  // --- Row heights (vertical stretch) ---
  const rowRaw = Array.from({ length: rows }, () => ({ key: rand(), mag: rand() }))
  const numRowStretch = Math.round(rows * density * (1 - hBalance))  // 0 is valid
  const rowRanked = [...rowRaw.map((d, i) => ({ ...d, i }))].sort((a, b) => a.key - b.key)
  const rowStretched = new Set(rowRanked.slice(0, numRowStretch).map(d => d.i))

  const rowHeights = rowRaw.map((d, i) => {
    if (rowStretched.has(i)) {
      return (1 / rows) * (1 + intensity * 8 * (0.3 + 0.7 * d.mag))
    }
    if (numRowStretch === 0) return 1 / rows  // no rows stretch → keep base size
    return (1 / rows) * Math.max(0.03, (1 - intensity) * (0.3 + 0.7 * d.mag))
  })

  // --- Per-row horizontal offsets (data-moshing band displacement) ---
  const rowOffsets = Array.from({ length: rows }, () => {
    const prob = rand()
    const dir  = rand()
    return prob < density * 0.55 ? (dir * 2 - 1) * intensity * 0.22 : 0
  })

  return { colWidths, rowHeights, rowOffsets }
}

function drawGlitchStripes(ctx, imgData, imgW, sx, sy, srcW, srcH, dx, dy, dw, dh) {
  const imgH = imgData.height
  const stripeCount = Math.max(4, Math.round(dh / 2))
  for (let s = 0; s < stripeCount; s++) {
    const srcRow = Math.max(0, Math.min(Math.round(sy + (s / stripeCount) * srcH), imgH - 1))
    let r = 0, g = 0, b = 0, count = 0
    const x0 = Math.max(0, Math.round(sx))
    const x1 = Math.min(imgW, Math.round(sx + srcW))
    for (let x = x0; x < x1; x++) {
      const idx = (srcRow * imgW + x) * 4
      r += imgData.data[idx]
      g += imgData.data[idx + 1]
      b += imgData.data[idx + 2]
      count++
    }
    if (count > 0) { r = (r / count) | 0; g = (g / count) | 0; b = (b / count) | 0 }
    const y0 = dy + (s / stripeCount) * dh
    const y1 = dy + ((s + 1) / stripeCount) * dh
    ctx.fillStyle = `rgb(${r},${g},${b})`
    ctx.fillRect(Math.floor(dx), Math.floor(y0), Math.ceil(dw) + 1, Math.ceil(y1 - y0) + 1)
  }
}

function drawScene(canvas, img, config, labels, rotation, seed) {
  const ctx = canvas.getContext('2d')
  const { gridComplexity, gridDensity, stretchIntensity, hBalance,
          imageScale, showGrid, showLabels, glitchDensity } = config

  const cols = Math.round(gridComplexity)
  const rows = Math.round(gridComplexity)

  ctx.clearRect(0, 0, canvas.width, canvas.height)
  ctx.fillStyle = '#f5f5f5'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  if (!img) return

  // Rotate to offscreen canvas
  const rotated = document.createElement('canvas')
  const angle = (rotation * Math.PI) / 180
  const sin = Math.abs(Math.sin(angle))
  const cos = Math.abs(Math.cos(angle))
  rotated.width  = img.naturalWidth * cos + img.naturalHeight * sin
  rotated.height = img.naturalWidth * sin + img.naturalHeight * cos
  const rCtx = rotated.getContext('2d')
  rCtx.translate(rotated.width / 2, rotated.height / 2)
  rCtx.rotate(angle)
  rCtx.drawImage(img, -img.naturalWidth / 2, -img.naturalHeight / 2)

  const imgW = rotated.width
  const imgH = rotated.height

  const rotatedImgData = glitchDensity > 0
    ? rotated.getContext('2d').getImageData(0, 0, imgW, imgH)
    : null

  const glitchRand = mulberry32((seed * 73856093) | 0)
  const glitchCells = new Set()
  if (glitchDensity > 0) {
    for (let r = 0; r < Math.round(gridComplexity); r++) {
      for (let c = 0; c < Math.round(gridComplexity); c++) {
        if (glitchRand() < glitchDensity) glitchCells.add(r * Math.round(gridComplexity) + c)
      }
    }
  }

  const { colWidths, rowHeights, rowOffsets } = computeDistortion(
    seed, cols, rows, gridDensity, stretchIntensity, hBalance
  )

  // Total distorted pixel dimensions
  const totalNormW = colWidths.reduce((s, w) => s + w, 0)   // sum of (1/cols * factor)
  const totalNormH = rowHeights.reduce((s, h) => s + h, 0)
  const totalW = totalNormW * imgW
  const totalH = totalNormH * imgH

  // Fit distorted result into canvas
  const fitScale = Math.min(
    (canvas.width  * 0.93) / totalW,
    (canvas.height * 0.93) / totalH
  ) * imageScale
  const drawW = totalW * fitScale
  const drawH = totalH * fitScale
  const offsetX = (canvas.width  - drawW) / 2
  const offsetY = (canvas.height - drawH) / 2

  const srcCellW = imgW / cols
  const srcCellH = imgH / rows

  // Cumulative column x-positions (relative, row offset added per-row)
  const colRelX = [0]
  for (let c = 0; c < cols; c++) {
    colRelX.push(colRelX[c] + colWidths[c] * imgW * fitScale)
  }

  // Cumulative row y-positions (absolute)
  const dstRowY = [offsetY]
  for (let r = 0; r < rows; r++) {
    dstRowY.push(dstRowY[r] + rowHeights[r] * imgH * fitScale)
  }

  // Draw each cell with per-row horizontal displacement
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
      if (rotatedImgData && glitchCells.has(r * cols + c)) {
        drawGlitchStripes(ctx, rotatedImgData, imgW, sx, sy, srcCellW, srcCellH, dx, dy, dw, dh)
      }
    }
  }

  // Grid lines — vertical segments follow each row's offset
  if (showGrid) {
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.65)'
    ctx.lineWidth = 0.8
    for (let r = 0; r < rows; r++) {
      const bx = offsetX + rowOffsets[r] * drawW
      ctx.beginPath()
      ctx.moveTo(bx + colRelX[0], dstRowY[r])
      ctx.lineTo(bx + colRelX[cols], dstRowY[r])
      ctx.stroke()
      for (let c = 0; c <= cols; c++) {
        ctx.beginPath()
        ctx.moveTo(bx + colRelX[c], dstRowY[r])
        ctx.lineTo(bx + colRelX[c], dstRowY[r + 1])
        ctx.stroke()
      }
    }
    const lastBx = offsetX + rowOffsets[rows - 1] * drawW
    ctx.beginPath()
    ctx.moveTo(lastBx + colRelX[0], dstRowY[rows])
    ctx.lineTo(lastBx + colRelX[cols], dstRowY[rows])
    ctx.stroke()
  }

  // Labels
  if (showLabels && labels.length > 0) {
    labels.forEach(label => {
      const lx = offsetX + (label.x / 100) * drawW
      const ly = offsetY + (label.y / 100) * drawH

      ctx.font = 'bold 11px system-ui, sans-serif'
      ctx.textBaseline = 'top'
      const textW  = ctx.measureText(label.text).width
      const countW = ctx.measureText(label.count).width

      ctx.fillStyle = 'rgba(0,0,0,0.72)'
      ctx.fillRect(lx, ly, textW + 8, 14)
      ctx.fillStyle = 'rgba(0,0,0,0.45)'
      ctx.fillRect(lx, ly + 14, countW + 6, 11)

      ctx.fillStyle = '#ffffff'
      ctx.font = 'bold 10px system-ui, sans-serif'
      ctx.fillText(label.text, lx + 4, ly + 2)
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

  useEffect(() => {
    if (!imageSrc) { imgRef.current = null; render(); return }
    const img = new Image()
    img.onload = () => { imgRef.current = img; render() }
    img.src = imageSrc
  }, [imageSrc, render])

  useEffect(() => { render() }, [render])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    const observer = new ResizeObserver(() => {
      const canvas = canvasRef.current
      if (!canvas) return
      canvas.width  = container.clientWidth
      canvas.height = container.clientHeight
      render()
    })
    observer.observe(container)
    return () => observer.disconnect()
  }, [render])

  useEffect(() => { onCanvasReady(canvasRef.current) }, [onCanvasReady])

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
