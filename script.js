const config = {
    ollama_url: "https://0c3a-3-121-217-249.ngrok-free.app",
    debug: true,
    model: "gemma3:12b",
    retries: 3,
    timeout: 30000
};

const ERRORS = {
    NGROK: 'Ngrok tunnel not accessible. Please check if ngrok is running.',
    OLLAMA: 'Ollama service not responding. Please check if Ollama is running.',
    TIMEOUT: 'Request timed out. Please try again.',
    MODEL: 'Model not loaded. Please run: ollama run gemma3:12b'
};

const API = {
    defaults: {
        headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'ngrok-skip-browser-warning': 'true'
        }
    },
    
    async fetch(url, options = {}) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), config.timeout);
        
        const finalOptions = {
            ...options,
            signal: controller.signal,
            headers: {
                ...this.defaults.headers,
                ...options.headers
            }
        };

        if (config.debug) {
            console.log('Request:', { 
                url, 
                method: options.method, 
                headers: finalOptions.headers,
                body: options.body 
            });
        }

        let lastError;
        for (let i = 0; i < config.retries; i++) {
            try {
                const response = await fetch(url, finalOptions);
                clearTimeout(timeoutId);

                if (response.status === 403) {
                    throw new Error(ERRORS.NGROK);
                }

                if (!response.ok) {
                    const errorText = await response.text();
                    throw new Error(errorText || ERRORS.OLLAMA);
                }

                return response;
            } catch (error) {
                lastError = error;
                if (error.name === 'AbortError') {
                    throw new Error(ERRORS.TIMEOUT);
                }
                if (i < config.retries - 1) {
                    await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
                    continue;
                }
                throw lastError;
            }
        }
    }
};

async function sendMessage() {
    const userInput = document.getElementById('userInput');
    const chatHistory = document.getElementById('chatHistory');
    const message = userInput.value.trim();

    if (!message) return;

    appendMessage('user', message);
    userInput.value = '';

    // Add loading indicator
    const loadingId = appendMessage('bot', 'Thinking...');

    try {
        const response = await API.fetch(`${config.ollama_url}/api/generate`, {
            method: 'POST',
            body: JSON.stringify({
                model: config.model,
                prompt: message,
                stream: false
            })
        });

        const data = await response.json();
        if (!data.response) {
            throw new Error('Invalid response from Ollama');
        }
        updateMessage(loadingId, data.response);
    } catch (error) {
        console.error('Chat error:', error);
        updateMessage(loadingId, `Error: ${error.message}`);
    }
}

function appendMessage(type, content) {
    const chatHistory = document.getElementById('chatHistory');
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${type}-message`;
    messageDiv.textContent = content;
    const messageId = Date.now();
    messageDiv.setAttribute('data-message-id', messageId);
    chatHistory.appendChild(messageDiv);
    chatHistory.scrollTop = chatHistory.scrollHeight;
    return messageId;
}

function updateMessage(messageId, content) {
    const messageDiv = document.querySelector(`[data-message-id="${messageId}"]`);
    if (messageDiv) {
        messageDiv.textContent = content;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('userInput').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            sendMessage();
        }
    });
});