# Phase 2 Setup Guide: Grundlegende RAG-Implementierung

## Übersicht

Dieser Guide beschreibt den praktischen Aufbau der grundlegenden RAG-Infrastruktur für die Directors-Script-Engine.

## Voraussetzungen

- Node.js 18+ installiert
- npm oder yarn verfügbar
- Ollama installiert und laufend
- Chroma DB für Entwicklung

## Schritt 1: Projekt-Setup

### 1.1 Abhängigkeiten installieren

```bash
# In das Projektverzeichnis wechseln
cd c:/Users/Finn/Desktop/Auto

# Neue Abhängigkeiten hinzufügen
npm install chromadb @xenova/transformers pdf-parse mammoth uuid

# Optional: Dev-Dependencies
npm install -D @types/uuid jest
```

### 1.2 Ordnerstruktur erstellen

```
c:/Users/Finn/Desktop/Auto/
├── rag/
│   ├── services/
│   │   ├── DocumentProcessor.js
│   │   ├── VectorStoreService.js
│   │   └── ScriptRAGService.js
│   ├── config/
│   │   └── development.js
│   ├── utils/
│   │   └── chunking.js
│   └── tests/
│       └── rag.test.js
├── data/
│   └── chroma/          # Chroma DB Speicher
├── public/
│   └── models/          # Lokale Modelle
└── directors-script-engine.html
```

## Schritt 2: Chroma DB Setup

### 2.1 Chroma Client initialisieren

```javascript
// rag/services/VectorStoreService.js
import { ChromaClient } from 'chromadb';

export class VectorStoreService {
  constructor(config) {
    this.client = new ChromaClient({
      path: config.vectorStore.path
    });
    this.collection = null;
    this.config = config;
  }

  async initialize() {
    try {
      // Collection erstellen oder laden
      this.collection = await this.client.getOrCreateCollection({
        name: this.config.vectorStore.collection,
        metadata: {
          "hnsw:space": "cosine"
        }
      });
      console.log('✅ Chroma DB Collection initialisiert');
    } catch (error) {
      console.error('❌ Fehler bei Chroma DB Initialisierung:', error);
      throw error;
    }
  }

  async healthCheck() {
    try {
      await this.client.heartbeat();
      return true;
    } catch {
      return false;
    }
  }
}
```

### 2.2 Embedding Service erstellen

```javascript
// rag/services/EmbeddingService.js
import { pipeline } from '@xenova/transformers';

export class EmbeddingService {
  constructor(config) {
    this.config = config;
    this.model = null;
    this.modelName = config.embeddings.model;
  }

  async initialize() {
    try {
      // Model laden (wird automatisch heruntergeladen beim ersten Mal)
      this.model = await pipeline(
        'feature-extraction',
        this.modelName,
        {
          quantized: this.config.embeddings.quantized
        }
      );
      console.log('✅ Embedding Model geladen:', this.modelName);
    } catch (error) {
      console.error('❌ Fehler beim Laden des Embedding Models:', error);
      throw error;
    }
  }

  async generateEmbedding(text) {
    if (!this.model) {
      await this.initialize();
    }

    try {
      const output = await this.model(text, {
        pooling: 'mean',
        normalize: true
      });
      
      // Tensor zu Array konvertieren
      return Array.from(output.data);
    } catch (error) {
      console.error('❌ Fehler bei Embedding-Generierung:', error);
      throw error;
    }
  }

  async generateEmbeddings(texts) {
    const embeddings = [];
    for (const text of texts) {
      const embedding = await this.generateEmbedding(text);
      embeddings.push(embedding);
    }
    return embeddings;
  }
}
```

## Schritt 3: Dokumenten-Verarbeitung

### 3.1 Chunking-Strategie implementieren

```javascript
// rag/utils/chunking.js

export class ScriptChunker {
  // Semantisches Chunking für Drehbücher
  static chunkScript(scriptText) {
    const chunks = [];
    const lines = scriptText.split('\n');
    
    let currentChunk = '';
    let currentScene = null;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      // Szenen-Header erkennen
      if (this.isSceneHeader(line)) {
        // Vorherigen Chunk speichern
        if (currentChunk) {
          chunks.push({
            content: currentChunk.trim(),
            metadata: {
              type: 'scene',
              scene: currentScene
            }
          });
        }
        
        // Neuen Chunk starten
        currentScene = line;
        currentChunk = line + '\n';
        continue;
      }
      
      // Charakter-Namen erkennen (Dialog-Anfang)
      if (this.isCharacterLine(line)) {
        // Dialog-Block sammeln
        const dialogBlock = this.collectDialogBlock(lines, i);
        currentChunk += dialogBlock.content + '\n';
        i = dialogBlock.lastIndex;
        continue;
      }
      
      // Beschreibung oder Action
      currentChunk += line + '\n';
      
      // Chunk-Größe begrenzen (max 1000 Zeichen)
      if (currentChunk.length > 1000 && currentScene) {
        chunks.push({
          content: currentChunk.trim(),
          metadata: {
            type: 'scene_content',
            scene: currentScene
          }
        });
        currentChunk = currentScene + '\n';
      }
    }
    
    // Letzten Chunk hinzufügen
    if (currentChunk) {
      chunks.push({
        content: currentChunk.trim(),
        metadata: {
          type: 'scene',
          scene: currentScene
        }
      });
    }
    
    return chunks;
  }
  
  static isSceneHeader(line) {
    // EXT. oder INT. am Anfang
    return /^(EXT\.|INT\.)/i.test(line);
  }
  
  static isCharacterLine(line) {
    // Nur Großbuchstaben und alleinstehend
    return /^[A-Z\s]+$/.test(line) && line.length > 0 && line.length < 50;
  }
  
  static collectDialogBlock(lines, startIndex) {
    let content = lines[startIndex] + '\n'; // Charakter-Name
    let i = startIndex + 1;
    
    // Dialog sammeln bis zum nächsten Charakter oder Leerzeile
    while (i < lines.length) {
      const line = lines[i].trim();
      
      if (this.isCharacterLine(line) || this.isSceneHeader(line)) {
        break;
      }
      
      if (line) {
        content += line + '\n';
      }
      
      i++;
    }
    
    return {
      content: content.trim(),
      lastIndex: i - 1
    };
  }
  
  // Allgemeines Text-Chunking für Referenz-Dokumente
  static chunkText(text, chunkSize = 500, overlap = 50) {
    const chunks = [];
    const words = text.split(' ');
    
    for (let i = 0; i < words.length; i += chunkSize - overlap) {
      const chunkWords = words.slice(i, i + chunkSize);
      chunks.push({
        content: chunkWords.join(' '),
        metadata: {
          type: 'text_chunk',
          chunkIndex: Math.floor(i / (chunkSize - overlap))
        }
      });
    }
    
    return chunks;
  }
}
```

### 3.2 DocumentProcessor implementieren

```javascript
// rag/services/DocumentProcessor.js
import { ScriptChunker } from '../utils/chunking.js';
import { EmbeddingService } from './EmbeddingService.js';
import { v4 as uuidv4 } from 'uuid';

export class DocumentProcessor {
  constructor(config) {
    this.config = config;
    this.embeddingService = new EmbeddingService(config);
    this.chunker = new ScriptChunker();
  }

  async initialize() {
    await this.embeddingService.initialize();
  }

  async processScript(scriptText, metadata = {}) {
    try {
      console.log('📝 Verarbeite Skript...');
      
      // 1. In Chunks aufteilen
      const chunks = this.chunker.chunkScript(scriptText);
      console.log(`📦 ${chunks.length} Chunks erstellt`);
      
      // 2. Embeddings generieren
      const contents = chunks.map(chunk => chunk.content);
      const embeddings = await this.embeddingService.generateEmbeddings(contents);
      console.log('🔢 Embeddings generiert');
      
      // 3. Dokumente mit Metadaten erstellen
      const documents = chunks.map((chunk, index) => ({
        id: uuidv4(),
        content: chunk.content,
        embedding: embeddings[index],
        metadata: {
          ...chunk.metadata,
          ...metadata,
          processedAt: new Date().toISOString(),
          documentType: 'script'
        }
      }));
      
      console.log('✅ Skript verarbeitet');
      return documents;
      
    } catch (error) {
      console.error('❌ Fehler bei Skript-Verarbeitung:', error);
      throw error;
    }
  }

  async processReferenceDocument(text, metadata = {}) {
    try {
      console.log('📚 Verarbeite Referenz-Dokument...');
      
      // 1. In Chunks aufteilen
      const chunks = this.chunker.chunkText(text);
      console.log(`📦 ${chunks.length} Chunks erstellt`);
      
      // 2. Embeddings generieren
      const contents = chunks.map(chunk => chunk.content);
      const embeddings = await this.embeddingService.generateEmbeddings(contents);
      console.log('🔢 Embeddings generiert');
      
      // 3. Dokumente erstellen
      const documents = chunks.map((chunk, index) => ({
        id: uuidv4(),
        content: chunk.content,
        embedding: embeddings[index],
        metadata: {
          ...chunk.metadata,
          ...metadata,
          processedAt: new Date().toISOString(),
          documentType: 'reference'
        }
      }));
      
      console.log('✅ Referenz-Dokument verarbeitet');
      return documents;
      
    } catch (error) {
      console.error('❌ Fehler bei Referenz-Dokument-Verarbeitung:', error);
      throw error;
    }
  }

  async processCharacter(characterData) {
    try {
      console.log(`👤 Verarbeite Charakter: ${characterData.name}`);
      
      // Charakter-Profil erstellen
      const profile = this.createCharacterProfile(characterData);
      
      // Einzelnes Dokument für den Charakter
      const embedding = await this.embeddingService.generateEmbedding(profile);
      
      const document = {
        id: uuidv4(),
        content: profile,
        embedding: embedding,
        metadata: {
          type: 'character',
          characterName: characterData.name,
          characterId: characterData.id || uuidv4(),
          processedAt: new Date().toISOString(),
          documentType: 'character'
        }
      };
      
      console.log('✅ Charakter verarbeitet');
      return document;
      
    } catch (error) {
      console.error('❌ Fehler bei Charakter-Verarbeitung:', error);
      throw error;
    }
  }

  createCharacterProfile(character) {
    return `
Name: ${character.name}
Alter: ${character.age || 'Unbekannt'}
Rolle: ${character.role || 'Charakter'}
Persönlichkeit: ${character.personality || 'Nicht beschrieben'}
Motivation: ${character.motivation || 'Nicht beschrieben'}
Hintergrund: ${character.background || 'Nicht beschrieben'}
Aussehen: ${character.appearance || 'Nicht beschrieben'}
Typische Sprechweise: ${character.dialogueStyle || 'Nicht spezifiziert'}
Zusammenfassung: ${character.summary || ''}
    `.trim();
  }
}
```

## Schritt 4: RAG Service implementieren

### 4.1 Basis RAG Service

```javascript
// rag/services/ScriptRAGService.js

export class ScriptRAGService {
  constructor(vectorStore, embeddingService, llmService) {
    this.vectorStore = vectorStore;
    this.embeddingService = embeddingService;
    this.llmService = llmService;
  }

  async retrieveContext(query, contextType = 'all', filters = {}) {
    try {
      console.log(`🔍 Suche Kontext für: "${query.substring(0, 50)}..."`);
      
      // Query-Embedding generieren
      const queryEmbedding = await this.embeddingService.generateEmbedding(query);
      
      // Suche in Vektordatenbank
      const results = await this.vectorStore.search(queryEmbedding, {
        topK: this.config.retrieval.topK,
        filters: {
          ...filters,
          documentType: contextType === 'all' ? undefined : contextType
        }
      });
      
      // Ergebnisse filtern nach Similarity-Threshold
      const filteredResults = results.filter(r => 
        r.similarity >= this.config.retrieval.similarityThreshold
      );
      
      console.log(`📊 ${filteredResults.length} relevante Ergebnisse gefunden`);
      
      return {
        documents: filteredResults,
        sources: filteredResults.map(r => r.metadata),
        confidence: this.calculateConfidence(filteredResults)
      };
      
    } catch (error) {
      console.error('❌ Fehler bei Kontext-Retrieval:', error);
      throw error;
    }
  }

  async generateWithContext(prompt, contextType = 'all', options = {}) {
    try {
      // 1. Kontext abrufen
      const context = await this.retrieveContext(
        prompt, 
        contextType, 
        options.filters
      );
      
      // 2. Prompt konstruieren
      const enhancedPrompt = this.buildPrompt(prompt, context, options);
      
      // 3. Antwort generieren
      const response = await this.llmService.generate(enhancedPrompt);
      
      // 4. Ergebnis zurückgeben
      return {
        response,
        sources: context.sources,
        confidence: context.confidence,
        contextDocuments: context.documents
      };
      
    } catch (error) {
      console.error('❌ Fehler bei RAG-Generierung:', error);
      throw error;
    }
  }

  buildPrompt(userPrompt, context, options = {}) {
    const { documents } = context;
    
    // Kontext aus Dokumenten extrahieren
    const contextText = documents
      .map((doc, index) => `[Quelle ${index + 1}]\n${doc.content}`)
      .join('\n\n');
    
    // Prompt-Template basierend auf Kontext-Typ
    let systemPrompt = '';
    switch (options.contextType || 'all') {
      case 'characters':
        systemPrompt = `Du bist ein Drehbuch-Assistent. Antworte basierend auf den Charakter-Informationen.

Kontext:
${contextText}

Antworte als Drehbuch-Assistent und beziehe dich auf die Charakter-Eigenschaften.`;
        break;
        
      case 'plot':
        systemPrompt = `Du bist ein Drehbuch-Assistent. Antworte basierend auf der Plot-Struktur.

Kontext:
${contextText}

Antworte als Drehbuch-Assistent und analysiere die narrative Struktur.`;
        break;
        
      case 'references':
        systemPrompt = `Du bist ein Drehbuch-Assistent. Antworte basierend auf den Referenz-Materialien.

Kontext:
${contextText}

Antworte als Drehbuch-Assistent und nutze Fakten aus den Referenzen.`;
        break;
        
      default:
        systemPrompt = `Du bist ein Drehbuch-Assistent. Antworte basierend auf dem bereitgestellten Kontext.

Kontext:
${contextText}

Antworte als Drehbuch-Assistent und nutze den Kontext für fundierte Antworten.`;
    }
    
    return {
      system: systemPrompt,
      user: userPrompt
    };
  }

  calculateConfidence(documents) {
    if (documents.length === 0) return 0;
    
    // Durchschnittliche Similarity als Confidence-Score
    const avgSimilarity = documents.reduce((sum, doc) => 
      sum + doc.similarity, 0) / documents.length;
    
    return Math.min(1.0, avgSimilarity);
  }
}
```

## Schritt 5: Konfiguration

### 5.1 Development Config

```javascript
// rag/config/development.js

export const RAG_CONFIG = {
  vectorStore: {
    type: 'chroma',
    path: './data/chroma',
    collection: 'script_documents_dev'
  },
  embeddings: {
    model: 'Xenova/all-MiniLM-L6-v2',
    dimension: 384,
    quantized: true,
    batchSize: 8
  },
  retrieval: {
    topK: 5,
    similarityThreshold: 0.7,
    maxContextLength: 3000
  },
  generation: {
    model: 'llama3.2',
    temperature: 0.7,
    maxTokens: 1000
  },
  chunking: {
    script: {
      maxChunkSize: 1000,
      overlap: 100
    },
    reference: {
      chunkSize: 500,
      overlap: 50
    }
  },
  caching: {
    enabled: true,
    ttl: 1800, // 30 Minuten
    maxSize: 100
  }
};
```

## Schritt 6: Integration in bestehende App

### 6.1 RAG Module laden

```javascript
// Am Anfang von directors-script-engine.html, nach den bestehenden Skripten

<script type="module">
  import { RAG_CONFIG } from './rag/config/development.js';
  import { VectorStoreService } from './rag/services/VectorStoreService.js';
  import { EmbeddingService } from './rag/services/EmbeddingService.js';
  import { DocumentProcessor } from './rag/services/DocumentProcessor.js';
  import { ScriptRAGService } from './rag/services/ScriptRAGService.js';
  
  // Globale RAG Instanzen
  window.RAG = {
    config: RAG_CONFIG,
    services: {}
  };
  
  // RAG Services initialisieren
  async function initializeRAG() {
    try {
      console.log('🚀 Initialisiere RAG Services...');
      
      // Vector Store
      RAG.services.vectorStore = new VectorStoreService(RAG.config);
      await RAG.services.vectorStore.initialize();
      
      // Embedding Service
      RAG.services.embedding = new EmbeddingService(RAG.config);
      await RAG.services.embedding.initialize();
      
      // Document Processor
      RAG.services.processor = new DocumentProcessor(RAG.config);
      await RAG.services.processor.initialize();
      
      // RAG Service
      RAG.services.rag = new ScriptRAGService(
        RAG.services.vectorStore,
        RAG.services.embedding,
        {
          generate: async (prompt) => {
            // Integration mit bestehender Ollama-Funktion
            return await callOllama(prompt.user, prompt.system);
          }
        }
      );
      
      console.log('✅ RAG Services initialisiert');
      
      // Test-Abfrage
      await testRAG();
      
    } catch (error) {
      console.error('❌ RAG Initialisierung fehlgeschlagen:', error);
    }
  }
  
  async function testRAG() {
    try {
      console.log('🧪 Teste RAG Funktionalität...');
      
      const result = await RAG.services.rag.generateWithContext(
        'Was sind die Hauptcharaktere?',
        'all'
      );
      
      console.log('✅ RAG Test erfolgreich:', result);
    } catch (error) {
      console.warn('⚠️ RAG Test fehlgeschlagen:', error);
    }
  }
  
  // Initialisierung starten, wenn DOM bereit
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeRAG);
  } else {
    initializeRAG();
  }
</script>
```

## Schritt 7: Testen

### 7.1 Test-Skript erstellen

```javascript
// rag/tests/rag.test.js

import { describe, it, expect, beforeAll } from 'jest';
import { RAG_CONFIG } from '../config/development.js';
import { VectorStoreService } from '../services/VectorStoreService.js';
import { DocumentProcessor } from '../services/DocumentProcessor.js';
import { ScriptRAGService } from '../services/ScriptRAGService.js';

describe('RAG Pipeline', () => {
  let vectorStore, processor, ragService;
  
  beforeAll(async () => {
    vectorStore = new VectorStoreService(RAG_CONFIG);
    await vectorStore.initialize();
    
    processor = new DocumentProcessor(RAG_CONFIG);
    await processor.initialize();
    
    ragService = new ScriptRAGService(
      vectorStore,
      processor.embeddingService,
      {
        generate: async (prompt) => `Test response for: ${prompt.user}`
      }
    );
  });
  
  it('should process and index a script', async () => {
    const testScript = `
EXT. PARK - TAG

Ein sonniger Tag im Park.

              MAX
    Hallo, wie geht es dir?
    `;
    
    const documents = await processor.processScript(testScript, {
      title: 'Test Script'
    });
    
    expect(documents.length).toBeGreaterThan(0);
    expect(documents[0].content).toContain('EXT.');
    
    await vectorStore.indexDocuments(documents);
  });
  
  it('should retrieve relevant context', async () => {
    const context = await ragService.retrieveContext(
      'Was passiert im Park?',
      'all'
    );
    
    expect(context.documents.length).toBeGreaterThan(0);
    expect(context.confidence).toBeGreaterThan(0);
  });
  
  it('should generate response with context', async () => {
    const result = await ragService.generateWithContext(
      'Beschreibe die Szene',
      'all'
    );
    
    expect(result.response).toBeDefined();
    expect(result.sources).toBeDefined();
    expect(result.confidence).toBeGreaterThan(0);
  });
});
```

### 7.2 Tests ausführen

```bash
# Tests ausführen
npm test

# Oder mit Jest direkt
npx jest rag/tests/rag.test.js
```

## Schritt 8: Nächste Schritte

### 8.1 Charakter-Daten indexieren

```javascript
// In der bestehenden App, nachdem Charaktere erstellt wurden

async function indexCharacter(characterData) {
  try {
    const document = await RAG.services.processor.processCharacter(characterData);
    await RAG.services.vectorStore.indexDocuments([document]);
    console.log(`✅ Charakter "${characterData.name}" indexiert`);
  } catch (error) {
    console.error(`❌ Fehler beim Indexieren von "${characterData.name}":`, error);
  }
}

// Bestehende Charaktere beim Start indexieren
async function indexExistingCharacters() {
  const characters = await loadData('characterCards') || [];
  for (const character of characters) {
    await indexCharacter(character);
  }
}
```

### 8.2 Upload-Funktion erweitern

```javascript
// Bestehende uploadAndProcessDocument Funktion erweitern

async function uploadAndProcessDocument(file, documentType) {
  // ... bestehender Code ...
  
  // 3. Dokument verarbeiten
  const processor = new DocumentProcessor(RAG.config);
  const processedDoc = await processor.processReferenceDocument(text, {
    type: documentType,
    filename: file.name
  });
  
  // 4. In Vektordatenbank indexieren
  await RAG.services.vectorStore.indexDocuments(processedDoc);
  
  // ... restlicher Code ...
}
```

## Troubleshooting

### Problem 1: Chroma DB Verbindungsfehler
**Lösung:**
```bash
# Chroma DB neu starten
# Stelle sicher, dass der Pfad ./data/chroma existiert
mkdir -p ./data/chroma
```

### Problem 2: Embedding Model lädt nicht
**Lösung:**
```javascript
// Model manuell herunterladen
import { env } from '@xenova/transformers';
env.allowLocalModels = false; // Erzwinge Download
```

### Problem 3: Langsame Embedding-Generierung
**Lösung:**
```javascript
// Batch-Größe reduzieren
const RAG_CONFIG = {
  embeddings: {
    batchSize: 4 // Reduzieren für weniger RAM-Verbrauch
  }
};
```

## Fazit

Mit diesem Setup haben Sie eine voll funktionsfähige RAG-Infrastruktur für die Directors-Script-Engine. Die nächsten Schritte sind:

1. **Charakter-basierte RAG (Phase 3)**: Dialog-Konsistenz und Charakter-Profile
2. **Plot-RAG (Phase 4)**: Szenen-Vorschläge und narrative Struktur
3. **Referenz-RAG (Phase 5)**: Fakten-Checking und Research-Integration
4. **UI-Integration (Phase 6)**: Benutzeroberfläche für RAG-Features

Die Basis-Implementierung ist nun bereit für die Erweiterung mit spezialisierten RAG-Funktionen!