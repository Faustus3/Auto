# WebSearchIntegrator - Python Service

## Überblick

Dieser Python-Service implementiert eine vollständige Websearch-Integration mit Scraping für Ollama. 

**Wichtig:** Dein Backend hat bereits eine Node.js-Implementierung von Websearch/Scraping in `backend/server.js` (Funktionen: `performWebSearch`, `performScrape`, `/api/research`). Diese Python-Version ist eine alternative Implementierung, die bei Bedarf als Microservice genutzt werden kann.

## Features

- **DuckDuckGo Suche** - Kein API-Key nötig
- **Paralleles Scraping** - Async/await für Performance
- **HTML-Bereinigung** - Entfernt Tags, Scripts, Boilerplate
- **Context Management** - Intelligentes Kürzen
- **Ollama-Integration** - Direkte Prompt-Generierung

## Installation

```bash
cd websearch-service
pip install -r requirements.txt
```

## Verwendung

### Als Python-Modul

```python
import asyncio
from websearch_integrator import WebSearchIntegrator

async def main():
    async with WebSearchIntegrator() as integrator:
        # Kompletter Workflow
        result = await integrator.search_and_build_context(
            query="Was ist die aktuelle Zeit in Berlin?",
            max_results=3,
            max_content_length=3000
        )
        
        print(result.combined_context)

asyncio.run(main())
```

### Mit Ollama-Integration

```python
from websearch_integrator import OllamaIntegration

async with OllamaIntegration() as ollama:
    # Baut Messages für Ollama API
    request_data = await ollama.query_with_web_context(
        user_query="Was sind News zu KI?",
        model="llama3.2",
        max_search_results=3
    )
    
    # request_data enthält:
    # - model: Modell-Name
    # - messages: System + User Messages
    # - web_context: Rohe Scraping-Daten
    # - options: Temperature, etc.
```

### Als Microservice (Flask/FastAPI)

```python
from fastapi import FastAPI
from websearch_integrator import WebSearchIntegrator

app = FastAPI()
integrator = WebSearchIntegrator()

@app.post("/search")
async def search_endpoint(query: str, max_results: int = 5):
    result = await integrator.search_and_build_context(query, max_results)
    return {
        "query": result.query,
        "context": result.combined_context,
        "sources": result.total_sources,
        "successful": result.successful_scrapes
    }
```

## API-Referenz

### WebSearchIntegrator

#### `search(query, max_results=5, region="de-de")`
Führt DuckDuckGo-Suche durch.

#### `scrape_results(results)` 
Scraped URLs parallel.

#### `build_context(query, results)`
Baut formatierten Kontext.

#### `search_and_build_context(query, max_results=5, max_content_length=4000)`
Kompletter Workflow.

### OllamaIntegration

#### `query_with_web_context(user_query, model="llama3.2", max_search_results=3)`
Generiert vollständigen Ollama-Request mit Web-Kontext.

## Konfiguration

```python
integrator = WebSearchIntegrator(
    max_concurrent_requests=3,  # Parallele Scrapes
    request_timeout=10,         # Timeout in Sekunden
    max_content_length=4000,    # Max Zeichen pro URL
    user_agent="Mozilla/5.0..." # Custom User-Agent
)
```

## Vergleich mit Node.js-Implementierung

| Feature | Node.js (vorhanden) | Python (diese) |
|---------|---------------------|----------------|
| Suche | DuckDuckGo HTML | DuckDuckGo API |
| Scraping | node-fetch + Regex | aiohttp + BeautifulSoup |
| Cleaning | Regex-basiert | HTML Parser |
| Async | Promise.all | asyncio.gather |
| Context | Einfach | Smart Truncation |

**Empfehlung:** Nutze die Node.js-Version, da sie bereits integriert ist. Diese Python-Version bietet bessere HTML-Parsing-Fähigkeiten.

## Demo ausführen

```bash
python websearch_integrator.py
```

## Hinweise

- Respektiere robots.txt der Ziel-Websites
- Rate-Limiting beachten (max_concurrent_requests)
- Nicht für massives Scraping geeignet
- Einige Websites blockieren automatisierte Requests
