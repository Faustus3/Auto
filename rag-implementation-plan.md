# RAG-Implementierungsplan für Directors-Script-Engine

## Übersicht

Dieser Plan beschreibt die schrittweise Implementierung von RAG-Funktionalität in die bestehende Directors-Script-Engine.

## Phase 1: Analyse und Design (Woche 1)

### 1.1 Aktuelle Architektur analysieren
- [x] Bestehende Codebase verstehen
- [x] Datenfluss nachvollziehen
- [x] Ollama-Integration analysieren
- [x] Charakter-Verwaltungssystem verstehen

### 1.2 Anforderungen definieren
- [ ] Use Cases für RAG identifizieren
- [ ] Performance-Anforderungen festlegen
- [ ] Skalierbarkeits-Anforderungen definieren
- [ ] Benutzerfreundlichkeit sicherstellen

### 1.3 Technologie-Stack auswählen
- [x] Vektordatenbank evaluieren (Chroma vs FAISS vs Pinecone)
- [x] Embedding-Modell auswählen (local vs cloud)
- [x] RAG-Framework entscheiden (LangChain vs LlamaIndex)
- [x] Integration mit Ollama sicherstellen

**Entscheidungen:**
- **Vektordatenbank:** Chroma DB (Entwicklung) → Pinecone (Produktion)
- **Embedding-Modell:** Sentence-Transformers (Entwicklung) → OpenAI (Produktion)
- **RAG-Framework:** Eigene Implementierung (bessere Kontrolle)
- **Detaillierte Evaluation:** Siehe `tech-stack-evaluation.md`

## Phase 2: Grundlegende RAG-Implementierung (Woche 2-3)

### 2.1 Dokumenten-Pipeline
```javascript
// Dokumenten-Vorverarbeitung
class DocumentProcessor {
  async processDocument(file) {
    // 1. Text extrahieren
    const text = await this.extractText(file);
    
    // 2. In Chunks aufteilen
    const chunks = await this.chunkText(text);
    
    // 3. Metadaten extrahieren
    const metadata = this.extractMetadata(file, text);
    
    // 4. Embeddings generieren
    const embeddings = await this.generateEmbeddings(chunks);
    
    return { chunks, embeddings, metadata };
  }
  
  chunkText(text) {
    // Semantisches Chunking für Drehbücher
    // - Szenen als natürliche Grenzen
    // - Dialog-Blöcke zusammenhalten
    // - Overlapping für Kontext
  }
}
```

### 2.2 Vektordatenbank-Integration
```javascript
// Vektordatenbank-Service
class VectorStoreService {
  constructor() {
    this.db = new ChromaClient();
    this.collection = null;
  }
  
  async initialize() {
    // Collection für Drehbuch-Dokumente erstellen
    this.collection = await this.db.createCollection('script_documents', {
      embeddingFunction: this.embeddingFunction
    });
  }
  
  async indexDocuments(documents) {
    // Dokumente in Vektordatenbank indexieren
    await this.collection.add({
      ids: documents.map(doc => doc.id),
      embeddings: documents.map(doc => doc.embedding),
      metadatas: documents.map(doc => doc.metadata),
      documents: documents.map(doc => doc.content)
    });
  }
  
  async search(query, topK = 5) {
    // Semantische Suche durchführen
    const results = await this.collection.query({
      queryEmbeddings: [await this.generateEmbedding(query)],
      nResults: topK
    });
    
    return results;
  }
}
```

### 2.3 RAG-Pipeline
```javascript
// RAG-Service für Drehbuch-Anwendungen
class ScriptRAGService {
  constructor(vectorStore, llmService) {
    this.vectorStore = vectorStore;
    this.llmService = llmService;
  }
  
  async generateWithContext(prompt, contextType = 'all') {
    // 1. Kontext abrufen
    const context = await this.retrieveContext(prompt, contextType);
    
    // 2. Prompt konstruieren
    const enhancedPrompt = this.buildPrompt(prompt, context);
    
    // 3. Antwort generieren
    const response = await this.llmService.generate(enhancedPrompt);
    
    // 4. Quellenangaben hinzufügen
    return {
      response,
      sources: context.sources,
      confidence: this.calculateConfidence(context)
    };
  }
  
  async retrieveContext(query, contextType) {
    const contexts = [];
    
    if (contextType === 'all' || contextType === 'characters') {
      contexts.push(await this.getCharacterContext(query));
    }
    
    if (contextType === 'all' || contextType === 'plot') {
      contexts.push(await this.getPlotContext(query));
    }
    
    if (contextType === 'all' || contextType === 'references') {
      contexts.push(await this.getReferenceContext(query));
    }
    
    return this.mergeContexts(contexts);
  }
}
```

## Phase 3: Charakter-basierte RAG (Woche 4)

### 3.1 Charakter-Embeddings
```javascript
// Charakter-basierte RAG
class CharacterRAGService {
  async generateCharacterConsistentDialog(characterName, situation) {
    // 1. Charakter-Informationen abrufen
    const character = await this.getCharacter(characterName);
    
    // 2. Charakter-Embedding erstellen
    const characterProfile = this.createCharacterProfile(character);
    const characterEmbedding = await this.generateEmbedding(characterProfile);
    
    // 3. Ähnliche Dialoge finden
    const similarDialogs = await this.vectorStore.search(
      characterEmbedding, 
      { filter: { type: 'dialog', character: characterName } }
    );
    
    // 4. Dialog generieren
    const context = {
      character: character,
      previousDialogs: similarDialogs,
      situation: situation
    };
    
    return await this.generateDialog(context);
  }
  
  createCharacterProfile(character) {
    return `
      Name: ${character.name}
      Alter: ${character.age}
      Persönlichkeit: ${character.personality}
      Motivation: ${character.motivation}
      Hintergrund: ${character.background}
      Typische Sprechweise: ${character.dialogueStyle || ''}
    `;
  }
}
```

### 3.2 Dialog-Konsistenz-Prüfung
```javascript
class DialogueConsistencyChecker {
  async checkConsistency(dialog, characterName) {
    const character = await this.getCharacter(characterName);
    const characterProfile = this.createCharacterProfile(character);
    
    // Embeddings für Vergleich
    const dialogEmbedding = await this.generateEmbedding(dialog);
    const characterEmbedding = await this.generateEmbedding(characterProfile);
    
    // Ähnlichkeit berechnen
    const similarity = this.cosineSimilarity(dialogEmbedding, characterEmbedding);
    
    return {
      score: similarity,
      isConsistent: similarity > 0.7,
      feedback: this.generateFeedback(similarity, dialog, character)
    };
  }
}
```

## Phase 4: Plot- und Szenen-RAG (Woche 5)

### 4.1 Plot-Struktur-Erkennung
```javascript
class PlotRAGService {
  async analyzePlotStructure(script) {
    // 1. Szenen extrahieren
    const scenes = this.extractScenes(script);
    
    // 2. Plot-Punkte identifizieren
    const plotPoints = await this.identifyPlotPoints(scenes);
    
    // 3. Charakter-Entwicklungen verfolgen
    const characterArcs = await this.trackCharacterArcs(scenes);
    
    // 4. In Vektordatenbank indexieren
    await this.indexPlotStructure({
      scenes,
      plotPoints,
      characterArcs
    });
  }
  
  async suggestNextScene(currentScript) {
    // 1. Aktuelle Plot-Position analysieren
    const currentPosition = await this.analyzeCurrentPosition(currentScript);
    
    // 2. Nächste logische Szenen finden
    const suggestedScenes = await this.vectorStore.search(
      currentPosition.embedding,
      { 
        filter: { type: 'scene_suggestion' },
        nResults: 3
      }
    );
    
    // 3. Szenen generieren
    return await this.generateScenes(currentPosition, suggestedScenes);
  }
}
```

### 4.2 Genre- und Stil-RAG
```javascript
class GenreStyleRAGService {
  constructor(genre) {
    this.genre = genre;
  }
  
  async ensureGenreConsistency(text) {
    // 1. Genre-spezifische Referenzen abrufen
    const genreReferences = await this.vectorStore.search(
      text,
      { 
        filter: { type: 'genre_guide', genre: this.genre },
        nResults: 5
      }
    );
    
    // 2. Stil-Konsistenz prüfen
    const styleScore = await this.analyzeStyleConsistency(text, genreReferences);
    
    // 3. Bei Bedarf anpassen
    if (styleScore < 0.6) {
      return await this.adjustToGenre(text, genreReferences);
    }
    
    return { text, styleScore, adjustments: null };
  }
}
```

## Phase 5: Referenz-Material-RAG (Woche 6)

### 5.1 Dokumenten-Management
```javascript
class ReferenceMaterialService {
  async uploadAndProcessDocument(file, documentType) {
    // 1. Dokument validieren
    this.validateDocument(file, documentType);
    
    // 2. Text extrahieren
    const text = await this.extractText(file);
    
    // 3. Dokument verarbeiten
    const processor = new DocumentProcessor();
    const processedDoc = await processor.processDocument({
      file,
      text,
      type: documentType
    });
    
    // 4. In Vektordatenbank indexieren
    await this.vectorStore.indexDocuments([processedDoc]);
    
    // 5. Metadaten speichern
    await this.saveDocumentMetadata(processedDoc);
    
    return processedDoc;
  }
  
  async searchReferences(query, filters = {}) {
    return await this.vectorStore.search(query, {
      filter: { type: 'reference', ...filters },
      nResults: 10
    });
  }
}
```

### 5.2 Fakten-Checking
```javascript
class FactCheckingService {
  async checkFacts(text, referenceType = 'all') {
    // 1. Fakten aus Text extrahieren
    const facts = await this.extractFacts(text);
    
    // 2. Fakten gegen Referenzen prüfen
    const verifiedFacts = [];
    const unverifiedFacts = [];
    
    for (const fact of facts) {
      const references = await this.searchReferences(fact.statement, {
        type: referenceType
      });
      
      if (references.length > 0 && this.verifyFact(fact, references)) {
        verifiedFacts.push({ fact, references });
      } else {
        unverifiedFacts.push(fact);
      }
    }
    
    return {
      verifiedFacts,
      unverifiedFacts,
      confidence: verifiedFacts.length / facts.length
    };
  }
}
```

## Phase 6: Integration und Optimierung (Woche 7-8)

### 6.1 UI-Integration
```javascript
// Erweiterte UI-Komponenten
class EnhancedDramaturgPanel {
  constructor() {
    this.ragService = new ScriptRAGService();
    this.setupEnhancedFeatures();
  }
  
  setupEnhancedFeatures() {
    // RAG-basierte Smart Actions
    this.addAction('characterConsistentDialog', 'Charakter-konsistenter Dialog');
    this.addAction('plotDrivenScene', 'Plot-basierte Szene');
    this.addAction('factCheck', 'Fakten prüfen');
    this.addAction('styleCheck', 'Stil prüfen');
  }
  
  async generateCharacterConsistentDialog() {
    const character = this.getSelectedCharacter();
    const situation = this.getCurrentSceneContext();
    
    const result = await this.ragService.generateCharacterConsistentDialog(
      character,
      situation
    );
    
    this.displayResult(result);
  }
}
```

### 6.2 Performance-Optimierung
```javascript
class RAGOptimizer {
  constructor() {
    this.cache = new Map();
    this.prefetchQueue = [];
  }
  
  async optimizedRetrieval(query, contextType) {
    // 1. Cache prüfen
    const cacheKey = this.generateCacheKey(query, contextType);
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }
    
    // 2. Asynchron abrufen
    const result = await this.vectorStore.search(query, {
      filter: { type: contextType }
    });
    
    // 3. Cache speichern
    this.cache.set(cacheKey, result);
    
    return result;
  }
  
  async prefetchRelatedContent(currentContext) {
    // Vorausschauendes Laden von wahrscheinlich benötigtem Content
    const relatedQueries = this.predictRelatedQueries(currentContext);
    
    for (const query of relatedQueries) {
      this.prefetchQueue.push(
        this.vectorStore.search(query).then(result => {
          this.cache.set(this.generateCacheKey(query), result);
        })
      );
    }
  }
}
```

## Technische Spezifikationen

### Datenmodell
```javascript
// Dokumenten-Modell
{
  id: string,
  content: string,
  embedding: number[],
  metadata: {
    type: 'character' | 'scene' | 'dialog' | 'reference',
    characterName?: string,
    sceneNumber?: number,
    genre?: string,
    uploadDate: Date,
    sourceFile?: string
  }
}
```

### API-Endpunkte
```javascript
// RAG-API
POST /api/rag/generate
{
  "prompt": "string",
  "contextType": "all" | "characters" | "plot" | "references",
  "characterName": "string (optional)",
  "filters": { /* optional */ }
}

POST /api/rag/upload
{
  "file": "File",
  "documentType": "string",
  "metadata": { /* optional */ }
}

GET /api/rag/search
{
  "query": "string",
  "filters": { /* optional */ },
  "topK": "number"
}
```

### Konfiguration
```javascript
// config.js
const RAG_CONFIG = {
  vectorStore: {
    type: 'chroma',
    url: 'http://localhost:8000',
    collection: 'script_documents'
  },
  embeddings: {
    model: 'sentence-transformers/all-MiniLM-L6-v2',
    dimension: 384,
    batchSize: 32
  },
  retrieval: {
    topK: 5,
    similarityThreshold: 0.7,
    maxContextLength: 4000
  },
  generation: {
    model: 'llama3.2',
    temperature: 0.7,
    maxTokens: 1000
  },
  caching: {
    enabled: true,
    ttl: 3600, // 1 hour
    maxSize: 1000
  }
};
```

## Testing-Strategie

### Unit Tests
```javascript
// Beispiel-Test
describe('CharacterRAGService', () => {
  test('should generate character-consistent dialog', async () => {
    const service = new CharacterRAGService();
    const result = await service.generateCharacterConsistentDialog(
      'TestChar',
      'Test situation'
    );
    
    expect(result.dialog).toBeDefined();
    expect(result.sources).toBeDefined();
    expect(result.confidence).toBeGreaterThan(0.5);
  });
});
```

### Integration Tests
```javascript
describe('RAG Pipeline', () => {
  test('should process document and enable retrieval', async () => {
    const doc = await processTestDocument();
    await vectorStore.indexDocuments([doc]);
    
    const results = await vectorStore.search('test query');
    expect(results.length).toBeGreaterThan(0);
  });
});
```

### Performance Tests
```javascript
describe('Performance', () => {
  test('should retrieve context within 2 seconds', async () => {
    const start = Date.now();
    await ragService.retrieveContext('test query');
    const duration = Date.now() - start;
    
    expect(duration).toBeLessThan(2000);
  });
});
```

## Deployment-Plan

### Entwicklung
- [ ] Lokale Vektordatenbank (Chroma)
- [ ] Lokale Embedding-Modelle
- [ ] Entwicklungsumgebung einrichten

### Testing
- [ ] Test-Datenbank aufsetzen
- [ ] Integrationstests durchführen
- [ ] Performance-Tests durchführen

### Produktion
- [ ] Cloud-Vektordatenbank (Pinecone)
- [ ] Optimierte Embedding-Modelle
- [ ] Monitoring und Logging
- [ ] Backup-Strategie

## Erfolgsmetriken

### Qualitätsmetriken
- **Charakter-Konsistenz-Score**: Wie konsistent sind generierte Dialoge?
- **Fakten-Genauigkeit**: Wie viele Fakten sind verifizierbar?
- **Stil-Treue**: Wie gut passt der Stil zum Genre?

### Performance-Metriken
- **Retrieval-Latenz**: < 2 Sekunden
- **Generierungszeit**: < 10 Sekunden
- **Cache-Hit-Rate**: > 70%

### Benutzerzufriedenheit
- **Nützlichkeits-Score**: User Feedback
- **Verwendungs-Häufigkeit**: Wie oft wird RAG genutzt?
- **Feature-Adoption**: Wie viele User nutzen RAG-Features?

## Risiken und Mitigation

### Risiko 1: Performance-Probleme
**Mitigation**: Caching, asynchrone Verarbeitung, optimierte Index-Strukturen

### Risiko 2: Qualitäts-Probleme
**Mitigation**: Mehrstufige Validierung, Benutzer-Feedback, kontinuierliche Optimierung

### Risiko 3: Komplexität
**Mitigation**: Klare Dokumentation, schrittweise Einführung, Schulungen

## Timeline

| Woche | Phase | Meilensteine |
|-------|-------|--------------|
| 1 | Analyse & Design | Architektur-Entscheidungen, Technologie-Auswahl |
| 2-3 | Grundlegende RAG | Dokumenten-Pipeline, Vektordatenbank, Basis-RAG |
| 4 | Charakter-RAG | Charakter-Embeddings, Dialog-Konsistenz |
| 5 | Plot-RAG | Plot-Struktur, Genre-Styling |
| 6 | Referenz-RAG | Dokumenten-Management, Fakten-Checking |
| 7-8 | Integration | UI-Integration, Performance-Optimierung |

## Fazit

Dieser Implementierungsplan bietet einen strukturierten Ansatz zur Integration von RAG in die Directors-Script-Engine. Die schrittweise Implementierung ermöglicht:

- **Kontinuierliche Validierung** jeder Phase
- **Flexibilität** bei der Anpassung an neue Erkenntnisse
- **Risiko-Minimierung** durch inkrementelle Entwicklung
- **Qualitätssicherung** durch umfassende Tests

Die fertige Implementierung wird die Directors-Script-Engine zu einem leistungsfähigen Tool für professionelle Drehbuch-Autoren machen, das:
- Charakter-konsistente Dialoge generiert
- Plot-Kohärenz sicherstellt
- Fakten-basierte Inhalte liefert
- Genre-konforme Texte produziert