// rag/config/development.js

export const RAG_CONFIG = {
  vectorStore: {
    type: 'chroma',
    path: '../../data/chroma',
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