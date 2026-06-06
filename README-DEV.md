# Editor de Cuadrícula de Imagen

## Arrancar el proyecto

### Backend (Spring Boot - Java 17+, Maven)
```
cd backend
mvn spring-boot:run
```
Corre en http://localhost:8080

### Frontend (React + Vite)
```
cd frontend
npm install
npm run dev
```
Corre en http://localhost:5173

---

## Configurar el análisis con IA (opcional)

Establece la variable de entorno antes de arrancar el backend:

```
set ANTHROPIC_API_KEY=sk-ant-...
mvn spring-boot:run
```

Sin la clave, el backend devuelve etiquetas de ejemplo automáticamente.

---

## Estructura del proyecto

```
editorImagen/
├── backend/                         Spring Boot REST API
│   └── src/main/java/com/imageeditor/
│       ├── controller/ImageController.java   POST /api/analyze
│       ├── service/AiAnalysisService.java    Llama a Claude Vision
│       └── dto/                             LabelDto, AnalysisResponse
└── frontend/                        React + Vite
    └── src/
        ├── App.jsx                  Estado global
        ├── components/
        │   ├── ControlPanel.jsx     Panel izquierdo de controles
        │   └── ImageCanvas.jsx      Canvas con distorsión de cuadrícula
        └── services/api.js          Llama al backend
```
