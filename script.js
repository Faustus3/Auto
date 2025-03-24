const config = {
    ollama_url: "https://9212-3-121-217-249.ngrok-free.app", // Use local URL first for testing
    debug: true
};

// Add error constants
const ERRORS = {
    NGROK: 'Ngrok tunnel not accessible. Please check if ngrok is running.',
    OLLAMA: 'Ollama service not responding. Please check if Ollama is running.',
    TIMEOUT: 'Request timed out. Please try again.'
};

const API = {
    defaults: {
        headers: {
            'Content-Type': 'application/json'
        }
    },
    
    async fetch(url, options = {}) {
        const finalOptions = {
            ...options,
            headers: this.defaults.headers
        };

        if (config.debug) {
            console.log('Request:', { url, options: finalOptions });
        }

        try {
            const response = await fetch(url, finalOptions);
            
            if (config.debug) {
                console.log('Response status:', response.status);
            }

            if (!response.ok) {
                const errorText = await response.text();
                console.error('Response error:', errorText);
                throw new Error(`Server error: ${response.status}`);
            }

            return response;
        } catch (error) {
            console.error('Fetch error:', error);
            throw error;
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
                model: "gemma3:12b",
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