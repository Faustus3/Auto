const config = {
    ollama_url: "https://a3fa-18-199-106-113.ngrok-free.app"
};

const API = {
    defaults: {
        headers: {
            'Content-Type': 'application/json',
            'ngrok-skip-browser-warning': 'true',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Accept': 'application/json'
        }
    },
    
    async fetch(url, options = {}) {
        const finalOptions = {
            ...options,
            mode: 'cors',
            credentials: 'omit',
            headers: {
                ...this.defaults.headers,
                ...options.headers
            }
        };
        
        let retries = 0;
        const maxRetries = 3;
        
        while (retries < maxRetries) {
            try {
                const response = await fetch(url, finalOptions);
                
                if (response.status === 403) {
                    console.log(`Retry ${retries + 1}/${maxRetries}`);
                    finalOptions.headers = {
                        'Accept': '*/*',
                        'User-Agent': 'PostmanRuntime/7.32.3',
                        'Connection': 'keep-alive',
                        'ngrok-skip-browser-warning': 'true'
                    };
                    retries++;
                    continue;
                }
                
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}`);
                }
                
                return response;
            } catch (error) {
                if (retries === maxRetries - 1) throw error;
                retries++;
                await new Promise(resolve => setTimeout(resolve, 1000));
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
                model: "gemma3:12b",
                prompt: message,
                stream: false,
                options: {
                    temperature: 0.7,
                    top_p: 0.9
                }
            })
        });

        const data = await response.json();
        updateMessage(loadingId, data.response);
    } catch (error) {
        console.error('Error:', error);
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