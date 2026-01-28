#!/usr/bin/env python3
"""
Narrativ Filter: fetch crypto news via RSS and filter for nüanced headlines.
Rules:
- Exclude headlines containing buzzwords: Moon, Crash, Prediction (case-insensitive).
- Include articles that contain any of: Regulation, ISO 20022, Smart Contracts, Partnership
"""
try:
    import feedparser  # type: ignore
except Exception:
    feedparser = None
import xml.etree.ElementTree as ET
import re
from urllib.parse import urlparse

# List of RSS feed URLs to aggregate from
FEEDS = [
    'https://cointelegraph.com/rss',
    'https://www.coindesk.com/arc/outboundfeeds/rss',
    'https://cointelegraph.com/rss/coins/bitcoin',
]

# Inclusion terms (must appear in title or summary)
INCLUDE_TERMS = [
    'Regulation', 'ISO 20022', 'Smart Contracts', 'Partnership'
]
# Exclusion buzzwords (skip if any present)
EXCLUDE_BUZZ = ['Moon', 'Crash', 'Prediction']

def contains_any(hay, needles):
    text = (hay or '').lower()
    for n in needles:
        if n.lower() in text:
            return True
    return False

def article_text(entry):
    title = entry.get('title', '') or ''
    summary = entry.get('summary', '') or entry.get('description', '') or ''
    content = ''
    cont = entry.get('content')
    if isinstance(cont, list):
        for c in cont:
            if isinstance(c, dict) and 'value' in c:
                content += str(c['value'])
    return f"{title} {summary} {content}"

def _parse_rss_xml(xml_content):
    items = []
    try:
        root = ET.fromstring(xml_content)
    except Exception:
        return items
    for item in root.findall('.//item'):
        title_el = item.find('title')
        link_el = item.find('link')
        summary_el = item.find('description')
        title = title_el.text if title_el is not None and title_el.text else ''
        link = link_el.text if link_el is not None and link_el.text else ''
        summary = summary_el.text if summary_el is not None and summary_el.text else ''
        items.append({'title': title, 'link': link, 'summary': summary})
    return items

def main():
    for feed in FEEDS:
        try:
            if feedparser:
                d = feedparser.parse(feed)
                entries = d.entries
                entries = [
                    {
                        'title': e.get('title',''),
                        'link': e.get('link',''),
                        'summary': e.get('summary','') or e.get('description','')
                    }
                    for e in entries
                ]
            else:
                import urllib.request
                with urllib.request.urlopen(feed) as resp:
                    xml = resp.read().decode('utf-8')
                entries = _parse_rss_xml(xml)
        except Exception as e:
            print(f"Skip feed {feed}: {e}")
            continue
        for entry in entries:
            txt = article_text(entry)
            # Exclude buzzwords first
            if contains_any(txt, [b.lower() for b in EXCLUDE_BUZZ]):
                continue
            # Include only if any include-terms are present
            if contains_any(txt, INCLUDE_TERMS):
                url = entry.get('link','')
                title = entry.get('title','')
                print(f"{title}\n{url}\n")

if __name__ == '__main__':
    main()
