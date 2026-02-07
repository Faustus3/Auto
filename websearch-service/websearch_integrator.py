#!/usr/bin/env python3
"""
WebSearchIntegrator - Python Websearch & Scraping Service
===========================================================

Dieses Modul implementiert eine vollständige Websearch-Integration mit Scraping
für Ollama. Es führt Websuchen durch, scraped den Content von Ergebnissen,
bereinigt den Text und formatiert alles als Kontext für LLM-Prompts.

Features:
- DuckDuckGo Websuche (kein API-Key nötig)
- Paralleles/async Scraping mehrerer URLs
- HTML-Bereinigung (Tags, Scripts, Boilerplate entfernen)
- Context Window Management (Chunking/Trimming)
- Quellenangaben für jede Information

Verwendung:
    integrator = WebSearchIntegrator()
    context = await integrator.search_and_build_context(
        query="Was ist die aktuelle Zeit in Berlin?",
        max_results=5,
        max_content_length=2000
    )
"""

import asyncio
import re
import json
import hashlib
from typing import List, Dict, Optional, Any
from dataclasses import dataclass, field
from urllib.parse import urljoin, urlparse
from datetime import datetime
import logging

# Für die Websuche
try:
    from duckduckgo_search import DDGS
except ImportError:
    DDGS = None
    print("Warnung: duckduckgo-search nicht installiert. Bitte: pip install duckduckgo-search")

# Für async HTTP Requests
try:
    import aiohttp
    from aiohttp import ClientTimeout, ClientError
except ImportError:
    aiohttp = None
    print("Warnung: aiohttp nicht installiert. Bitte: pip install aiohttp")

# Für HTML Parsing
try:
    from bs4 import BeautifulSoup
except ImportError:
    BeautifulSoup = None
    print("Warnung: beautifulsoup4 nicht installiert. Bitte: pip install beautifulsoup4")

# Logging konfigurieren
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger('WebSearchIntegrator')


@dataclass
class SearchResult:
    """Repräsentiert ein einzelnes Suchergebnis"""
    title: str
    url: str
    snippet: str = ""
    content: str = ""
    content_length: int = 0
    scrape_success: bool = False
    scrape_error: Optional[str] = None
    timestamp: str = field(default_factory=lambda: datetime.now().isoformat())


@dataclass
class WebSearchContext:
    """Der finale Kontext für Ollama"""
    query: str
    results: List[SearchResult]
    combined_context: str
    total_sources: int
    successful_scrapes: int
    failed_scrapes: int
    timestamp: str = field(default_factory=lambda: datetime.now().isoformat())


class WebSearchIntegrator:
    """
    Hauptklasse für Websearch-Integration mit Scraping.
    
    Diese Klasse orchestriert den gesamten Workflow:
    1. Websuche durchführen
    2. Top-N URLs parallel scrapen
    3. Content bereinigen
    4. Kontext für Ollama formatieren
    """
    
    def __init__(
        self,
        max_concurrent_requests: int = 3,
        request_timeout: int = 10,
        max_content_length: int = 4000,
        user_agent: str = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
    ):
        """
        Initialisiert den WebSearchIntegrator.
        
        Args:
            max_concurrent_requests: Maximale parallele Scraping-Anfragen
            request_timeout: Timeout pro Request in Sekunden
            max_content_length: Maximale Länge pro gescrapeten Content
            user_agent: User-Agent für HTTP Requests
        """
        self.max_concurrent_requests = max_concurrent_requests
        self.request_timeout = request_timeout
        self.max_content_length = max_content_length
        self.user_agent = user_agent
        
        # Semaphore für Limitierung paralleler Requests
        self.semaphore = asyncio.Semaphore(max_concurrent_requests)
        
        # Session wird lazy initialisiert
        self.session: Optional[aiohttp.ClientSession] = None
        
        logger.info(f"WebSearchIntegrator initialisiert (max_concurrent={max_concurrent_requests})")
    
    async def _get_session(self) -> aiohttp.ClientSession:
        """Gibt eine aiohttp Session zurück (lazy initialization)"""
        if self.session is None or self.session.closed:
            timeout = ClientTimeout(total=self.request_timeout)
            headers = {
                'User-Agent': self.user_agent,
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'de-DE,de;q=0.9,en-US;q=0.8,en;q=0.7',
                'Accept-Encoding': 'gzip, deflate, br',
                'DNT': '1',
                'Connection': 'keep-alive',
            }
            self.session = aiohttp.ClientSession(
                timeout=timeout,
                headers=headers
            )
        return self.session
    
    async def search(
        self,
        query: str,
        max_results: int = 5,
        region: str = "de-de"
    ) -> List[SearchResult]:
        """
        Führt eine DuckDuckGo-Suche durch.
        
        Args:
            query: Suchbegriff
            max_results: Maximale Anzahl Ergebnisse
            region: Region für Suche (z.B. 'de-de', 'us-en')
            
        Returns:
            Liste von SearchResult-Objekten (noch ohne Content)
        """
        if DDGS is None:
            raise ImportError("duckduckgo-search ist nicht installiert")
        
        logger.info(f"Starte Websuche für: '{query}'")
        
        try:
            with DDGS() as ddgs:
                results = []
                for r in ddgs.text(
                    query,
                    region=region,
                    safesearch='off',
                    max_results=max_results
                ):
                    results.append(SearchResult(
                        title=r.get('title', ''),
                        url=r.get('href', ''),
                        snippet=r.get('body', '')
                    ))
                
                logger.info(f"Suche ergab {len(results)} Ergebnisse")
                return results
                
        except Exception as e:
            logger.error(f"Fehler bei der Websuche: {e}")
            raise
    
    async def _scrape_url(self, url: str) -> SearchResult:
        """
        Scraped eine einzelne URL und extrahiert den Content.
        
        Args:
            url: Ziel-URL
            
        Returns:
            SearchResult mit extrahiertem Content
        """
        async with self.semaphore:
            result = SearchResult(title="", url=url)
            
            try:
                session = await self._get_session()
                
                logger.debug(f"Scrape: {url}")
                
                async with session.get(url, allow_redirects=True) as response:
                    if response.status != 200:
                        result.scrape_error = f"HTTP {response.status}"
                        return result
                    
                    # Content-Type prüfen
                    content_type = response.headers.get('Content-Type', '').lower()
                    if 'text/html' not in content_type:
                        result.scrape_error = f"Nicht-HTML Content: {content_type}"
                        return result
                    
                    html = await response.text()
                    
            except asyncio.TimeoutError:
                result.scrape_error = "Timeout"
                logger.warning(f"Timeout beim Scraping: {url}")
                return result
            except ClientError as e:
                result.scrape_error = f"Connection Error: {str(e)}"
                logger.warning(f"Connection Error: {url} - {e}")
                return result
            except Exception as e:
                result.scrape_error = f"Error: {str(e)}"
                logger.error(f"Fehler beim Scraping {url}: {e}")
                return result
        
        # HTML parsen und bereinigen
        try:
            if BeautifulSoup is None:
                result.scrape_error = "BeautifulSoup nicht installiert"
                return result
            
            cleaned_text = self._clean_html(html, url)
            
            # Länge limitieren
            if len(cleaned_text) > self.max_content_length:
                cleaned_text = self._smart_truncate(
                    cleaned_text, 
                    self.max_content_length
                )
            
            result.content = cleaned_text
            result.content_length = len(cleaned_text)
            result.scrape_success = True
            
            # Title aus HTML extrahieren falls noch nicht gesetzt
            if not result.title:
                soup = BeautifulSoup(html, 'html.parser')
                title_tag = soup.find('title')
                if title_tag:
                    result.title = title_tag.get_text(strip=True)
            
            logger.debug(f"Erfolgreich gescraped: {url} ({len(cleaned_text)} chars)")
            
        except Exception as e:
            result.scrape_error = f"Parsing Error: {str(e)}"
            logger.error(f"Parsing-Fehler bei {url}: {e}")
        
        return result
    
    def _clean_html(self, html: str, base_url: str) -> str:
        """
        Bereinigt HTML und extrahiert den Haupt-Content.
        
        Args:
            html: Rohes HTML
            base_url: Basis-URL für relative Links
            
        Returns:
            Bereinigter Text
        """
        soup = BeautifulSoup(html, 'html.parser')
        
        # Unnötige Elemente entfernen
        for element in soup.find_all(['script', 'style', 'nav', 'footer', 
                                       'header', 'aside', 'advertisement',
                                       'iframe', 'noscript']):
            element.decompose()
        
        # Kommentare entfernen
        for comment in soup.find_all(string=lambda text: isinstance(text, str) 
                                     and text.strip().startswith('<!--')):
            comment.extract()
        
        # Haupt-Content finden (verschiedene Strategien)
        main_content = None
        
        # Strategie 1: Suche nach main/article/content Tags
        for tag in ['main', 'article', '[role="main"]']:
            main_content = soup.find(tag)
            if main_content:
                break
        
        # Strategie 2: Suche nach div mit content-Klasse
        if not main_content:
            for class_name in ['content', 'main-content', 'post-content', 
                              'article-content', 'entry-content']:
                main_content = soup.find('div', class_=lambda x: x and class_name in x.lower())
                if main_content:
                    break
        
        # Strategie 3: Body als Fallback
        if not main_content:
            main_content = soup.find('body') or soup
        
        # Text extrahieren
        text = main_content.get_text(separator='\n', strip=True)
        
        # Bereinigung
        text = self._clean_text(text)
        
        return text
    
    def _clean_text(self, text: str) -> str:
        """
        Bereinigt extrahierten Text.
        
        Args:
            text: Roher Text
            
        Returns:
            Bereinigter Text
        """
        # Mehrfache Leerzeilen entfernen
        text = re.sub(r'\n\s*\n\s*\n+', '\n\n', text)
        
        # Mehrfache Leerzeichen entfernen
        text = re.sub(r' +', ' ', text)
        
        # Whitespace am Anfang/Ende entfernen
        text = text.strip()
        
        # Lange Linien (oft Navigation) reduzieren
        lines = []
        for line in text.split('\n'):
            line = line.strip()
            # Sehr kurze Zeilen (oft Links) überspringen
            if len(line) < 3:
                continue
            # Sehr lange Zeilen ohne Sinn (oft Navigation)
            if len(line) > 200 and line.count(' ') < 5:
                continue
            lines.append(line)
        
        return '\n'.join(lines)
    
    def _smart_truncate(self, text: str, max_length: int) -> str:
        """
        Kürzt Text intelligent an Satzgrenzen.
        
        Args:
            text: Zu kürzender Text
            max_length: Maximale Länge
            
        Returns:
            Gekürzter Text
        """
        if len(text) <= max_length:
            return text
        
        # Suche nach Satzende nahe dem Limit
        truncate_at = max_length
        for i in range(max_length - 1, max_length - 200, -1):
            if i < 0:
                break
            if text[i] in '.!?' and i + 1 < len(text) and text[i + 1] in ' \n':
                truncate_at = i + 1
                break
        
        truncated = text[:truncate_at].strip()
        return f"{truncated}\n\n[... Content gekürzt ...]"
    
    async def scrape_results(
        self,
        results: List[SearchResult]
    ) -> List[SearchResult]:
        """
        Scraped alle URLs aus den Suchergebnissen parallel.
        
        Args:
            results: Liste von SearchResult-Objekten
            
        Returns:
            Liste mit gescrapeten Inhalten
        """
        logger.info(f"Starte paralleles Scraping von {len(results)} URLs")
        
        # Parallel scraping
        tasks = [self._scrape_url(result.url) for result in results]
        scraped_results = await asyncio.gather(*tasks, return_exceptions=True)
        
        # Ergebnisse zusammenführen (Title und Snippet aus Original beibehalten)
        final_results = []
        for original, scraped in zip(results, scraped_results):
            if isinstance(scraped, Exception):
                logger.error(f"Exception beim Scraping {original.url}: {scraped}")
                original.scrape_error = str(scraped)
                final_results.append(original)
            else:
                # Metadaten vom Original übernehmen
                scraped.title = original.title or scraped.title
                scraped.snippet = original.snippet
                final_results.append(scraped)
        
        successful = sum(1 for r in final_results if r.scrape_success)
        logger.info(f"Scraping abgeschlossen: {successful}/{len(final_results)} erfolgreich")
        
        return final_results
    
    def build_context(
        self,
        query: str,
        results: List[SearchResult],
        include_failed: bool = False
    ) -> str:
        """
        Baut den finalen Kontext-String für Ollama.
        
        Args:
            query: Ursprüngliche Suchanfrage
            results: Liste der Suchergebnisse mit Content
            include_failed: Auch fehlgeschlagene Scrapes auflisten
            
        Returns:
            Formatierter Kontext-String
        """
        context_parts = []
        
        # Header
        context_parts.append("=" * 60)
        context_parts.append("WEB RESEARCH CONTEXT")
        context_parts.append("=" * 60)
        context_parts.append(f"Suchanfrage: {query}")
        context_parts.append(f"Zeitstempel: {datetime.now().isoformat()}")
        context_parts.append("")
        
        # Erfolgreiche Scrapes
        successful_results = [r for r in results if r.scrape_success]
        
        if successful_results:
            context_parts.append(f"Gefundene Quellen ({len(successful_results)}):")
            context_parts.append("-" * 60)
            context_parts.append("")
            
            for i, result in enumerate(successful_results, 1):
                context_parts.append(f"[{i}] {result.title}")
                context_parts.append(f"    URL: {result.url}")
                context_parts.append(f"    Länge: {result.content_length} Zeichen")
                context_parts.append("")
                context_parts.append(result.content)
                context_parts.append("")
                context_parts.append("-" * 60)
                context_parts.append("")
        
        # Fehlgeschlagene Scrapes (optional)
        if include_failed:
            failed_results = [r for r in results if not r.scrape_success]
            if failed_results:
                context_parts.append("Nicht verfügbare Quellen:")
                for result in failed_results:
                    context_parts.append(f"  - {result.url}: {result.scrape_error}")
                context_parts.append("")
        
        # Footer mit Hinweis
        context_parts.append("=" * 60)
        context_parts.append("ENDE WEB RESEARCH CONTEXT")
        context_parts.append("=" * 60)
        context_parts.append("")
        context_parts.append("Nutze die oben genannten Informationen, um die Frage zu beantworten.")
        context_parts.append("Zitiere relevante Quellen mit ihrer Nummer [1], [2], etc.")
        
        return "\n".join(context_parts)
    
    async def search_and_build_context(
        self,
        query: str,
        max_results: int = 5,
        max_content_length: Optional[int] = None
    ) -> WebSearchContext:
        """
        Kompletter Workflow: Suche → Scraping → Kontext-Building.
        
        Dies ist die Haupt-Methode für den gesamten Prozess.
        
        Args:
            query: Suchbegriff
            max_results: Anzahl der zu scrapenden Ergebnisse
            max_content_length: Maximale Content-Länge pro URL
            
        Returns:
            WebSearchContext mit allen Informationen
        """
        if max_content_length:
            self.max_content_length = max_content_length
        
        try:
            # 1. Suche durchführen
            search_results = await self.search(query, max_results)
            
            if not search_results:
                logger.warning("Keine Suchergebnisse gefunden")
                return WebSearchContext(
                    query=query,
                    results=[],
                    combined_context="Keine Suchergebnisse gefunden.",
                    total_sources=0,
                    successful_scrapes=0,
                    failed_scrapes=0
                )
            
            # 2. URLs scrapen
            scraped_results = await self.scrape_results(search_results)
            
            # 3. Kontext bauen
            context = self.build_context(query, scraped_results)
            
            # Statistiken
            successful = sum(1 for r in scraped_results if r.scrape_success)
            failed = len(scraped_results) - successful
            
            return WebSearchContext(
                query=query,
                results=scraped_results,
                combined_context=context,
                total_sources=len(scraped_results),
                successful_scrapes=successful,
                failed_scrapes=failed
            )
            
        except Exception as e:
            logger.error(f"Fehler im Workflow: {e}")
            raise
    
    async def close(self):
        """Schließt alle Verbindungen gracefully"""
        if self.session and not self.session.closed:
            await self.session.close()
            logger.info("Session geschlossen")
    
    async def __aenter__(self):
        """Async Context Manager Entry"""
        return self
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """Async Context Manager Exit"""
        await self.close()


class OllamaIntegration:
    """
    Integration mit Ollama für direkte Prompt-Generierung.
    
    Diese Klasse nutzt WebSearchIntegrator und formatiert
    den Output direkt für Ollama-API-Requests.
    """
    
    def __init__(self, ollama_base_url: str = "http://localhost:11434"):
        self.ollama_base_url = ollama_base_url
        self.integrator = WebSearchIntegrator()
    
    async def query_with_web_context(
        self,
        user_query: str,
        model: str = "llama3.2",
        max_search_results: int = 3,
        system_prompt: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Führt eine Ollama-Query mit Web-Kontext durch.
        
        Args:
            user_query: Benutzerfrage
            model: Ollama Model-Name
            max_search_results: Anzahl zu scrapender Quellen
            system_prompt: Optionaler System-Prompt
            
        Returns:
            Dictionary mit Query, Context und vorbereiteten Messages
        """
        # Web-Kontext holen
        context_result = await self.integrator.search_and_build_context(
            query=user_query,
            max_results=max_search_results
        )
        
        # Messages für Ollama bauen
        messages = []
        
        # System Prompt mit Kontext
        if system_prompt:
            system_content = f"{system_prompt}\n\n{context_result.combined_context}"
        else:
            system_content = f"""Du bist ein hilfreicher Assistent mit Zugang zu aktuellen Web-Informationen.

{context_result.combined_context}

Beantworte die Frage des Nutzers basierend auf den oben bereitgestellten Web-Quellen. 
Zitiere Quellen mit [1], [2], etc. wenn du Informationen aus ihnen verwendest.
Wenn die Quellen keine relevanten Informationen enthalten, sage dies ehrlich."""
        
        messages.append({
            "role": "system",
            "content": system_content
        })
        
        # User Query
        messages.append({
            "role": "user",
            "content": user_query
        })
        
        return {
            "model": model,
            "messages": messages,
            "web_context": context_result,
            "stream": False,
            "options": {
                "temperature": 0.7,
                "num_predict": 2048
            }
        }
    
    async def close(self):
        """Cleanup"""
        await self.integrator.close()
    
    async def __aenter__(self):
        """Async Context Manager Entry"""
        return self
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """Async Context Manager Exit"""
        await self.close()


# Beispiel-Verwendung
async def main():
    """Demo der WebSearchIntegrator-Funktionalität"""
    
    print("=" * 70)
    print("WebSearchIntegrator Demo")
    print("=" * 70)
    print()
    
    # Beispiel-Query
    query = "Was sind die aktuellen Entwicklungen bei KI im Jahr 2025?"
    
    print(f"Suchanfrage: {query}")
    print()
    
    async with WebSearchIntegrator(max_concurrent_requests=3) as integrator:
        # Kompletten Workflow ausführen
        result = await integrator.search_and_build_context(
            query=query,
            max_results=3,
            max_content_length=3000
        )
        
        print(f"Gesamt-Quellen: {result.total_sources}")
        print(f"Erfolgreiche Scrapes: {result.successful_scrapes}")
        print(f"Fehlgeschlagene Scrapes: {result.failed_scrapes}")
        print()
        
        # Details der einzelnen Ergebnisse
        for i, res in enumerate(result.results, 1):
            print(f"[{i}] {res.title}")
            print(f"    URL: {res.url}")
            print(f"    Status: {'✓' if res.scrape_success else '✗'} {res.scrape_error or ''}")
            if res.scrape_success:
                print(f"    Content-Länge: {res.content_length} Zeichen")
            print()
        
        # Kontext ausgeben (gekürzt)
        print("=" * 70)
        print("GENERIERTER KONTEXT (erste 2000 Zeichen):")
        print("=" * 70)
        print(result.combined_context[:2000])
        print("...")
        print()
        
        # Ollama-Integration Demo
        print("=" * 70)
        print("OLLAMA INTEGRATION:")
        print("=" * 70)
        
        ollama = OllamaIntegration()
        ollama_result = await ollama.query_with_web_context(
            user_query=query,
            max_search_results=2
        )
        
        print(f"Model: {ollama_result['model']}")
        print(f"Messages: {len(ollama_result['messages'])}")
        print()
        print("System-Prompt (gekürzt):")
        print(ollama_result['messages'][0]['content'][:500] + "...")


if __name__ == "__main__":
    # Dependencies check
    missing = []
    if DDGS is None:
        missing.append("duckduckgo-search")
    if aiohttp is None:
        missing.append("aiohttp")
    if BeautifulSoup is None:
        missing.append("beautifulsoup4")
    
    if missing:
        print("Fehlende Dependencies:")
        print(f"  pip install {' '.join(missing)}")
        print()
    
    # Demo ausführen
    asyncio.run(main())
