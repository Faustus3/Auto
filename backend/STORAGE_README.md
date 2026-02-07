# Backend Speicher-System - Dokumentation

## Überblick

Das Backend verfügt nun über ein robustes Speichersystem mit folgenden Komponenten:

1. **SQLite Datenbank** - Strukturierte Speicherung für Notizen und Blog-Posts
2. **Datei-Speicher** - Sicherer Upload mit Validierung und Metadaten
3. **Ollama RAG Integration** - Intelligente Kontext-Extraktion für den Agenten

## Architektur

```
┌─────────────────────────────────────────────────────────────┐
│                    API Endpoints                            │
├──────────────┬──────────────┬───────────────────────────────┤
│   /upload    │  /save-note  │       /query-agent            │
└──────┬───────┴──────┬───────┴───────────┬───────────────────┘
       │              │                   │
┌──────▼───────┐ ┌────▼────────┐ ┌────────▼────────────────┐
│ FileStorage  │ │  Database   │ │  OllamaContextService   │
│   Service    │ │   Service   │ │                         │
└──────┬───────┘ └────┬────────┘ └────────┬────────────────┘
       │              │                   │
       ▼              ▼                   ▼
┌──────────────┐ ┌────────────┐ ┌──────────────────────────┐
│   Uploads    │ │ SQLite DB  │ │   RAG Context Builder    │
│  (Dateien)   │ │ (Notizen/  │ │  (Semantic + Keyword)    │
│              │ │ Blog-Posts)│ │                          │
└──────────────┘ └────────────┘ └──────────────────────────┘
```

## Neue Services

### 1. Database Service (`database-service.js`)

Verwendet Node.js 22+ eingebautes `node:sqlite` Modul - keine nativen Abhängigkeiten!

**Features:**
- ACID Transaktionen
- Prepared Statements (SQL Injection Schutz)
- Automatische Schema-Migration
- Volltextsuche (LIKE-basiert)
- Foreign Key Constraints

**Tabellen:**

#### Notes
```sql
- id: INTEGER PRIMARY KEY
- user_id: TEXT (Besitzer)
- title: TEXT
- content: TEXT
- tags: JSON
- created_at: DATETIME
- updated_at: DATETIME
```

#### Blog Posts
```sql
- id: INTEGER PRIMARY KEY
- title: TEXT
- content: TEXT
- author: TEXT
- author_display_name: TEXT
- tags: JSON
- is_public: INTEGER (0/1)
- created_at: DATETIME
- updated_at: DATETIME
```

#### Files
```sql
- id: INTEGER PRIMARY KEY
- user_id: TEXT
- original_name: TEXT
- stored_name: TEXT
- file_path: TEXT
- mime_type: TEXT
- file_size: INTEGER
- description: TEXT
- created_at: DATETIME
```

### 2. File Storage Service (`file-storage-service.js`)

Sichere Dateiverwaltung mit umfassender Validierung.

**Sicherheits-Features:**
- MIME-Type Validierung
- Dateigrößen-Beschränkung
- Verbotene Dateiendungen
- Sanitization (Verhindert Path Traversal)
- SHA256 Hash (Duplikat-Erkennung)
- Sichere Dateinamen (Timestamp + Random)

**Unterstützte Dateitypen:**

| Kategorie | MIME-Types | Max Größe |
|-----------|-----------|-----------|
| Dokumente | PDF, DOC, DOCX, TXT, MD | 20-50 MB |
| Bilder | JPEG, PNG, GIF, WebP, SVG | 5-20 MB |
| Audio | MP3, WAV, OGG, M4A | 50-100 MB |
| Video | MP4, WebM, OGG | 500 MB |
| Archive | ZIP | 100 MB |

**Verzeichnisstruktur:**
```
data/uploads/
└── {username}/
    ├── document/
    │   └── 1234567890_a1b2c3d4.pdf
    ├── image/
    │   └── 1234567890_e5f6g7h8.png
    └── text/
        └── 1234567890_i9j0k1l2.md
```

### 3. Ollama Context Service (`ollama-context-service.js`)

RAG (Retrieval-Augmented Generation) Implementation für Ollama.

**Features:**
- Hybrid-Suche (Semantisch + Keyword)
- Relevanz-Scoring
- Kontext-Limits (max 8000 Zeichen)
- Intelligentes Truncating
- Multi-Quellen Support

**Suchmethoden:**

1. **Semantic Search** (bevorzugt)
   - Nutzt ChromaDB + Ollama Embeddings
   - Versteht Bedeutung, nicht nur Keywords
   - Ähnlichkeits-Score (0-1)

2. **Keyword Search** (Fallback)
   - SQLite LIKE-Queries
   - Schnell und deterministisch
   - Relevanz-Score basierend auf Häufigkeit

## API Endpoints

### Dateien

#### POST /api/upload
Datei upload mit Validierung.

**Request:**
```http
POST /api/upload
Content-Type: multipart/form-data
Authorization: Bearer {token}

file: (binary)
description: (optional string)
```

**Response:**
```json
{
  "success": true,
  "file": {
    "id": 1,
    "originalName": "document.pdf",
    "mimeType": "application/pdf",
    "fileSize": 1024567,
    "category": "document",
    "createdAt": "2026-02-07T10:30:00.000Z"
  }
}
```

#### GET /api/files
Liste aller Dateien des Benutzers.

**Response:**
```json
{
  "success": true,
  "files": [
    {
      "id": 1,
      "originalName": "document.pdf",
      "mimeType": "application/pdf",
      "fileSize": 1024567,
      "description": "Projektdokumentation",
      "createdAt": "2026-02-07T10:30:00.000Z"
    }
  ]
}
```

#### GET /api/files/:id/download
Datei herunterladen.

#### DELETE /api/files/:id
Datei löschen.

#### GET /api/files/allowed-types
Liste erlaubter MIME-Types.

### Notizen

#### POST /api/notes
Neue Notiz erstellen.

**Request:**
```json
{
  "title": "Projektideen",
  "content": "Hier sind meine Ideen...",
  "tags": ["ideen", "projekt"]
}
```

**Response:**
```json
{
  "success": true,
  "note": {
    "id": 1,
    "userId": "username",
    "title": "Projektideen",
    "content": "Hier sind meine Ideen...",
    "tags": ["ideen", "projekt"],
    "createdAt": "2026-02-07T10:30:00.000Z",
    "updatedAt": "2026-02-07T10:30:00.000Z"
  }
}
```

#### GET /api/notes
Alle Notizen mit Pagination.

**Query:**
- `limit` (default: 50)
- `offset` (default: 0)

#### GET /api/notes/:id
Einzelne Notiz abrufen.

#### PUT /api/notes/:id
Notiz aktualisieren.

#### DELETE /api/notes/:id
Notiz löschen.

#### GET /api/notes/search
Volltextsuche in Notizen.

**Query:**
- `q` (search query)
- `limit` (default: 20)

### Blog Posts

#### POST /api/posts
Neuen Blog-Post erstellen.

**Request:**
```json
{
  "title": "Mein erster Post",
  "content": "Hier ist der Inhalt...",
  "tags": ["tutorial", "tech"],
  "isPublic": true
}
```

#### GET /api/posts
Alle öffentlichen Blog-Posts.

**Query:**
- `limit` (default: 50)
- `offset` (default: 0)

#### GET /api/posts/:id
Einzelnen Post abrufen.

#### PUT /api/posts/:id
Post aktualisieren (nur Autor).

#### DELETE /api/posts/:id
Post löschen (nur Autor).

#### GET /api/posts/search
Volltextsuche in Blog-Posts.

### Ollama Agent

#### POST /api/query-agent
Kontext für Ollama generieren.

**Request:**
```json
{
  "query": "Was sind meine Projektideen?",
  "options": {
    "searchNotes": true,
    "searchBlogPosts": true,
    "searchFiles": false,
    "searchKnowledge": true,
    "maxResults": 5,
    "contextWeight": "balanced"
  }
}
```

**Response:**
```json
{
  "success": true,
  "query": "Was sind meine Projektideen?",
  "hasContext": true,
  "context": "=== RELEVANT KNOWLEDGE BASE ===\nThe following information...\n\n📝 [Notiz] Projektideen (von username) 🔍 Relevanz: 95%\n\nHier sind meine Ideen...",
  "sourcesSearched": {
    "notes": true,
    "blogPosts": true,
    "files": false,
    "knowledge": true
  }
}
```

**Optionen:**
- `searchNotes`: Notizen durchsuchen (default: true)
- `searchBlogPosts`: Blog-Posts durchsuchen (default: true)
- `searchFiles`: Dateien durchsuchen (default: true)
- `searchKnowledge`: Knowledge-Base durchsuchen (default: true)
- `maxResults`: Max Ergebnisse (default: 5)
- `contextWeight`: Suchmethode - `"semantic"`, `"keyword"`, oder `"balanced"` (default)

#### POST /api/query-agent/quick
Schneller Kontext-Query (vereinfachte Optionen).

### Datenbank-Status

#### GET /api/db/stats
Datenbank-Statistiken.

**Response:**
```json
{
  "success": true,
  "stats": {
    "notes": 42,
    "blogPosts": 15,
    "files": 23,
    "databasePath": "C:/Users/.../data/app.db"
  }
}
```

## Verwendung im Chat

Die RAG-Integration ist automatisch im `/api/chat/generate` Endpoint aktiv:

```javascript
// Beispiel: Chat mit RAG
const response = await fetch('/api/chat/generate', {
  method: 'POST',
  headers: { 
    'Content-Type': 'application/json',
    'Authorization': 'Bearer ' + token
  },
  body: JSON.stringify({
    model: 'llama3.2',
    messages: [
      { role: 'user', text: 'Was weißt du über meine Projektideen?' }
    ],
    useRag: true,  // Aktiviert RAG
    ragOptions: {
      searchNotes: true,
      searchBlogPosts: true,
      maxResults: 5
    }
  })
});
```

## Persistenz

Alle Daten sind persistent:

1. **SQLite Datenbank**: `data/app.db`
   - Notizen
   - Blog-Posts
   - Datei-Metadaten

2. **Datei-Uploads**: `data/uploads/{username}/`
   - Organisiert nach Kategorie
   - Originale Dateinamen in DB gespeichert
   - Sichere Dateinamen für Speicherung

3. **Vector Store**: `data/chroma/`
   - ChromaDB für semantische Suche
   - Ollama Embeddings

## Fehlerbehandlung

Alle Services haben robuste Fehlerbehandlung:

- **Validierung**: Klare Fehlermeldungen bei ungültigen Daten
- **Transaktionen**: Datenintegrität bei Fehlern
- **Logging**: Detaillierte Logs für Debugging
- **Graceful Degradation**: Funktion ohne Vektor-Suche möglich

## Clean Code Prinzipien

1. **Single Responsibility**: Jede Klasse hat einen klaren Zweck
2. **DRY (Don't Repeat Yourself)**: Wiederverwendbare Methoden
3. **KISS (Keep It Simple)**: Klare, einfache APIs
4. **Kommentare**: JSDoc für alle öffentlichen Methoden
5. **Typensicherheit**: Klare Parameter-Validierung
6. **Fehlerbehandlung**: Konsistente Error-Handling

## Starten

```bash
cd backend
npm install
npm start
```

Der Server startet auf Port 3001 (oder PORT aus .env).

Alle Daten werden automatisch in `data/` gespeichert.
