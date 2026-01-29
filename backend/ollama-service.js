/**
 * Ollama Service
 * Handles communication with the Ollama API for AI text generation
 */

const fetch = require('node-fetch');

class OllamaService {
  constructor(ollamaUrl) {
    this.ollamaUrl = ollamaUrl;
  }

  // Generate text using Ollama
  async generateText(model, prompt, stream = false, system = '', context = []) {
    try {
      const requestBody = {
        model,
        prompt,
        stream,
        system,
        context
      };

      const response = await fetch(`${this.ollamaUrl}/api/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Ollama API Fehler: ${response.status} - ${errorText}`);
      }

      if (stream) {
        // Handle streaming response
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let result = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value);
          // Parse JSON chunks and extract the response
          try {
            const data = JSON.parse(chunk);
            if (data.response) {
              result += data.response;
            }
          } catch (e) {
            // If not JSON, just append the chunk
            result += chunk;
          }
        }

        return { response: result };
      } else {
        // Handle regular response
        const data = await response.json();
        return { response: data.response };
      }
    } catch (error) {
      throw new Error(`Textgenerierung fehlgeschlagen: ${error.message}`);
    }
  }

  // Check Ollama service status
  async checkStatus() {
    try {
      const response = await fetch(`${this.ollamaUrl}/api/tags`);

      if (response.ok) {
        const data = await response.json();
        return {
          status: 'online',
          models: data.models || [],
          timestamp: new Date().toISOString()
        };
      } else {
        return {
          status: 'offline',
          error: `Ollama nicht erreichbar: ${response.status}`,
          timestamp: new Date().toISOString()
        };
      }
    } catch (error) {
      return {
        status: 'offline',
        error: `Ollama nicht erreichbar: ${error.message}`,
        timestamp: new Date().toISOString()
      };
    }
  }
}

module.exports = OllamaService;