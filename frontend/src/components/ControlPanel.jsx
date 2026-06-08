import { useRef } from 'react'

function Section({ title, children }) {
  return (
    <div className="section">
      <div className="section-label">{title}</div>
      {children}
    </div>
  )
}

function SliderRow({ label, value, min, max, step = 0.01, displayValue, onChange }) {
  return (
    <div className="slider-row">
      <div className="slider-header">
        <span className="slider-label">{label}</span>
        <span className="slider-value">{displayValue}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={e => onChange(parseFloat(e.target.value))}
        className="slider"
      />
    </div>
  )
}

function CheckRow({ label, checked, onChange }) {
  return (
    <label className="check-row">
      <span>{label}</span>
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} />
      <span className="checkmark" />
    </label>
  )
}

export default function ControlPanel({
  config, imageSrc, labels, isAnalyzing, analysisStatus,
  onImageUpload, onRotate, onAnalyze, onRegenerate, onExport, onConfigChange,
}) {
  const fileInputRef = useRef(null)

  const handleFileChange = (e) => {
    const file = e.target.files?.[0]
    if (file) onImageUpload(file)
    e.target.value = ''
  }

  const pct = v => `${Math.round(v * 100)}%`
  const hv = v => `${Math.round(v * 100)}H / ${Math.round((1 - v) * 100)}V`
  const int = (v, max) => Math.round(v * max)

  return (
    <div className="control-panel">
      <Section title="Operaciones de imagen">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          style={{ display: 'none' }}
          onChange={handleFileChange}
        />
        <button className="btn btn-primary btn-full" onClick={() => fileInputRef.current?.click()}>
          Subir imagen
        </button>
        <button
          className="btn btn-outline btn-full"
          onClick={onRotate}
          disabled={!imageSrc}
        >
          Rotar 90° ↻
        </button>
      </Section>

      <Section title="Escala de imagen">
        <SliderRow
          label="Escala"
          value={config.imageScale}
          min={0.2}
          max={2.0}
          step={0.01}
          displayValue={pct(config.imageScale)}
          onChange={v => onConfigChange('imageScale', v)}
        />
      </Section>

      <Section title="Modo de etiquetado">
        <div className="analyze-row">
          <div className="select-wrapper">
            <select className="select">
              <option>Análisis semántico IA</option>
            </select>
          </div>
          <button
            className="btn btn-ai"
            onClick={onAnalyze}
            disabled={!imageSrc || isAnalyzing}
          >
            {isAnalyzing ? '...' : 'Analizar IA'}
          </button>
        </div>
        {analysisStatus && (
          <p className="status-text">{analysisStatus}</p>
        )}
        {labels.length > 0 && !analysisStatus && (
          <p className="status-text">Se generaron {labels.length} etiquetas de IA.</p>
        )}
      </Section>

      <Section title="Parámetros de cuadrícula">
        <SliderRow
          label="Complejidad"
          value={config.gridComplexity}
          min={3}
          max={20}
          step={1}
          displayValue={`${config.gridComplexity}`}
          onChange={v => onConfigChange('gridComplexity', v)}
        />
        <SliderRow
          label="Cobertura"
          value={config.gridDensity}
          min={0}
          max={1}
          displayValue={pct(config.gridDensity)}
          onChange={v => onConfigChange('gridDensity', v)}
        />
        <button className="btn btn-outline btn-full btn-sm" onClick={onRegenerate} disabled={!imageSrc}>
          Regenerar patrón
        </button>
      </Section>

      <Section title="Opciones de distorsión">
        <SliderRow
          label="Intensidad"
          value={config.stretchIntensity}
          min={0}
          max={1}
          displayValue={pct(config.stretchIntensity)}
          onChange={v => onConfigChange('stretchIntensity', v)}
        />
        <SliderRow
          label="Balance (Horizontal ←→ Vertical)"
          value={config.hBalance}
          min={0}
          max={1}
          displayValue={hv(config.hBalance)}
          onChange={v => onConfigChange('hBalance', v)}
        />
        <SliderRow
          label="Glitch rayado"
          value={config.glitchDensity}
          min={0}
          max={1}
          displayValue={pct(config.glitchDensity)}
          onChange={v => onConfigChange('glitchDensity', v)}
        />
      </Section>

      <Section title="Configuración de visualización">
        <CheckRow
          label="Mostrar líneas de cuadrícula"
          checked={config.showGrid}
          onChange={v => onConfigChange('showGrid', v)}
        />
        <CheckRow
          label="Mostrar etiquetas de texto"
          checked={config.showLabels}
          onChange={v => onConfigChange('showLabels', v)}
        />
      </Section>

      <Section title="Guardar y exportar">
        <div className="export-row">
          <button
            className="btn btn-primary export-btn"
            onClick={() => onExport('png')}
            disabled={!imageSrc}
          >
            Exportar PNG
          </button>
          <button
            className="btn btn-primary export-btn"
            onClick={() => onExport('jpg')}
            disabled={!imageSrc}
          >
            Exportar JPG
          </button>
        </div>
        <p className="hint-text">
          Nota: "Análisis semántico IA" usa el modelo Claude para generar 20 etiquetas artísticas basadas en la imagen original.
        </p>
      </Section>
    </div>
  )
}
