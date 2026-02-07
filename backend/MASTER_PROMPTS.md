# Master Prompt System

## Übersicht

Das Master Prompt System bietet eine **zentrale, konsistente und konfigurierbare** Verwaltung aller System-Prompts für den Ollama-Agenten.

### Features

✅ **Zentrale Konfiguration** - Alle Prompts in einer Datei (`config/prompts.js`)  
✅ **Template-System** - Variablen-Ersetzung mit `{{VARIABLE}}`  
✅ **Sprachliche Konsistenz** - Einheitlich auf Deutsch  
✅ **Versionsverwaltung** - Prompt-Versionierung für Iterationen  
✅ **Kombinierbar** - Mehrere Prompts zu einem zusammenführen  
✅ **API-Zugriff** - REST-Endpunkte für Prompt-Management  

## Architektur

```
┌─────────────────────────────────────────────────────┐
│                 PromptService                        │
│  ┌──────────────────────────────────────────────┐  │
│  │  1. Zentrale Config (config/prompts.js)      │  │
│  │  2. Template Rendering                       │  │
│  │  3. Prompt-Kombination                       │  │
│  │  4. Usage-Tracking                           │  │
│  └──────────────────────────────────────────────┘  │
└──────────────────────┬──────────────────────────────┘
                       │
        ┌──────────────┼──────────────┐
        ▼              ▼              ▼
   Chat-Endpoint   RAG-Search   Websearch
```

## Prompt-Kategorien

### 1. Basis-Personality
**Pfad:** `basePersonality`

Grundlegende Verhaltensregeln für den Agenten:
- Sprache (Deutsch)
- Ton (hilfreich, präzise, freundlich)
- Verfügbare Tools (RAG, Websearch)

### 2. RAG Prompts (Lokale Wissensdatenbank)
**Pfade:** 
- `rag.contextWrapper` - Kontext-Wrapper mit Anweisungen
- `rag.noResults` - Wenn keine Ergebnisse gefunden
- `rag.searchMethodHint` - Suchmethoden-Information

**Verwendung:**
```javascript
const prompt = PromptService.buildRagPrompt(foundContext, {
  searchMethod: 'semantic',
  resultCount: 5
});
```

### 3. Websearch Prompts
**Pfade:**
- `websearch.contextWrapper` - Web-Kontext mit Quellenangaben
- `websearch.noResults` - Keine Web-Ergebnisse
- `websearch.summarization` - Für Zusammenfassungen
- `websearch.citationFormat` - Format für Zitate

**Verwendung:**
```javascript
const prompt = PromptService.buildWebsearchPrompt(webContext, {
  query: 'Suchbegriff',
  sourceCount: 3
});
```

### 4. Spezialisierte Prompts
**Pfade:**
- `specialized.timeSensitive` - Zeit-sensitive Fragen
- `specialized.factCheck` - Faktencheck
- `specialized.learning` - Lern-Assistent
- `specialized.translation` - Übersetzungen

### 5. Chat Prompts
**Pfade:**
- `chat.default` - Standard-Chat
- `chat.codeAssistant` - Code-Hilfe
- `chat.creativeWriting` - Kreatives Schreiben
- `chat.analysis` - Analyse & Zusammenfassung

### 6. Tools & Hilfe
**Pfade:**
- `tools.availableTools` - Liste verfügbarer Tools
- `tools.toolSelection` - Wann welches Tool nutzen

### 7. Fehlerbehandlung
**Pfade:**
- `errors.general` - Allgemeiner Fehler
- `errors.ollamaConnection` - Keine Ollama-Verbindung
- `errors.noResults` - Keine Suchergebnisse

## API Endpoints

### GET /api/prompts
Liste aller verfügbaren Prompt-Pfade.

**Response:**
```json
{
  "success": true,
  "version": {
    "version": "1.0.0",
    "language": "de",
    "totalPrompts": 25
  },
  "availablePrompts": [
    "basePersonality",
    "rag.contextWrapper",
    "websearch.contextWrapper",
    ...
  ]
}
```

### GET /api/prompts/:path
Holt einen spezifischen Prompt.

**Beispiel:** `GET /api/prompts/rag.contextWrapper`

**Response:**
```json
{
  "success": true,
  "path": "rag.contextWrapper",
  "prompt": {
    "role": "system",
    "content": "=== LOKALE WISSENSBASIS ===\n..."
  }
}
```

### POST /api/prompts/build
Baut einen Prompt mit Kontext.

**Request:**
```json
{
  "type": "rag",
  "context": "Gefundene Informationen...",
  "options": {
    "searchMethod": "semantic",
    "resultCount": 5
  }
}
```

**Verfügbare Typen:**
- `rag` - RAG mit lokalem Kontext
- `websearch` - Websearch-Kontext
- `combined` - Beides kombiniert
- `code` - Code-Assistent
- `analysis` - Analyse
- `learning` - Lern-Assistent

### GET /api/prompts/stats
Nutzungsstatistiken der Prompts.

## Verwendung im Code

### Einfacher Prompt
```javascript
const PromptService = require('./prompt-service');

// Einzelnen Prompt holen
const prompt = PromptService.get('basePersonality');

// Mit Variablen
const prompt = PromptService.get('rag.contextWrapper', {
  CONTEXT: 'Gefundene Daten...'
});
```

### Prompts kombinieren
```javascript
const combined = PromptService.combine([
  'basePersonality',
  'chat.codeAssistant'
], { language: 'JavaScript' });
```

### Spezialisierte Builder
```javascript
// RAG
const ragPrompt = PromptService.buildRagPrompt(context, {
  searchMethod: 'semantic',
  resultCount: 5
});

// Websearch
const webPrompt = PromptService.buildWebsearchPrompt(webContext, {
  query: 'Suchbegriff',
  sourceCount: 3
});

// Kombiniert
const combined = PromptService.buildCombinedPrompt({
  ragContext: localData,
  webContext: webData
});

// Spezialisiert
const codePrompt = PromptService.getCodeAssistantPrompt('Python');
const analysisPrompt = PromptService.getAnalysisPrompt();
```

## Template-System

Prompts können Variablen enthalten:

```javascript
// In prompts.js
ragContextWrapper: `=== LOKALE WISSENSBASIS ===
{{CONTEXT}}

Gefundene Ergebnisse: {{COUNT}}`

// Verwendung
const prompt = PromptService.get('rag.contextWrapper', {
  CONTEXT: 'Daten...',
  COUNT: 5
});

// Ergebnis
"=== LOKALE WISSENSBASIS ===
Daten...

Gefundene Ergebnisse: 5"
```

## Anpassung von Prompts

### Ohne Code-Änderung (einfach)
Editiere einfach `backend/config/prompts.js`:

```javascript
// Vorher
basePersonality: {
  content: `Du bist ein hilfreicher...`
}

// Nachher
basePersonality: {
  content: `Du bist ein super-witzig...`  // Deine Anpassung
}
```

### Neue Prompts hinzufügen
```javascript
// In prompts.js unter MASTER_PROMPTS
myCustomPrompts: {
  myPrompt: `Hier ist mein Custom Prompt...`,
  anotherPrompt: {
    content: `Noch ein Prompt mit {{VARIABLE}}`
  }
}

// Verwendung
const prompt = PromptService.get('myCustomPrompts.myPrompt');
```

## Best Practices

1. **Konsistente Sprache** - Alle Prompts auf Deutsch (oder einheitlich)
2. **Klare Anweisungen** - Spezifische, nicht-ambige Instruktionen
3. **Quellenangaben** - Immer verlangen, woher Informationen stammen
4. **Fehlerfälle** - Definiere, was bei fehlenden Daten passiert
5. **Länge beachten** - Prompts können sehr lang werden mit Kontext

## Troubleshooting

### Prompt nicht gefunden
```javascript
// Prüfe ob Pfad existiert
const isValid = PromptService.isValidPath('rag.contextWrapper');

// Liste alle Pfade
const allPrompts = PromptService.listAvailablePrompts();
```

### Variablen werden nicht ersetzt
- Prüfe Schreibweise: `{{VARIABLE}}` (Großbuchstaben empfohlen)
- Ungenutzte Variablen werden automatisch entfernt

### Prompt zu lang
- Nutze Context Window Management im Service
- Kürze Context vor dem Einsetzen
- Erhöhe `maxContextLength` falls nötig

## Versionierung

Die Prompt-Version ist in `MASTER_PROMPTS.version` definiert:

```javascript
const version = PromptService.getVersionInfo();
// { version: '1.0.0', language: 'de', totalPrompts: 25 }
```

Bei Änderungen:
1. Version erhöhen (SemVer)
2. Changelog dokumentieren
3. API-Version anpassen

## Migration von alten Prompts

Vorher (hardcodiert in server.js):
```javascript
const ragSystemMessage = {
  role: 'system',
  content: `${context}

Use this knowledge...`
};
```

Nachher (mit PromptService):
```javascript
const ragPrompt = PromptService.buildRagPrompt(context, {
  searchMethod: 'semantic',
  resultCount: 5
});
```

## Nächste Schritte

- [ ] A/B Testing für Prompt-Varianten
- [ ] User-Feedback zu Prompts sammeln
- [ ] Automatische Prompt-Optimierung
- [ ] Mehrsprachige Prompts
