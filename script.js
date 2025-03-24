const config = {
    ollama_url: "https://ab45-79-230-56-124.ngrok-free.app", // Will update with ngrok URL
    debug: true,
    model: "gemma3:12b",
    retries: 3,
    timeout: 30000
};

// Add URL validation function
function isValidUrl(url) {
    try {
        new URL(url);
        return true;
    } catch (e) {
        return false;
    }
}

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
            'ngrok-skip-browser-warning': 'true',
            'Authorization': 'Bearer null' // Added for ngrok auth
        }
    },
    
    async fetch(url, options = {}) {
        const finalOptions = {
            ...options,
            mode: 'cors', // Changed back to cors mode
            credentials: 'omit',
            headers: this.defaults.headers
        };

        if (config.debug) {
            console.log('Request:', { 
                url, 
                method: options.method, 
                headers: finalOptions.headers,
                body: options.body 
            });
        }

        try {
            const response = await fetch(url, finalOptions);

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(errorText || ERRORS.OLLAMA);
            }

            return response;
        } catch (error) {
            console.error('Fetch error:', error);
            throw error;
        }
    }
};

// Modify the sendMessage function
async function sendMessage() {
    const userInput = document.getElementById('userInput');
    const message = userInput.value.trim();

    if (!message) return;

    // Validate Ollama URL before proceeding
    if (!isValidUrl(config.ollama_url)) {
        console.error('Invalid Ollama URL:', config.ollama_url);
        appendMessage('bot', 'Error: Invalid Ollama URL configuration');
        return;
    }

    appendMessage('user', message);
    userInput.value = '';

    const loadingId = appendMessage('bot', 'Thinking...');

    try {
        // Add debug log before making request
        console.log('Attempting to send request to:', `${config.ollama_url}/api/generate`);
        
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
        // Provide more specific error messages
        let errorMessage = error.message;
        if (error.message.includes('Failed to fetch')) {
            errorMessage = ERRORS.NGROK;
        }
        updateMessage(loadingId, `Error: ${errorMessage}`);
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