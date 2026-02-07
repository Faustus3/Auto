# Python WebSearch Integration

## Setup

### 1. Python Dependencies installieren

```bash
cd websearch-service
python -m pip install -r requirements.txt
```

### 2. Testen

```bash
# Test der Python-Bridge
python api_bridge.py --query "KI News 2025" --mode research --max-results 3
```

## Integration im Backend

Das Backend verwendet jetzt automatisch die Python-Version für:

- `/api/search` - Websuche
- `/api/research` - Tiefenrecherche mit Scraping
- Chat mit `useWebSearch: true` - Automatische Websuche

## Architektur

```
Node.js Backend (server.js)
    ↓ (child_process)
Python api_bridge.py
    ↓ (import)
websearch_integrator.py
    ↓ (HTTP requests)
DuckDuckGo & Websites
```

## Features

✅ **DuckDuckGo API** - Kein API-Key nötig  
✅ **Paralleles Scraping** - Async/await für Performance  
✅ **HTML-Bereinigung** - BeautifulSoup statt Regex  
✅ **Smart Truncation** - Kürzt an Satzgrenzen  
✅ **Ollama-Integration** - Direkte Prompt-Generierung  

## API Endpoints

### GET /api/search
```javascript
POST /api/search
{
  "query": "Suchbegriff",
  "numResults": 5
}
```

### POST /api/research
```javascript
POST /api/research
{
  "query": "Recherche-Thema",
  "depth": 3  // Anzahl zu scrapender Seiten
}
```

## Fehlerbehebung

Falls die Python-Suche nicht funktioniert:

1. Prüfe ob Python installiert ist:
   ```bash
   python --version
   ```

2. Prüfe ob Dependencies installiert sind:
   ```bash
   python -c "import duckduckgo_search, aiohttp, bs4; print('OK')"
   ```

3. Manuelles Testen:
   ```bash
   python websearch-service/api_bridge.py --query "test" --mode search
   ```

## Vorteile vs. Alte Node.js Version

| Feature | Alt (Node.js) | Neu (Python) |
|---------|---------------|--------------|
| HTML Parsing | Regex (fehleranfällig) | BeautifulSoup (robust) |
| Content Cleaning | Einfach | Erweitert (Navigation entfernen) |
| Truncation | Hartes Cutoff | Smart (Satzgrenzen) |
| Parallelität | Promise.all | asyncio + Semaphore |
| Ollama Format | Manuell | Automatisch |
