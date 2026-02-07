/**
 * Main Server File
 * Entry point for the Auto Dashboard application
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const multer = require('multer');
const { exec } = require('child_process');
const path = require('path');

// Import services
const AuthService = require('./auth-service');
const DataService = require('./data-service');
const VectorService = require('./vector-service');
const DatabaseService = require('./database-service');
const FileStorageService = require('./file-storage-service');
const OllamaContextService = require('./ollama-context-service');

const app = express();
const PORT = process.env.PORT || 3001;

// Configure multer for memory storage (we'll process and save manually)
const upload = multer({ storage: multer.memoryStorage() });

// Create service instances
const authService = new AuthService(process.env.JWT_SECRET);
const dataService = new DataService();

// Ollama API configuration
const OLLAMA_BASE_URL = process.env.OLLAMA_URL || 'http://localhost:11434';

// Internal API URL for server-to-server calls (always localhost)
const INTERNAL_API_URL = `http://localhost:${PORT}`;

// Python WebSearch Service path
const PYTHON_WEBSEARCH_PATH = path.join(__dirname, '..', 'websearch-service', 'api_bridge.py');

/**
 * Helper function to call Python WebSearch service
 * @param {string} query - Search query
 * @param {string} mode - 'search', 'research', or 'ollama'
 * @param {number} maxResults - Max results
 * @returns {Promise<Object>} Python service response
 */
async function callPythonWebSearch(query, mode = 'research', maxResults = 3) {
  return new Promise((resolve, reject) => {
    const cmd = `python "${PYTHON_WEBSEARCH_PATH}" --query "${query.replace(/"/g, '\\"')}" --mode ${mode} --max-results ${maxResults}`;
    
    exec(cmd, { cwd: path.join(__dirname, '..') }, (error, stdout, stderr) => {
      if (error) {
        console.error('[WebSearch] Python error:', error.message);
        return reject(new Error('Web search failed'));
      }
      
      try {
        const result = JSON.parse(stdout);
        if (result.error) {
          return reject(new Error(result.error));
        }
        resolve(result);
      } catch (parseError) {
        console.error('[WebSearch] Parse error:', parseError);
        reject(new Error('Invalid response from web search service'));
      }
    });
  });
}

// Trust proxy for zrok tunnel
app.set('trust proxy', 1);

// Middleware
app.use(express.json());

// CORS configuration
// Allow all origins for zrok compatibility (URLs change dynamically)
const corsOptions = {
  origin: true, // Allow all origins
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
};

app.use(cors(corsOptions));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});

app.use(limiter);

// --- API Routes ---

// Authentication Routes
app.post('/api/auth/register', async (req, res) => {
  try {
    const { username, password, displayName } = req.body;
    const result = await authService.register(username, password, displayName);
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const result = await authService.login(username, password);
    res.json(result);
  } catch (error) {
    res.status(401).json({ error: error.message });
  }
});

app.get('/api/auth/verify', authService.authenticateToken, (req, res) => {
  res.json({ valid: true, user: req.user });
});

// Data Routes
app.post('/api/data/save', authService.authenticateToken, async (req, res) => {
  try {
    const { key, data } = req.body;
    const result = dataService.saveData(req.user.username, key, data);
    
    // Auto-index notes in vector store
    if (key.startsWith('note_') && data.title && data.content) {
      const noteId = key.replace('note_', '');
      try {
        await VectorService.indexNote(req.user.username, noteId, data.title, data.content);
        console.log(`[VectorStore] Indexed note: ${key}`);
      } catch (indexError) {
        console.error('[VectorStore] Failed to index note:', indexError.message);
      }
    }
    
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/data/load/:key', authService.authenticateToken, async (req, res) => {
  try {
    const { key } = req.params;
    const result = dataService.loadData(req.user.username, key);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/data/keys', authService.authenticateToken, async (req, res) => {
  try {
    const result = dataService.listKeys(req.user.username);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// === SHARED BLOG ENDPOINTS ===

app.get('/api/blog/posts', authService.authenticateToken, async (req, res) => {
  try {
    const posts = await dataService.getSharedBlogPosts();
    res.json(posts);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/blog/posts', authService.authenticateToken, async (req, res) => {
  try {
    const { title, content, tags } = req.body;
    if (!title || !content) {
      return res.status(400).json({ error: 'Title and content required' });
    }
    const newPost = {
      id: Date.now().toString(),
      title,
      content,
      tags: tags || [],
      author: req.user.username,
      authorDisplayName: req.user.displayName || req.user.username,
      date: new Date().toISOString(),
      lastModified: new Date().toISOString()
    };
    const post = await dataService.addSharedBlogPost(newPost);
    
    // Auto-index in vector store
    try {
      await VectorService.indexBlogPost(post);
      console.log(`[VectorStore] Indexed blog post: ${post.id}`);
    } catch (indexError) {
      console.error('[VectorStore] Failed to index blog post:', indexError.message);
    }
    
    res.json(post);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/blog/posts/:id', authService.authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { title, content, tags } = req.body;
    const updateData = {
      title,
      content,
      tags,
      lastModified: new Date().toISOString()
    };
    const post = await dataService.updateSharedBlogPost(id, updateData);
    res.json(post);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/blog/posts/:id', authService.authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    await dataService.deleteSharedBlogPost(id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// === CHAT ENDPOINTS ===

app.get('/api/chat/models', authService.authenticateToken.bind(authService), async (req, res) => {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    
    const response = await fetch(`${OLLAMA_BASE_URL}/api/tags`, {
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      throw new Error(`Ollama API error: ${response.status} - ${response.statusText}`);
    }
    
    const data = await response.json();
    
    if (!data || !Array.isArray(data.models)) {
      console.error('Invalid response from Ollama:', data);
      return res.status(500).json({ error: 'Invalid response from Ollama API' });
    }
    
    const models = data.models.map(model => ({
      id: model.name,
      name: model.name
    }));
    res.json(models);
  } catch (error) {
    console.error('Error fetching Ollama models:', error);
    
    if (error.name === 'AbortError') {
      return res.status(503).json({ error: 'Ollama service timeout - check if Ollama is running' });
    }
    if (error.code === 'ECONNREFUSED' || error.cause?.code === 'ECONNREFUSED') {
      return res.status(503).json({ error: 'Ollama service not available - check if Ollama is running on ' + OLLAMA_BASE_URL });
    }
    
    res.status(500).json({ error: error.message || 'Failed to fetch Ollama models' });
  }
});

app.post('/api/chat/generate', authService.authenticateToken.bind(authService), async (req, res) => {
  try {
    const { model, messages, useRag, useWebSearch, ragOptions } = req.body;
    
    if (!model || !messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'Model and messages are required' });
    }

    let ollamaMessages = messages.map(msg => ({
      role: msg.role === 'system' ? 'system' : (msg.role === 'assistant' ? 'assistant' : 'user'),
      content: msg.text || msg.content || ''
    }));

    // Get the last user message as query
    const lastUserMessage = [...ollamaMessages].reverse().find(m => m.role === 'user');
    const query = lastUserMessage?.content || '';

    // RAG: Search knowledge base and inject context
    if (useRag === true && query) {
      try {
        const searchOptions = {
          searchNotes: ragOptions?.searchNotes !== false,
          searchBlogPosts: ragOptions?.searchBlogPosts !== false,
          searchScripts: ragOptions?.searchScripts !== false,
          maxResults: ragOptions?.maxResults || 5
        };

        // Use semantic search with ChromaDB + Ollama embeddings
        const semanticResults = await VectorService.hybridSearch(query, searchOptions);
        let context = null;
        let searchMethod = 'keyword';

        if (semanticResults && semanticResults.length > 0) {
          context = VectorService.buildSemanticContext(semanticResults);
          searchMethod = 'semantic';
          console.log(`[RAG] Semantic search found ${semanticResults.length} results`);
        } else {
          // Fallback to keyword search
          const keywordResults = await dataService.searchKnowledge(req.user.username, query, searchOptions);
          context = dataService.buildRagContext(keywordResults);
          searchMethod = 'keyword';
          console.log(`[RAG] Keyword search found ${keywordResults.returnedResults} results`);
        }

        if (context) {
          const existingSystemIndex = ollamaMessages.findIndex(m => m.role === 'system');
          
          const ragSystemMessage = {
            role: 'system',
            content: `${context}

[Search Method: ${searchMethod.toUpperCase()}]

Use this knowledge to answer the user's questions. If the knowledge is relevant, incorporate it into your response.`
          };

          if (existingSystemIndex >= 0) {
            ollamaMessages[existingSystemIndex].content += '\n\n' + ragSystemMessage.content;
          } else {
            ollamaMessages.unshift(ragSystemMessage);
          }
        }
      } catch (ragError) {
        console.error('[RAG] Error during knowledge search:', ragError);
      }
    }

    // AGENTIC WEB SEARCH: Automatically search the web when needed
    if (useWebSearch === true && query) {
      try {
        // Keywords that suggest current information is needed
        const currentInfoKeywords = [
          'news', 'latest', 'recent', 'current', 'today', 'this week', 'date',
          '2024', '2025', '2026', 'price', 'stock', 'weather', 'score',
          'who is', 'what is the', 'where can i find', 'how do i',
          'tutorial', 'documentation', 'api', 'official', 'website',
          'can you find out', 'what day', 'what time', 'current date',
          'search the web', 'look up', 'find online', 'google'
        ];

        const needsWebSearch = currentInfoKeywords.some(keyword => 
          query.toLowerCase().includes(keyword)
        );

        if (needsWebSearch || query.length > 50) {
          console.log(`[WebAgent] Triggering agentic research for: "${query.substring(0, 50)}..."`);

          // Perform agentic research
          const researchResponse = await fetch(`${INTERNAL_API_URL}/api/research`, {
            method: 'POST',
            headers: {
              'Authorization': req.headers.authorization,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ query, depth: 2 })
          });

          if (researchResponse.ok) {
            const researchData = await researchResponse.json();

            if (researchData.summary || researchData.findings?.length > 0) {
              let webContext = '\n\n=== WEB RESEARCH RESULTS ===\n\n';

              if (researchData.summary) {
                webContext += `Summary:\n${researchData.summary}\n\n`;
              }

              webContext += `Sources Analyzed: ${researchData.findings?.length || 0}\n`;

              if (researchData.findings?.length > 0) {
                webContext += '\nTop Sources:\n';
                researchData.findings.slice(0, 3).forEach((f, i) => {
                  webContext += `${i + 1}. ${f.title} (${f.url})\n`;
                });
              }

              webContext += '\n[Information gathered from live web sources]\n';

              // Add to system message
              const existingSystemIndex = ollamaMessages.findIndex(m => m.role === 'system');
              
              const webSystemMessage = {
                role: 'system',
                content: `${webContext}

Use this up-to-date web information to provide accurate, current answers. Cite relevant sources when appropriate.`
              };

              if (existingSystemIndex >= 0) {
                ollamaMessages[existingSystemIndex].content += webSystemMessage.content;
              } else {
                ollamaMessages.unshift(webSystemMessage);
              }

              console.log(`[WebAgent] Research complete: ${researchData.findings?.length || 0} sources analyzed`);
            }
          }
        }
      } catch (webError) {
        console.error('[WebAgent] Research error:', webError.message);
        // Continue without web context if research fails
      }
    }

    // Timeout for Ollama connection
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 120000);

    const ollamaResponse = await fetch(`${OLLAMA_BASE_URL}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: model,
        messages: ollamaMessages,
        stream: true,
        options: {
          num_predict: 2048,
          temperature: 0.7
        }
      }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!ollamaResponse.ok) {
      const errorText = await ollamaResponse.text();
      throw new Error(`Ollama API error: ${ollamaResponse.status} - ${errorText}`);
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const reader = ollamaResponse.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let streamDone = false;

    while (!streamDone) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      
      // Keep the last (potentially incomplete) line in the buffer
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmedLine = line.trim();
        if (!trimmedLine) continue;
        
        try {
          const data = JSON.parse(trimmedLine);
          
          if (data.done) {
            res.write('data: [DONE]\n\n');
            streamDone = true;
            break;
          }
          
          if (data.message && data.message.content) {
            const openaiFormat = {
              choices: [{
                delta: {
                  content: data.message.content
                }
              }]
            };
            res.write(`data: ${JSON.stringify(openaiFormat)}\n\n`);
          }
        } catch (e) {
          // Ignore malformed JSON lines
          console.debug('Skipping malformed JSON line:', trimmedLine.substring(0, 50));
        }
      }
    }

    // Process any remaining data in buffer
    if (buffer.trim()) {
      try {
        const data = JSON.parse(buffer.trim());
        if (!data.done && data.message?.content) {
          const openaiFormat = {
            choices: [{
              delta: {
                content: data.message.content
              }
            }]
          };
          res.write(`data: ${JSON.stringify(openaiFormat)}\n\n`);
        }
      } catch (e) {
        // Ignore final buffer if malformed
      }
    }

    res.write('data: [DONE]\n\n');
    res.end();

  } catch (error) {
    console.error('Chat generation error:', error);
    
    if (!res.headersSent) {
      if (error.name === 'AbortError') {
        return res.status(503).json({ error: 'Ollama request timeout - the model may be loading or unavailable' });
      }
      if (error.code === 'ECONNREFUSED' || error.cause?.code === 'ECONNREFUSED') {
        return res.status(503).json({ error: 'Ollama service not available - check if Ollama is running on ' + OLLAMA_BASE_URL });
      }
      
      res.status(500).json({ error: error.message || 'Failed to generate chat response' });
    } else {
      // If headers already sent (streaming started), we can't send JSON error
      res.write(`data: ${JSON.stringify({ error: error.message || 'Stream error' })}\n\n`);
      res.write('data: [DONE]\n\n');
      res.end();
    }
  }
});

// === THEATER SCRIPTS UPLOAD ===

app.post('/api/theater/upload', authService.authenticateToken.bind(authService), upload.single('script'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    // Check if file is a text file
    if (!req.file.mimetype.startsWith('text/') && req.file.mimetype !== 'application/json') {
      return res.status(400).json({ error: 'Only text files are allowed' });
    }

    const filename = req.file.originalname.replace(/\.[^/.]+$/, ''); // Remove extension
    const content = req.file.buffer.toString('utf-8');
    
    const result = await dataService.saveTheaterScript(req.user.username, filename, content);
    
    // Index each chunk in vector store
    if (result.success && result.chunkCount > 0) {
      try {
        const fullScript = await dataService.getTheaterScript(req.user.username, filename);
        if (fullScript && fullScript.chunks) {
          for (let i = 0; i < fullScript.chunks.length; i++) {
            await VectorService.indexKnowledge(req.user.username, filename, i + 1, fullScript.chunks[i]);
          }
          console.log(`[VectorStore] Indexed ${fullScript.chunks.length} chunks from ${filename}`);
        }
      } catch (indexError) {
        console.error('[VectorStore] Failed to index knowledge:', indexError.message);
      }
    }
    
    res.json({ 
      success: true, 
      message: result.message,
      filename: filename,
      chunkCount: result.chunkCount
    });
  } catch (error) {
    console.error('Theater upload error:', error);
    res.status(500).json({ error: error.message || 'Failed to upload theater script' });
  }
});

app.get('/api/theater/scripts', authService.authenticateToken.bind(authService), async (req, res) => {
  try {
    const scripts = await dataService.getTheaterScripts(req.user.username);
    res.json(scripts);
  } catch (error) {
    console.error('Error fetching theater scripts:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch theater scripts' });
  }
});

// === KNOWLEDGE SEARCH (RAG) ===

app.post('/api/knowledge/search', authService.authenticateToken.bind(authService), async (req, res) => {
  try {
    const { query, options } = req.body;

    if (!query || typeof query !== 'string') {
      return res.status(400).json({ error: 'Query is required' });
    }

    const searchOptions = {
      searchNotes: options?.searchNotes !== false,
      searchBlogPosts: options?.searchBlogPosts !== false,
      searchScripts: options?.searchScripts !== false,
      maxResults: options?.maxResults || 5,
      minScore: options?.minScore || 0.1
    };

    const results = await dataService.searchKnowledge(req.user.username, query, searchOptions);
    res.json(results);
  } catch (error) {
    console.error('Knowledge search error:', error);
    res.status(500).json({ error: error.message || 'Failed to search knowledge base' });
  }
});

app.post('/api/knowledge/context', authService.authenticateToken.bind(authService), async (req, res) => {
  try {
    const { query, options } = req.body;

    if (!query || typeof query !== 'string') {
      return res.status(400).json({ error: 'Query is required' });
    }

    const searchOptions = {
      searchNotes: options?.searchNotes !== false,
      searchBlogPosts: options?.searchBlogPosts !== false,
      searchScripts: options?.searchScripts !== false,
      maxResults: options?.maxResults || 5,
      minScore: options?.minScore || 0.1
    };

    const searchResults = await dataService.searchKnowledge(req.user.username, query, searchOptions);
    const context = dataService.buildRagContext(searchResults);

    res.json({
      query,
      hasContext: !!context,
      context: context,
      searchResults: searchResults.results
    });
  } catch (error) {
    console.error('Knowledge context error:', error);
    res.status(500).json({ error: error.message || 'Failed to build knowledge context' });
  }
});

// === SEMANTIC SEARCH (Hybrid RAG) ===

app.post('/api/semantic/search', authService.authenticateToken.bind(authService), async (req, res) => {
  try {
    const { query, options } = req.body;

    if (!query || typeof query !== 'string') {
      return res.status(400).json({ error: 'Query is required' });
    }

    const searchOptions = {
      searchNotes: options?.searchNotes !== false,
      searchBlogPosts: options?.searchBlogPosts !== false,
      searchKnowledge: options?.searchScripts !== false,
      maxResults: options?.maxResults || 5
    };

    const results = await VectorService.hybridSearch(query, searchOptions);
    
    res.json({
      query,
      method: 'semantic',
      totalResults: results.length,
      results: results
    });
  } catch (error) {
    console.error('Semantic search error:', error);
    res.status(500).json({ error: error.message || 'Failed to perform semantic search' });
  }
});

app.post('/api/semantic/context', authService.authenticateToken.bind(authService), async (req, res) => {
  try {
    const { query, options } = req.body;

    if (!query || typeof query !== 'string') {
      return res.status(400).json({ error: 'Query is required' });
    }

    const searchOptions = {
      searchNotes: options?.searchNotes !== false,
      searchBlogPosts: options?.searchBlogPosts !== false,
      searchKnowledge: options?.searchScripts !== false,
      maxResults: options?.maxResults || 5
    };

    const results = await VectorService.hybridSearch(query, searchOptions);
    const context = VectorService.buildSemanticContext(results);

    res.json({
      query,
      method: 'semantic',
      hasContext: !!context,
      context: context,
      results: results
    });
  } catch (error) {
    console.error('Semantic context error:', error);
    res.status(500).json({ error: error.message || 'Failed to build semantic context' });
  }
});

// === INDEX MANAGEMENT ===

app.post('/api/index/reindex', authService.authenticateToken.bind(authService), async (req, res) => {
  try {
    const { username } = req.user;
    let indexedCount = 0;

    // Re-index all notes
    const keys = await dataService.listKeys(username);
    for (const key of keys.keys) {
      if (key.startsWith('note_')) {
        const note = await dataService.loadData(username, key);
        if (note && note.title && note.content) {
          const noteId = key.replace('note_', '');
          await VectorService.indexNote(username, noteId, note.title, note.content);
          indexedCount++;
        }
      }
    }

    // Re-index all blog posts
    const posts = await dataService.getSharedBlogPosts();
    for (const post of posts) {
      await VectorService.indexBlogPost(post);
      indexedCount++;
    }

    res.json({
      success: true,
      message: `Re-indexed ${indexedCount} items`,
      indexedNotes: keys.keys.filter(k => k.startsWith('note_')).length,
      indexedPosts: posts.length
    });
  } catch (error) {
    console.error('Re-index error:', error);
    res.status(500).json({ error: error.message || 'Failed to re-index' });
  }
});

// === WEB SCRAPE API ===

// === WEB SEARCH API (Python-powered) ===

app.post('/api/search', authService.authenticateToken.bind(authService), async (req, res) => {
  try {
    const { query, numResults = 5 } = req.body;

    if (!query || typeof query !== 'string') {
      return res.status(400).json({ error: 'Query is required' });
    }

    console.log(`[WebSearch] Query: "${query}"`);
    const result = await callPythonWebSearch(query, 'search', numResults);
    
    res.json({
      query: result.query,
      results: result.results
    });
  } catch (error) {
    console.error('[WebSearch] Error:', error);
    res.status(500).json({ error: error.message || 'Search failed' });
  }
});

// === AGENTIC WEB RESEARCH (Python-powered) ===

app.post('/api/research', authService.authenticateToken.bind(authService), async (req, res) => {
  try {
    const { query, depth = 2 } = req.body;

    if (!query || typeof query !== 'string') {
      return res.status(400).json({ error: 'Query is required' });
    }

    console.log(`[Research] Starting research on: "${query}"`);

    // Use Python service for full research
    const result = await callPythonWebSearch(query, 'research', depth);
    
    // Generate summary using Ollama if we have findings
    if (result.results && result.results.length > 0) {
      const successfulFindings = result.results.filter(r => r.success);
      
      if (successfulFindings.length > 0) {
        const combinedContent = successfulFindings
          .map(f => `Source: ${f.title}\n${f.content}`)
          .join('\n\n---\n\n');

        const summaryController = new AbortController();
        const summaryTimeout = setTimeout(() => summaryController.abort(), 60000);

        try {
          const ollamaResponse = await fetch(`${OLLAMA_BASE_URL}/api/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              model: 'llama3.2',
              messages: [{
                role: 'system',
                content: 'You are a research assistant. Summarize the findings from multiple web sources into a comprehensive answer. Structure your response with key points and cite sources. Keep it concise but informative.'
              }, {
                role: 'user',
                content: `Research Question: ${query}\n\nWeb Findings:\n${combinedContent.substring(0, 8000)}`
              }],
              stream: false
            }),
            signal: summaryController.signal
          });

          clearTimeout(summaryTimeout);

          if (ollamaResponse.ok) {
            const summaryData = await ollamaResponse.json();
            result.summary = summaryData.message?.content || 'Could not generate summary';
          }
        } catch (ollamaError) {
          console.warn('[Research] Ollama summary failed:', ollamaError.message);
          result.summary = 'Summary generation failed';
        }
      }
    }

    console.log(`[Research] Completed: ${result.sources?.successful || 0} sources analyzed`);
    res.json({
      query: result.query,
      context: result.context,
      summary: result.summary || '',
      sources: result.sources,
      findings: result.results
    });
  } catch (error) {
    console.error('[Research] Error:', error);
    res.status(500).json({ error: error.message || 'Research failed' });
  }
});

// === FILE UPLOAD ENDPOINTS ===

/**
 * POST /api/upload
 * Upload a file with validation
 */
app.post('/api/upload', authService.authenticateToken.bind(authService), upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const { description } = req.body;
    const userId = req.user.username;

    // Store file using FileStorageService
    const fileData = await FileStorageService.storeFile(userId, req.file, {
      description: description || null
    });

    // Register in database
    const dbRecord = DatabaseService.createFile(userId, {
      originalName: fileData.originalName,
      storedName: fileData.storedName,
      filePath: fileData.filePath,
      mimeType: fileData.mimeType,
      fileSize: fileData.fileSize,
      description: fileData.description
    });

    // If it's a text file, index it for RAG
    if (fileData.metadata && fileData.metadata.textContent) {
      try {
        await VectorService.indexKnowledge(userId, fileData.originalName, 1, fileData.metadata.textContent);
        console.log(`[VectorStore] Indexed file: ${fileData.originalName}`);
      } catch (indexError) {
        console.warn('[VectorStore] Failed to index file:', indexError.message);
      }
    }

    res.json({
      success: true,
      message: 'File uploaded successfully',
      file: {
        id: dbRecord.id,
        originalName: dbRecord.originalName,
        mimeType: dbRecord.mimeType,
        fileSize: dbRecord.fileSize,
        category: fileData.category,
        createdAt: dbRecord.createdAt
      }
    });

  } catch (error) {
    console.error('[Upload] Error:', error.message);
    res.status(400).json({ 
      error: error.message || 'Failed to upload file'
    });
  }
});

/**
 * GET /api/files
 * Get all files for the user
 */
app.get('/api/files', authService.authenticateToken.bind(authService), (req, res) => {
  try {
    const userId = req.user.username;
    const files = DatabaseService.getFilesByUser(userId);
    
    res.json({
      success: true,
      files: files.map(f => ({
        id: f.id,
        originalName: f.originalName,
        mimeType: f.mimeType,
        fileSize: f.fileSize,
        description: f.description,
        createdAt: f.createdAt
      }))
    });
  } catch (error) {
    console.error('[Files] Error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/files/:id
 * Get file details
 */
app.get('/api/files/:id', authService.authenticateToken.bind(authService), (req, res) => {
  try {
    const userId = req.user.username;
    const fileId = parseInt(req.params.id);
    
    const file = DatabaseService.getFileById(userId, fileId);
    if (!file) {
      return res.status(404).json({ error: 'File not found' });
    }
    
    res.json({
      success: true,
      file
    });
  } catch (error) {
    console.error('[Files] Error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/files/:id/download
 * Download a file
 */
app.get('/api/files/:id/download', authService.authenticateToken.bind(authService), async (req, res) => {
  try {
    const userId = req.user.username;
    const fileId = parseInt(req.params.id);
    
    const file = DatabaseService.getFileById(userId, fileId);
    if (!file) {
      return res.status(404).json({ error: 'File not found' });
    }
    
    res.download(file.filePath, file.originalName);
  } catch (error) {
    console.error('[Files] Download error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

/**
 * DELETE /api/files/:id
 * Delete a file
 */
app.delete('/api/files/:id', authService.authenticateToken.bind(authService), async (req, res) => {
  try {
    const userId = req.user.username;
    const fileId = parseInt(req.params.id);
    
    const file = DatabaseService.getFileById(userId, fileId);
    if (!file) {
      return res.status(404).json({ error: 'File not found' });
    }
    
    // Delete from storage
    await FileStorageService.deleteFile(file.filePath);
    
    // Delete from database
    DatabaseService.deleteFile(userId, fileId);
    
    res.json({ success: true, message: 'File deleted successfully' });
  } catch (error) {
    console.error('[Files] Delete error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/files/allowed-types
 * Get allowed MIME types
 */
app.get('/api/files/allowed-types', authService.authenticateToken.bind(authService), (req, res) => {
  try {
    const allowedTypes = FileStorageService.getAllowedTypes();
    res.json({
      success: true,
      allowedTypes
    });
  } catch (error) {
    console.error('[Files] Error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// === NOTES ENDPOINTS (SQLite-based) ===

/**
 * POST /api/notes
 * Create a new note
 */
app.post('/api/notes', authService.authenticateToken.bind(authService), (req, res) => {
  try {
    const userId = req.user.username;
    const { title, content, tags } = req.body;
    
    const note = DatabaseService.createNote(userId, { title, content, tags });
    
    // Index in vector store for RAG
    try {
      VectorService.indexNote(userId, note.id, note.title, note.content);
      console.log(`[VectorStore] Indexed note: ${note.id}`);
    } catch (indexError) {
      console.warn('[VectorStore] Failed to index note:', indexError.message);
    }
    
    res.status(201).json({
      success: true,
      note
    });
  } catch (error) {
    console.error('[Notes] Create error:', error.message);
    res.status(400).json({ error: error.message });
  }
});

/**
 * GET /api/notes
 * Get all notes for user
 */
app.get('/api/notes', authService.authenticateToken.bind(authService), (req, res) => {
  try {
    const userId = req.user.username;
    const limit = parseInt(req.query.limit) || 50;
    const offset = parseInt(req.query.offset) || 0;
    
    const result = DatabaseService.getNotesByUser(userId, { limit, offset });
    
    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    console.error('[Notes] List error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/notes/:id
 * Get single note
 */
app.get('/api/notes/:id', authService.authenticateToken.bind(authService), (req, res) => {
  try {
    const userId = req.user.username;
    const noteId = parseInt(req.params.id);
    
    const note = DatabaseService.getNoteById(userId, noteId);
    if (!note) {
      return res.status(404).json({ error: 'Note not found' });
    }
    
    res.json({
      success: true,
      note
    });
  } catch (error) {
    console.error('[Notes] Get error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

/**
 * PUT /api/notes/:id
 * Update a note
 */
app.put('/api/notes/:id', authService.authenticateToken.bind(authService), (req, res) => {
  try {
    const userId = req.user.username;
    const noteId = parseInt(req.params.id);
    const { title, content, tags } = req.body;
    
    const note = DatabaseService.updateNote(userId, noteId, { title, content, tags });
    
    // Update vector index
    try {
      VectorService.indexNote(userId, note.id, note.title, note.content);
    } catch (indexError) {
      console.warn('[VectorStore] Failed to re-index note:', indexError.message);
    }
    
    res.json({
      success: true,
      note
    });
  } catch (error) {
    console.error('[Notes] Update error:', error.message);
    res.status(400).json({ error: error.message });
  }
});

/**
 * DELETE /api/notes/:id
 * Delete a note
 */
app.delete('/api/notes/:id', authService.authenticateToken.bind(authService), (req, res) => {
  try {
    const userId = req.user.username;
    const noteId = parseInt(req.params.id);
    
    DatabaseService.deleteNote(userId, noteId);
    
    // Remove from vector index
    try {
      VectorService.deleteNote(userId, noteId);
    } catch (indexError) {
      console.warn('[VectorStore] Failed to remove note from index:', indexError.message);
    }
    
    res.json({
      success: true,
      message: 'Note deleted successfully'
    });
  } catch (error) {
    console.error('[Notes] Delete error:', error.message);
    res.status(400).json({ error: error.message });
  }
});

/**
 * GET /api/notes/search
 * Search notes
 */
app.get('/api/notes/search', authService.authenticateToken.bind(authService), (req, res) => {
  try {
    const userId = req.user.username;
    const { q: query, limit = 20 } = req.query;
    
    if (!query) {
      return res.status(400).json({ error: 'Query parameter "q" is required' });
    }
    
    const results = DatabaseService.searchNotes(userId, query, parseInt(limit));
    
    res.json({
      success: true,
      query,
      results
    });
  } catch (error) {
    console.error('[Notes] Search error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// === BLOG POSTS ENDPOINTS (SQLite-based) ===

/**
 * POST /api/posts
 * Create a new blog post
 */
app.post('/api/posts', authService.authenticateToken.bind(authService), (req, res) => {
  try {
    const { title, content, tags, isPublic } = req.body;
    const author = req.user.username;
    const authorDisplayName = req.user.displayName || author;
    
    const post = DatabaseService.createBlogPost({
      title,
      content,
      author,
      authorDisplayName,
      tags,
      isPublic
    });
    
    // Index in vector store
    try {
      VectorService.indexBlogPost(post);
      console.log(`[VectorStore] Indexed blog post: ${post.id}`);
    } catch (indexError) {
      console.warn('[VectorStore] Failed to index blog post:', indexError.message);
    }
    
    res.status(201).json({
      success: true,
      post
    });
  } catch (error) {
    console.error('[Blog] Create error:', error.message);
    res.status(400).json({ error: error.message });
  }
});

/**
 * GET /api/posts
 * Get all public blog posts
 */
app.get('/api/posts', authService.authenticateToken.bind(authService), (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const offset = parseInt(req.query.offset) || 0;
    
    const result = DatabaseService.getAllBlogPosts({ limit, offset });
    
    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    console.error('[Blog] List error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/posts/:id
 * Get single blog post
 */
app.get('/api/posts/:id', authService.authenticateToken.bind(authService), (req, res) => {
  try {
    const postId = parseInt(req.params.id);
    
    const post = DatabaseService.getBlogPostById(postId);
    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }
    
    res.json({
      success: true,
      post
    });
  } catch (error) {
    console.error('[Blog] Get error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

/**
 * PUT /api/posts/:id
 * Update a blog post
 */
app.put('/api/posts/:id', authService.authenticateToken.bind(authService), (req, res) => {
  try {
    const author = req.user.username;
    const postId = parseInt(req.params.id);
    const { title, content, tags } = req.body;
    
    const post = DatabaseService.updateBlogPost(author, postId, { title, content, tags });
    
    // Update vector index
    try {
      VectorService.indexBlogPost(post);
    } catch (indexError) {
      console.warn('[VectorStore] Failed to re-index blog post:', indexError.message);
    }
    
    res.json({
      success: true,
      post
    });
  } catch (error) {
    console.error('[Blog] Update error:', error.message);
    res.status(400).json({ error: error.message });
  }
});

/**
 * DELETE /api/posts/:id
 * Delete a blog post
 */
app.delete('/api/posts/:id', authService.authenticateToken.bind(authService), (req, res) => {
  try {
    const author = req.user.username;
    const postId = parseInt(req.params.id);
    
    DatabaseService.deleteBlogPost(author, postId);
    
    // Remove from vector index
    try {
      VectorService.deleteBlogPost(postId);
    } catch (indexError) {
      console.warn('[VectorStore] Failed to remove blog post from index:', indexError.message);
    }
    
    res.json({
      success: true,
      message: 'Post deleted successfully'
    });
  } catch (error) {
    console.error('[Blog] Delete error:', error.message);
    res.status(400).json({ error: error.message });
  }
});

/**
 * GET /api/posts/search
 * Search blog posts
 */
app.get('/api/posts/search', authService.authenticateToken.bind(authService), (req, res) => {
  try {
    const { q: query, limit = 20 } = req.query;
    
    if (!query) {
      return res.status(400).json({ error: 'Query parameter "q" is required' });
    }
    
    const results = DatabaseService.searchBlogPosts(query, parseInt(limit));
    
    res.json({
      success: true,
      query,
      results
    });
  } catch (error) {
    console.error('[Blog] Search error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// === OLLAMA AGENT CONTEXT ENDPOINTS ===

/**
 * POST /api/query-agent
 * Query Ollama with RAG context
 */
app.post('/api/query-agent', authService.authenticateToken.bind(authService), async (req, res) => {
  try {
    const userId = req.user.username;
    const { query, options = {} } = req.body;
    
    if (!query || typeof query !== 'string') {
      return res.status(400).json({ error: 'Query is required' });
    }
    
    console.log(`[QueryAgent] Processing query: "${query.substring(0, 50)}..."`);
    
    // Get context from knowledge base
    const context = await OllamaContextService.getContextForOllama(userId, query, options);
    
    res.json({
      success: true,
      query,
      hasContext: !!context,
      context: context,
      sourcesSearched: {
        notes: options.searchNotes !== false,
        blogPosts: options.searchBlogPosts !== false,
        files: options.searchFiles !== false,
        knowledge: options.searchKnowledge !== false
      }
    });
    
  } catch (error) {
    console.error('[QueryAgent] Error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/query-agent/quick
 * Quick context query for simple use cases
 */
app.post('/api/query-agent/quick', authService.authenticateToken.bind(authService), async (req, res) => {
  try {
    const userId = req.user.username;
    const { query } = req.body;
    
    if (!query || typeof query !== 'string') {
      return res.status(400).json({ error: 'Query is required' });
    }
    
    const context = await OllamaContextService.quickContext(userId, query);
    
    res.json({
      success: true,
      query,
      hasContext: !!context,
      context: context
    });
    
  } catch (error) {
    console.error('[QueryAgent] Quick query error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// === DATABASE HEALTH ENDPOINT ===

/**
 * GET /api/db/stats
 * Get database statistics
 */
app.get('/api/db/stats', authService.authenticateToken.bind(authService), (req, res) => {
  try {
    const stats = DatabaseService.getStats();
    res.json({
      success: true,
      stats
    });
  } catch (error) {
    console.error('[DB] Stats error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Handle 404 for API routes
app.use('/api/*', (req, res) => {
  res.status(404).json({ error: 'API endpoint not found' });
});

// Handle 404 for all other routes
app.use((req, res) => {
  res.status(404).json({ error: 'Not found. This is an API-only server.' });
});

// Start server
const server = app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`[Database] SQLite database: ${DatabaseService.dbPath}`);
  console.log(`[Storage] Upload directory: ${FileStorageService.uploadDir}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, closing server gracefully');
  server.close(() => {
    DatabaseService.close();
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received, closing server gracefully');
  server.close(() => {
    DatabaseService.close();
    process.exit(0);
  });
});

module.exports = app;