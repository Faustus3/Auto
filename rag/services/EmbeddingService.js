// rag/services/EmbeddingService.js

import { pipeline } from '@xenova/transformers';

class EmbeddingService {
  constructor(config) {
    this.config = config;
    this.embeddingPipeline = null;
  }

  async initialize() {
    try {
      console.log('🚀 Initializing embedding pipeline...');
      
      this.embeddingPipeline = await pipeline(
        'feature-extraction',
        this.config.embeddings.model,
        {
          quantized: this.config.embeddings.quantized,
          progress_callback: (data) => {
            console.log('Embedding model loading progress:', data);
          }
        }
      );
      
      console.log('✅ Embedding pipeline initialized');
    } catch (error) {
      console.error('❌ Embedding pipeline initialization failed:', error);
      throw error;
    }
  }

  async generateEmbedding(text) {
    if (!this.embeddingPipeline) {
      throw new Error('Embedding pipeline not initialized');
    }

    try {
      const output = await this.embeddingPipeline(text, {
        pooling: 'mean',
        normalize: true
      });
      
      // Extract the embedding vector
      const embedding = Array.from(output.data);
      
      return embedding;
    } catch (error) {
      console.error('❌ Embedding generation failed:', error);
      throw error;
    }
  }

  async generateEmbeddingsBatch(texts) {
    if (!this.embeddingPipeline) {
      throw new Error('Embedding pipeline not initialized');
    }

    try {
      const outputs = await Promise.all(
        texts.map(text => this.generateEmbedding(text))
      );
      
      return outputs;
    } catch (error) {
      console.error('❌ Batch embedding generation failed:', error);
      throw error;
    }
  }
}

export { EmbeddingService };