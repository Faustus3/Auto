# RAG (Retrieval-Augmented Generation) Research

## Was ist RAG?

Retrieval-Augmented Generation (RAG) ist eine Technik, die das Beste aus zwei Welten kombiniert:
- **Retrieval**: Das Abrufen relevanter Informationen aus einer Wissensdatenbank
- **Generation**: Das Erzeugen von Text durch ein Sprachmodell

### Funktionsweise

1. **Frage/Aufforderung empfangen**: Der Benutzer stellt eine Frage oder gibt einen Prompt
2. **Dokumente abrufen**: Das System sucht in einer Wissensdatenbank nach relevanten Dokumenten
3. **Kontext erweitern**: Die abgerufenen Dokumente werden zum ursprünglichen Prompt hinzugefügt
4. **Antwort generieren**: Das Sprachmodell generiert eine Antwort basierend auf dem erweiterten Kontext

### Vorteile von RAG

- **Aktualität**: Kann mit aktuellen Informationen arbeiten, die nach dem Training des Modells veröffentlicht wurden
- **Faktizität**: Reduziert Halluzinationen, da Antworten auf tatsächlichen Dokumenten basieren
- **Nachvollziehbarkeit**: Quellen können angegeben und überprüft werden
- **Spezialisierung**: Kann auf domänenspezifische Dokumente zugreifen
- **Kosteneffizienz**: Keine erneute Feinabstimmung des Modells erforderlich

## Anwendungsfälle für RAG

### 1. Frage-Antwort-Systeme
- Kundensupport mit Produktdokumentation
- Wissensdatenbanken für Unternehmen
- Akademische Recherche-Tools

### 2. Content-Generierung
- Artikel-Schreiben mit Quellen
- Code-Generierung mit Dokumentation
- Berichterstellung basierend auf Daten

### 3. Spezialisierte Assistenten
- Medizinische Diagnose-Unterstützung
- Juristische Dokumentenanalyse
- Technischer Support

### 4. Kreative Anwendungen
- Drehbuch-Schreiben mit Charakter- und Plot-Referenzen
- Story-Entwicklung mit Hintergrundwissen
- Dialog-Generierung mit Charakterprofilen

## RAG-Architektur

### Komponenten

1. **Dokumenten-Index**
   - Vektordatenbank (z.B. Pinecone, Weaviate, FAISS)
   - Volltext-Suche (Elasticsearch)
   - Hybrid-Ansätze

2. **Embedding-Modelle**
   - Text-Embeddings (Sentence-BERT, OpenAI embeddings)
   - Multimodale Embeddings
   - Domänenspezifische Modelle

3. **Retriever**
   - Dense Retrieval (semantische Suche)
   - Sparse Retrieval (Keyword-basiert)
   - Hybride Ansätze

4. **Generator**
   - Große Sprachmodelle (GPT-4, Llama, Claude)
   - Feinabgestimmte Modelle
   - Spezialisierte Modelle

### Workflow

```
Benutzerfrage → Embedding → Vektorsuche → Top-K Dokumente → Prompt-Konstruktion → LLM → Antwort
```

## Best Practices für RAG-Implementierungen

### 1. Dokumenten-Vorverarbeitung
- **Chunking**: Dokumente in sinnvolle Abschnitte aufteilen
  - Fixed-size chunks
  - Sentence-aware splitting
  - Hierarchical chunking
- **Bereinigung**: HTML-Tags, Formatierung, Rauschen entfernen
- **Metadaten**: Strukturierte Informationen extrahieren

### 2. Retrieval-Optimierung
- **Query Expansion**: Synonyme, verwandte Begriffe hinzufügen
- **Query Transformation**: Frage umformulieren für bessere Ergebnisse
- **Re-Ranking**: Ergebnisse nach Relevanz sortieren
- **Hybrid Search**: Kombination aus semantischer und keyword-basierter Suche

### 3. Prompt-Engineering
- **Kontext-Platzierung**: Wichtige Informationen an den Anfang stellen
- **Formatierung**: Klare Struktur für das Modell
- **Instruktionen**: Explizite Anweisungen für die Antwort-Generierung
- **Beispiele**: Few-shot Beispiele für bessere Ergebnisse

### 4. Antwort-Generierung
- **Quellenangabe**: Verweise auf verwendete Dokumente
- **Konfidenz-Scores**: Unsicherheit in Antworten anzeigen
- **Mehrere Perspektiven**: Alternative Antworten generieren
- **Zusammenfassung**: Lange Dokumente kompakt darstellen

## Technologien und Bibliotheken

### Vektordatenbanken
- **Pinecone**: Cloud-basierte Vektordatenbank
- **Weaviate**: Open-Source mit GraphQL-API
- **FAISS**: Facebook's Vektorsuche (lokal)
- **Chroma**: Einfache, lokale Vektordatenbank
- **Milvus**: Skalierbare Open-Source-Lösung

### Embedding-Modelle
- **OpenAI**: text-embedding-ada-002
- **Hugging Face**: sentence-transformers
- **Cohere**: embed-english-v3.0
- **Google**: Universal Sentence Encoder

### RAG-Frameworks
- **LangChain**: Umfassendes Framework für RAG
- **LlamaIndex**: Spezialisiert auf RAG-Anwendungen
- **Haystack**: Open-Source NLP-Framework
- **DSPy**: Programmiersprache für LM-Anwendungen

### LLM-APIs
- **OpenAI**: GPT-4, GPT-3.5
- **Anthropic**: Claude
- **Google**: Gemini
- **Meta**: Llama (lokal)
- **Ollama**: Lokale LLM-Installation

## RAG für die Directors-Script-Engine

### Aktueller Stand
Die Directors-Script-Engine hat bereits:
- Charakterverwaltung mit detaillierten Steckbriefen
- Ollama-Integration für KI-gestützte Unterstützung
- Upload-Funktionen für Wissensdatenbanken
- Kontext-basierte Prompt-Erstellung

### Potenzielle RAG-Erweiterungen

#### 1. Charakter-basierte RAG
- **Datenquelle**: Charakter-Steckbriefe, bisherige Dialoge
- **Anwendung**: Dialog-Generierung, die konsistent mit Charakteren ist
- **Vorteil**: Vermeidet Charakter-Inkonsistenzen

#### 2. Plot- und Szenen-RAG
- **Datenquelle**: Bisherige Szenen, Plot-Punkte, Drehbuch-Struktur
- **Anwendung**: Neue Szenen, die zum bestehenden Plot passen
- **Vorteil**: Erhält die narrative Kohärenz

#### 3. Genre- und Stil-RAG
- **Datenquelle**: Genre-spezifische Dokumente, Stil-Guides
- **Anwendung**: Stil-konsistente Text-Generierung
- **Vorteil**: Beibehaltung des gewünschten Tons und Stils

#### 4. Referenz-Material-RAG
- **Datenquelle**: Hochgeladene Dokumente, Research-Material
- **Anwendung**: Fakten-basierte Inhalte generieren
- **Vorteil**: Authentizität und Genauigkeit

### Implementierungsansätze

#### Ansatz 1: Einfache Dokumenten-RAG
```javascript
// Pseudocode
async function generateWithRAG(prompt, contextDocuments) {
  // 1. Dokumente in Vektordatenbank indexieren
  const embeddings = await generateEmbeddings(contextDocuments);
  const vectorStore = await createVectorStore(embeddings);
  
  // 2. Relevante Dokumente abrufen
  const relevantDocs = await vectorStore.search(prompt, { topK: 5 });
  
  // 3. Kontext erstellen
  const context = relevantDocs.map(doc => doc.content).join('\n\n');
  
  // 4. Antwort generieren
  const response = await llm.generate(`
    Kontext: ${context}
    
    Frage: ${prompt}
    
    Antworte basierend auf dem Kontext.
  `);
  
  return { response, sources: relevantDocs };
}
```

#### Ansatz 2: Mehrstufige RAG
```javascript
// Pseudocode
async function multiStageRAG(query, documents) {
  // 1. Query Understanding
  const queryType = await classifyQuery(query);
  
  // 2. Document Selection
  const relevantDocs = await selectDocuments(query, documents, queryType);
  
  // 3. Document Reranking
  const rankedDocs = await rerankDocuments(query, relevantDocs);
  
  // 4. Context Construction
  const context = constructContext(query, rankedDocs);
  
  // 5. Response Generation
  const response = await generateResponse(query, context);
  
  // 6. Response Refinement
  const refinedResponse = await refineResponse(response, context);
  
  return refinedResponse;
}
```

#### Ansatz 3: Hybride RAG
```javascript
// Pseudocode
async function hybridRAG(query, documents) {
  // 1. Keyword-basierte Suche
  const keywordResults = await keywordSearch(query, documents);
  
  // 2. Semantische Suche
  const semanticResults = await semanticSearch(query, documents);
  
  // 3. Ergebnisse kombinieren und reranken
  const combinedResults = await combineAndRerank(
    keywordResults, 
    semanticResults
  );
  
  // 4. Kontext erstellen
  const context = createContext(combinedResults);
  
  // 5. Antwort generieren
  return await generateAnswer(query, context);
}
```

## Herausforderungen und Lösungen

### Herausforderung 1: Chunking
**Problem**: Wie teilt man Dokumente sinnvoll auf?
**Lösung**: 
- Adaptive Chunk-Größe basierend auf Inhalt
- Overlapping chunks für Kontext-Erhalt
- Semantische Chunking (Absätze, Szenen)

### Herausforderung 2: Retrieval-Qualität
**Problem**: Nicht alle abgerufenen Dokumente sind relevant
**Lösung**:
- Hybride Suche (Keywords + Semantik)
- Re-Ranking mit spezialisierten Modellen
- Query Expansion und Transformation

### Herausforderung 3: Kontext-Limit
**Problem**: LLMs haben begrenzten Kontext
**Lösung**:
- Map-Reduce für lange Dokumente
- Hierarchische Zusammenfassung
- Wichtige Informationen priorisieren

### Herausforderung 4: Halluzinationen
**Problem**: Modelle erfinden trotz RAG noch Inhalte
**Lösung**:
- Strikte Prompt-Engineering
- Quellenangaben erzwingen
- Antwort-Validierung

### Herausforderung 5: Performance
**Problem**: RAG kann langsam sein
**Lösung**:
- Caching von Embeddings
- Asynchrone Verarbeitung
- Optimierte Index-Strukturen

## Bewertung der aktuellen Implementierung

### Stärken
- ✅ Gute Ollama-Integration
- ✅ Strukturierte Charakter-Verwaltung
- ✅ Kontext-basierte Prompt-Erstellung
- ✅ Upload-Funktionalität für Dokumente

### Schwächen
- ❌ Keine echte Vektorsuche
- ❌ Keine Embedding-Generierung
- ❌ Keine strukturierte Dokumenten-Verarbeitung
- ❌ Keine Quellenangaben in Antworten

### Verbesserungspotenzial
- 🔄 Dokumenten-Indexierung mit Embeddings
- 🔄 Semantische Suche implementieren
- 🔄 RAG-Pipeline für Charakter-Konsistenz
- 🔄 Quellen-Nachverfolgung
- 🔄 Mehrstufige Retrieval-Strategie

## Nächste Schritte

1. **Technologie-Auswahl**: Vektordatenbank und Embedding-Modell auswählen
2. **Dokumenten-Pipeline**: Vorverarbeitung und Indexierung implementieren
3. **Retrieval-System**: Semantische Suche hinzufügen
4. **Prompt-Optimierung**: RAG-spezifische Prompts entwickeln
5. **Evaluation**: Systemleistung messen und optimieren

## Fazit

RAG bietet enorme Möglichkeiten für die Directors-Script-Engine:
- **Konsistente Charakter-Entwicklung**: Dialoge, die zu Charakteren passen
- **Plot-Kohärenz**: Neue Szenen, die zum bestehenden Plot passen
- **Fakten-basierte Inhalte**: Authentische Details aus Research-Material
- **Stil-Treue**: Genre-konforme Text-Generierung

Die Implementierung erfordert:
- Vektordatenbank für semantische Suche
- Embedding-Modelle für Dokument-Repräsentation
- Optimierte Retrieval-Strategien
- RAG-spezifische Prompt-Engineering

Mit diesen Erweiterungen könnte die Directors-Script-Engine zu einem leistungsfähigen Tool für professionelle Drehbuch-Autoren werden.