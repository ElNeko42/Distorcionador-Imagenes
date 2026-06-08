import { useState, useCallback } from 'react'
import ControlPanel from './components/ControlPanel'
import ImageCanvas from './components/ImageCanvas'

const DEFAULT_CONFIG = {
  imageScale: 0.85,
  gridComplexity: 8,
  gridDensity: 0.6,
  stretchIntensity: 0.85,
  hBalance: 1.0,
  glitchDensity: 0.25,
  showGrid: true,
  showLabels: true,
}

export default function App() {
  const [config, setConfig] = useState(DEFAULT_CONFIG)
  const [imageSrc, setImageSrc] = useState(null)
  const [imageFile, setImageFile] = useState(null)
  const [labels, setLabels] = useState([])
  const [rotation, setRotation] = useState(0)
  const [seed, setSeed] = useState(() => Math.random())
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [analysisStatus, setAnalysisStatus] = useState('')
  const [canvasRef, setCanvasRef] = useState(null)

  const handleImageUpload = useCallback((file) => {
    const url = URL.createObjectURL(file)
    setImageSrc(url)
    setImageFile(file)
    setLabels([])
    setAnalysisStatus('')
    setRotation(0)
    setSeed(Math.random())
  }, [])

  const handleRotate = useCallback(() => {
    setRotation(prev => (prev + 90) % 360)
  }, [])

  const handleAnalyze = useCallback(async () => {
    if (!imageFile) return
    setIsAnalyzing(true)
    setAnalysisStatus('')
    try {
      const { analyzeImage } = await import('./services/api.js')
      const result = await analyzeImage(imageFile)
      setLabels(result.labels)
      setAnalysisStatus(result.status)
    } catch (err) {
      setAnalysisStatus('Error al analizar la imagen. Reintentando con etiquetas de ejemplo.')
      // Fallback mock labels for offline use
      setLabels(generateFallbackLabels())
    } finally {
      setIsAnalyzing(false)
    }
  }, [imageFile])

  const handleRegenerate = useCallback(() => {
    setSeed(Math.random())
  }, [])

  const handleExport = useCallback((format) => {
    if (!canvasRef) return
    const mimeType = format === 'png' ? 'image/png' : 'image/jpeg'
    const quality = format === 'jpg' ? 0.92 : undefined
    canvasRef.toBlob((blob) => {
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `cuadricula-distorsionada.${format}`
      link.click()
      URL.revokeObjectURL(url)
    }, mimeType, quality)
  }, [canvasRef])

  const updateConfig = useCallback((key, value) => {
    setConfig(prev => ({ ...prev, [key]: value }))
  }, [])

  return (
    <div className="app-layout">
      <div className="panel-left">
        <div className="app-header">
          <h1>Cuadrícula de Imagen <span className="header-accent">Distorsión</span></h1>
          <p>Controlador inteligente de malla y distorsión</p>
        </div>
        <ControlPanel
          config={config}
          imageSrc={imageSrc}
          labels={labels}
          isAnalyzing={isAnalyzing}
          analysisStatus={analysisStatus}
          onImageUpload={handleImageUpload}
          onRotate={handleRotate}
          onAnalyze={handleAnalyze}
          onRegenerate={handleRegenerate}
          onExport={handleExport}
          onConfigChange={updateConfig}
        />
      </div>
      <div className="panel-right">
        <ImageCanvas
          imageSrc={imageSrc}
          config={config}
          labels={labels}
          rotation={rotation}
          seed={seed}
          onCanvasReady={setCanvasRef}
        />
      </div>
    </div>
  )
}

function generateFallbackLabels() {
  const words = [
    'TEXTURA', 'FORMA', 'COLOR', 'BORDE', 'LUZ', 'SOMBRA', 'PATRÓN',
    'DETALLE', 'CONTORNO', 'PROFUNDIDAD', 'SUPERFICIE', 'VOLUMEN',
    'REFLEJO', 'CONTRASTE', 'SATURACIÓN', 'NITIDEZ', 'COMPOSICIÓN', 'FOCO',
  ]
  return words.map((text, i) => ({
    text,
    count: `${Math.floor(Math.random() * 20) + 1}+`,
    x: (i % 5) * 20 + Math.random() * 15,
    y: Math.floor(i / 5) * 25 + Math.random() * 15,
  }))
}
