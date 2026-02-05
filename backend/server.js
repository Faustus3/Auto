/**
 * Main Server File
 * Entry point for the Auto Dashboard application
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const multer = require('multer');

// Import services
const AuthService = require('./auth-service');
const DataService = require('./data-service');
const VectorService = require('./vector-service');

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

// Extract scrape logic into reusable function
async function performScrape(url, options = {}) {
  if (!url || typeof url !== 'string') {
    throw new Error('URL is required');
  }

  // Validate URL
  let parsedUrl;
  try {
    parsedUrl = new URL(url);
  } catch {
    throw new Error('Invalid URL format');
  }

  // Only allow HTTP/HTTPS
  if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
    throw new Error('Only HTTP/HTTPS URLs are allowed');
  }

  const timeout = (options?.timeout || 10) * 1000;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; AutoDashboard/1.0)'
    },
    signal: controller.signal
  });

  clearTimeout(timeoutId);

  if (!response.ok) {
    throw new Error(`Failed to fetch URL: ${response.statusText}`);
  }

  const contentType = response.headers.get('content-type') || '';
  
  if (!contentType.includes('text/html')) {
    throw new Error('Only HTML content is supported for scraping');
  }

  const html = await response.text();

  // Extract title
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  const title = titleMatch ? titleMatch[1].trim() : 'No title found';

  // Remove script and style tags with their content
  let cleanHtml = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<noscript[^>]*>[\s\S]*?<\/noscript>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '');

  // Extract main content (simplified)
  const bodyMatch = cleanHtml.match(/<body[^>]*>([\s\S]*)<\/body>/i);
  let content = bodyMatch ? bodyMatch[1] : cleanHtml;

  // Convert HTML to plain text
  content = content
    .replace(/<h[1-6][^>]*>([^<]+)<\/h[1-6]>/gi, '\n\n### $1\n\n')
    .replace(/<p[^>]*>([^<]+)<\/p>/gi, '\n$1\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<li[^>]*>([^<]+)<\/li>/gi, '\n• $1')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/\s+/g, ' ')
    .trim();

  // Limit content length
  const maxLength = options?.maxLength || 8000;
  if (content.length > maxLength) {
    content = content.substring(0, maxLength) + '\n\n[Content truncated...]';
  }

  return {
    success: true,
    url,
    title,
    content,
    contentLength: content.length
  };
}

app.post('/api/scrape', authService.authenticateToken.bind(authService), async (req, res) => {
  try {
    const { url, options } = req.body;
    const result = await performScrape(url, options);
    res.json(result);
  } catch (error) {
    console.error('Scrape error:', error);
    
    if (error.name === 'AbortError') {
      return res.status(504).json({ error: 'Request timed out' });
    }
    res.status(500).json({ error: error.message || 'Failed to scrape URL' });
  }
});

app.post('/api/scrape/summary', authService.authenticateToken.bind(authService), async (req, res) => {
  try {
    const { url } = req.body;

    if (!url || typeof url !== 'string') {
      return res.status(400).json({ error: 'URL is required' });
    }

    // First scrape the page using direct function call
    const scrapeData = await performScrape(url, { maxLength: 4000 });

    // Use Ollama to summarize
    const summaryController = new AbortController();
    const summaryTimeout = setTimeout(() => summaryController.abort(), 30000);

    const ollamaResponse = await fetch(`${OLLAMA_BASE_URL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'llama3.2', // Use a fast model for summarization
        messages: [{
          role: 'system',
          content: 'You are a helpful assistant that summarizes web content. Provide a concise summary of the main points in German or English as appropriate.'
        }, {
          role: 'user',
          content: `Please summarize this webpage content in 3-5 bullet points:\n\n${scrapeData.content}`
        }],
        stream: false
      }),
      signal: summaryController.signal
    });

    clearTimeout(summaryTimeout);

    if (ollamaResponse.ok) {
      const summaryData = await ollamaResponse.json();
      res.json({
        url: scrapeData.url,
        title: scrapeData.title,
        summary: summaryData.message?.content || 'Could not generate summary',
        fullContent: scrapeData.content
      });
    } else {
      res.json({
        url: scrapeData.url,
        title: scrapeData.title,
        summary: '(Summary generation failed - see full content)',
        fullContent: scrapeData.content
      });
    }
  } catch (error) {
    console.error('Summary error:', error);
    res.status(500).json({ error: error.message || 'Failed to generate summary' });
  }
});

// === WEB SEARCH API (DuckDuckGo - Free) ===

app.post('/api/search', authService.authenticateToken.bind(authService), async (req, res) => {
  try {
    const { query, numResults = 5 } = req.body;

    if (!query || typeof query !== 'string') {
      return res.status(400).json({ error: 'Query is required' });
    }

    const searchData = await performWebSearch(query, numResults);
    res.json(searchData);
  } catch (error) {
    console.error('Search error:', error);
    if (error.name === 'AbortError') {
      return res.status(504).json({ error: 'Search timed out' });
    }
    res.status(500).json({ error: error.message || 'Search failed' });
  }
});

// === AGENTIC WEB RESEARCH ===

// Helper function to perform web search
async function performWebSearch(query, numResults = 5) {
  // DuckDuckGo HTML search (free, no API key)
  const searchUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}&kl=us-en`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  const response = await fetch(searchUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    },
    signal: controller.signal
  });

  clearTimeout(timeoutId);

  if (!response.ok) {
    throw new Error('Search failed');
  }

  const html = await response.text();

  // Parse DuckDuckGo results
  const results = [];
  const linkRegex = /<a[^>]+class="[^"]*result__a[^"]*"[^>]+href="([^"]+)"[^>]*>([^<]+)<\/a>/g;
  const snippetRegex = /<a[^>]+class="[^"]*result__a[^"]*"[^>]+>[^<]+<\/a>[^<]*<[^>]+class="result__snippet"[^>]*>([^<]+)<\/p>/g;

  let match;
  while ((match = linkRegex.exec(html)) !== null && results.length < numResults) {
    const url = match[1];
    const title = match[2].replace(/<[^>]+>/g, '').trim();
    
    // Get snippet for this result
    const snippetMatch = snippetRegex.exec(html);
    const snippet = snippetMatch ? snippetMatch[1].replace(/<[^>]+>/g, '').trim() : '';

    if (url && title) {
      results.push({
        title,
        url,
        snippet: snippet || ''
      });
    }
  }

  return { query, results: results.slice(0, numResults) };
}

app.post('/api/research', authService.authenticateToken.bind(authService), async (req, res) => {
  try {
    const { query, depth = 2 } = req.body;

    if (!query || typeof query !== 'string') {
      return res.status(400).json({ error: 'Query is required' });
    }

    console.log(`[Research] Starting agentic research on: "${query}"`);

    // Step 1: Search for relevant pages using direct function call
    const searchData = await performWebSearch(query, depth * 2);

    const researchResults = {
      query,
      searches: [],
      findings: [],
      summary: ''
    };

    // Step 2: Scrape top results using direct function call
    for (const result of searchData.results.slice(0, depth)) {
      try {
        const scrapeData = await performScrape(result.url, { maxLength: 3000 });

        researchResults.findings.push({
          title: result.title,
          url: result.url,
          content: scrapeData.content
        });

        researchResults.searches.push({
          query: result.title,
          url: result.url,
          status: 'success'
        });
      } catch (err) {
        researchResults.searches.push({
          query: result.title,
          url: result.url,
          status: 'failed',
          error: err.message
        });
      }
    }

    // Step 3: Generate summary using Ollama
    if (researchResults.findings.length > 0) {
      const combinedContent = researchResults.findings
        .map(f => `Source: ${f.title}\n${f.content}`)
        .join('\n\n---\n\n');

      const summaryController = new AbortController();
      const summaryTimeout = setTimeout(() => summaryController.abort(), 60000);

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
        researchResults.summary = summaryData.message?.content || 'Could not generate summary';
      }
    }

    console.log(`[Research] Completed: ${researchResults.findings.length} sources analyzed`);
    res.json(researchResults);
  } catch (error) {
    console.error('Research error:', error);
    res.status(500).json({ error: error.message || 'Research failed' });
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
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

module.exports = app;