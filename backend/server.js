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

const app = express();
const PORT = process.env.PORT || 3001;

// Configure multer for memory storage (we'll process and save manually)
const upload = multer({ storage: multer.memoryStorage() });

// Create service instances
const authService = new AuthService(process.env.JWT_SECRET);
const dataService = new DataService();

// Ollama API configuration
const OLLAMA_BASE_URL = process.env.OLLAMA_URL || 'http://localhost:11434';

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
    const { model, messages } = req.body;
    
    if (!model || !messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'Model and messages are required' });
    }

    const ollamaMessages = messages.map(msg => ({
      role: msg.role === 'system' ? 'system' : (msg.role === 'assistant' ? 'assistant' : 'user'),
      content: msg.text || msg.content || ''
    }));

    // Timeout for Ollama connection
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    const ollamaResponse = await fetch(`${OLLAMA_BASE_URL}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: model,
        messages: ollamaMessages,
        stream: true
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