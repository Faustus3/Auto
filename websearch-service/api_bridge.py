#!/usr/bin/env python3
"""
API Bridge für Node.js Integration
==================================

Dieses Skript dient als Brücke zwischen dem Node.js Backend und dem
Python WebSearchIntegrator. Es kann als CLI-Tool aufgerufen werden.

Verwendung:
    python api_bridge.py --query "Suchbegriff" --max-results 3
    
Output:
    JSON-String mit Kontext für Ollama
"""

import asyncio
import json
import argparse
import sys
from websearch_integrator import WebSearchIntegrator, OllamaIntegration


async def search_only(query: str, max_results: int = 5):
    """Nur Suche, kein Scraping"""
    async with WebSearchIntegrator() as integrator:
        results = await integrator.search(query, max_results)
        return {
            "query": query,
            "results": [
                {
                    "title": r.title,
                    "url": r.url,
                    "snippet": r.snippet
                }
                for r in results
            ]
        }


async def full_research(query: str, max_results: int = 3, max_content_length: int = 3000):
    """Komplette Suche + Scraping"""
    async with WebSearchIntegrator() as integrator:
        result = await integrator.search_and_build_context(
            query=query,
            max_results=max_results,
            max_content_length=max_content_length
        )
        
        return {
            "query": result.query,
            "context": result.combined_context,
            "sources": {
                "total": result.total_sources,
                "successful": result.successful_scrapes,
                "failed": result.failed_scrapes
            },
            "results": [
                {
                    "title": r.title,
                    "url": r.url,
                    "snippet": r.snippet,
                    "content": r.content if r.scrape_success else None,
                    "success": r.scrape_success,
                    "error": r.scrape_error
                }
                for r in result.results
            ]
        }


async def ollama_context(query: str, model: str = "llama3.2", max_results: int = 3):
    """Generiert Ollama-kompatiblen Request"""
    async with OllamaIntegration() as ollama:
        request_data = await ollama.query_with_web_context(
            user_query=query,
            model=model,
            max_search_results=max_results
        )
        
        return {
            "ollama_request": {
                "model": request_data["model"],
                "messages": request_data["messages"],
                "stream": request_data["stream"],
                "options": request_data["options"]
            },
            "web_context": {
                "query": request_data["web_context"].query,
                "sources": request_data["web_context"].total_sources,
                "successful_scrapes": request_data["web_context"].successful_scrapes
            }
        }


def main():
    parser = argparse.ArgumentParser(
        description="WebSearch API Bridge für Node.js Integration"
    )
    parser.add_argument(
        "--query", "-q",
        required=True,
        help="Suchbegriff"
    )
    parser.add_argument(
        "--mode", "-m",
        choices=["search", "research", "ollama"],
        default="research",
        help="Modus: search (nur Suche), research (Suche+Scraping), ollama (Ollama-Format)"
    )
    parser.add_argument(
        "--max-results", "-n",
        type=int,
        default=3,
        help="Maximale Anzahl Ergebnisse (default: 3)"
    )
    parser.add_argument(
        "--max-content-length", "-l",
        type=int,
        default=3000,
        help="Maximale Content-Länge pro URL (default: 3000)"
    )
    parser.add_argument(
        "--model",
        default="llama3.2",
        help="Ollama Modell (nur für ollama Modus, default: llama3.2)"
    )
    
    args = parser.parse_args()
    
    result = None
    try:
        if args.mode == "search":
            result = asyncio.run(search_only(args.query, args.max_results))
        elif args.mode == "research":
            result = asyncio.run(full_research(
                args.query, 
                args.max_results, 
                args.max_content_length
            ))
        elif args.mode == "ollama":
            result = asyncio.run(ollama_context(
                args.query, 
                args.model, 
                args.max_results
            ))
        
        # JSON Output
        if result:
            print(json.dumps(result, ensure_ascii=False, indent=2))
        else:
            raise ValueError("No result generated")
        
    except Exception as e:
        error_result = {
            "error": str(e),
            "query": args.query
        }
        print(json.dumps(error_result, ensure_ascii=False), file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
