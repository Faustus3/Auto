# Director's Script Engine

Eine umfassende Drehbuch-Entwicklungsumgebung mit KI-gestützter Unterstützung und RAG-Integration.

## Features

### 🎬 Script Editor
- Professioneller Drehbuch-Editor mit Standard-Formatierung
- Auto-Save für kontinuierliche Datensicherung
- Export-Funktion für fertige Arbeiten

### 👥 Character Bible
- Dynamische Charakter-Karten mit detaillierten Profilen
- Charakter-Erstellung via KI-Assistent
- Semantische Charakter-Suche mit RAG
- Charakter-konsistente Dialog-Generierung

### 🧠 KI-Assistent (Dramaturg)
- Ollama-Integration für lokale KI-Modelle
- Szene-Analyse mit Pacing- und Spannungsbogen-Check
- Dialog-Konsistenz-Prüfung
- Auto-Continue für Schreibblockaden
- Konfigurierbare Ollama-URL für Flexibilität

### 🔍 RAG-Integration (Retrieval-Augmented Generation)
- **Charakter-basierte RAG**: Dialog-Generierung basierend auf Charakter-Profilen
- **Semantische Suche**: Findet relevante Charaktere basierend auf Kontext
- **Erweiterte Analysen**: Szenen-Analyse mit Charakter-Kontext
- **Chroma DB**: Lokale Vektordatenbank für schnelle semantische Suche

### 📚 Knowledge Base
- Upload-Funktion für Referenz-Materialien
- Unterstützung für JSON, TXT, DOC, DOCX
- Automatische Konvertierung in strukturierte Daten
- Import von Charakteren, Orten und Hintergründen

## Installation

### Voraussetzungen
- Node.js 18+
- Ollama (für KI-Funktionen)
- Chroma DB (für RAG-Features)

### Setup

1. **Abhängigkeiten installieren**:
```bash
npm install chromadb @xenova/transformers pdf-parse mammoth uuid
```

2. **Chroma DB einrichten**:
```bash
mkdir -p ./data/chroma
```

3. **Ollama starten**:
```bash
ollama serve
ollama pull llama3.2
```

4. **App starten**:
Öffnen Sie `directors-script-engine.html` in einem modernen Browser.

## Verwendung

### Grundlagen
1. **Charaktere erstellen**: Klicken Sie auf "Neuer Charakter" in der linken Spalte
2. **Skript schreiben**: Nutzen Sie den mittleren Bereich für Ihr Drehbuch
3. **KI-Assistent nutzen**: Verwenden Sie die rechte Spalte für Analysen und Vorschläge

### KI-Funktionen
- **Szene analysieren**: Lässt die KI die aktuelle Szene auf Pacing und Spannungsbogen prüfen
- **Dialog-Check**: Überprüft die Konsistenz der Dialoge mit den Charakter-Profilen
- **Weiterschreiben**: Generiert die nächsten 5-10 Zeilen basierend auf dem aktuellen Kontext

### RAG-Features
Die RAG-Integration wird automatisch beim Laden der Seite initialisiert:
- Charaktere werden automatisch in der Vektordatenbank indexiert
- Semantische Suche findet relevante Charaktere basierend auf Kontext
- Dialog-Generierung berücksichtigt Charakter-Profile für Konsistenz

### Daten-Management
- **Auto-Save**: Alle Änderungen werden automatisch gespeichert
- **Export**: Speichern Sie Ihre Arbeit als JSON-Datei
- **Import**: Laden Sie zuvor exportierte Arbeiten oder Knowledge Base-Dateien

## Konfiguration

### Ollama URL
Standardmäßig verwendet die App `http://localhost:11434/api/generate`. Sie können die URL im Eingabefeld oben rechts ändern.

### CORS-Einstellungen
Falls Sie die App über HTTPS hosten, müssen Sie Ollama mit CORS-Unterstützung starten:
```bash
OLLAMA_ORIGINS=https://ihredomain.de ollama serve
```

## Dokumentation

### RAG-Implementierung
- `rag-research.md`: Umfassende Research zu RAG-Technologien
- `rag-implementation-plan.md`: Detaillierter 8-Wochen-Plan für RAG-Integration
- `tech-stack-evaluation.md`: Technologie-Auswahl und Bewertung
- `phase2-setup-guide.md`: Praktischer Setup-Guide für RAG-Implementierung

### Architektur
- **Frontend**: Reines HTML/CSS/JavaScript (Vanilla JS)
- **Datenpersistenz**: IndexedDB für lokale Speicherung
- **KI-Integration**: Ollama API für lokale Sprachmodelle
- **Vektordatenbank**: Chroma DB für semantische Suche

## Entwicklung

### Projektstruktur
```
directors-script-engine.html    # Hauptanwendung
rag/
├── services/                   # RAG Services
├── config/                     # Konfiguration
├── utils/                      # Hilfsfunktionen
└── tests/                      # Tests
data/
└── chroma/                     # Chroma DB Speicher
```

### Nächste Schritte
1. **Phase 3**: Vollständige Charakter-basierte RAG
2. **Phase 4**: Plot- und Szenen-RAG
3. **Phase 5**: Referenz-Material-RAG
4. **Phase 6**: UI-Integration und Optimierung

## Lizenz

Dieses Projekt steht unter der MIT Lizenz.

## Support

Bei Fragen oder Problemen:
1. Stellen Sie sicher, dass Ollama läuft
2. Überprüfen Sie die Browser-Konsole auf Fehler
3. Prüfen Sie die CORS-Einstellungen für HTTPS

---

**Hinweis**: Diese App ist für die lokale Entwicklung konzipiert. Für Produktions-Einsatz empfehlen wir die Verwendung von Cloud-basierten Vektordatenbanken (z.B. Pinecone) und OpenAI Embeddings.