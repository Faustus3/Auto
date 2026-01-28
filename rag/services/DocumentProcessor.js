// rag/services/DocumentProcessor.js

class DocumentProcessor {
  constructor(config) {
    this.config = config;
    this.embeddingService = null;
  }

  async initialize() {
    try {
      const { EmbeddingService } = await import('./EmbeddingService.js');
      this.embeddingService = new EmbeddingService(this.config);
      await this.embeddingService.initialize();
      
      console.log('✅ Document processor initialized');
    } catch (error) {
      console.error('❌ Document processor initialization failed:', error);
      throw error;
    }
  }

  async processScript(scriptText) {
    try {
      const chunks = this._chunkText(
        scriptText,
        this.config.chunking.script.maxChunkSize,
        this.config.chunking.script.overlap
      );
      
      const embeddings = await this.embeddingService.generateEmbeddingsBatch(chunks);
      
      return {
        chunks,
        embeddings,
        metadata: {
          type: 'script',
          timestamp: Date.now()
        }
      };
    } catch (error) {
      console.error('❌ Script processing failed:', error);
      throw error;
    }
  }

  async processReferenceDocument(documentText) {
    try {
      const chunks = this._chunkText(
        documentText,
        this.config.chunking.reference.chunkSize,
        this.config.chunking.reference.overlap
      );
      
      const embeddings = await this.embeddingService.generateEmbeddingsBatch(chunks);
      
      return {
        chunks,
        embeddings,
        metadata: {
          type: 'reference',
          timestamp: Date.now()
        }
      };
    } catch (error) {
      console.error('❌ Reference document processing failed:', error);
      throw error;
    }
  }

  _chunkText(text, maxChunkSize, overlap) {
    const chunks = [];
    const textLength = text.length;
    
    for (let i = 0; i < textLength; i += maxChunkSize - overlap) {
      const chunk = text.substring(i, i + maxChunkSize);
      chunks.push(chunk);
    }
    
    return chunks;
  }
}

export { DocumentProcessor };