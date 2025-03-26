// Helper function to get DOM elements and handle missing elements
function getDomElements(elements) {
    const result = {};
    for (const [key, query] of Object.entries(elements)) {
        result[key] = document.querySelector(query);
        if (!result[key]) {
            throw new Error(`DOM element '${query}' not found`);
        }
    }
    return result;
}

// Debounce function to prevent excessive function calls
const debounce = (fn, delay = 300) => {
    let timeout;
    return function(...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => fn.apply(this, args), delay);
    };
};

// Configuration constants
const CONFIG = {
    DEFAULT_PROMPT: 'Erstellen Sie ein beeindruckendes Bild',
    NOTIFICATION_DURATION: 3000,
};

// Prompt Generator
function initPromptGenerator() {
    try {
        const elements = {
            subject: '#subject',
            style: '#style',
            details: '#details',
            format: '#format',
            finalPrompt: '#finalPrompt',
            generateButton: '#generateButton'
        };

        const {
            subject,
            style,
            details,
            format,
            finalPrompt,
            generateButton
        } = getDomElements(elements);

        const updatePrompt = debounce(() => {
            const promptParts = [];
            if (subject.value.trim()) {
                promptParts.push(subject.value.trim());
                if (style.value.trim()) {
                    promptParts.push(`im Stil von ${style.value.trim()}`);
                }
                if (details.value.trim()) {
                    promptParts.push(`${details.value.trim()}`);
                }
                if (format.value.trim()) {
                    promptParts.push(`${format.value.trim()} Format`);
                }
            }
            finalPrompt.value = promptParts.join(', ') || CONFIG.DEFAULT_PROMPT;
        });

        // Event listeners
        subject.addEventListener('input', updatePrompt);
        style.addEventListener('input', updatePrompt);
        details.addEventListener('input', updatePrompt);
        format.addEventListener('change', updatePrompt);

        // Initial prompt update
        updatePrompt();

        // Image generation
        generateButton.addEventListener('click', async () => {
            try {
                generateButton.disabled = true;
                generateButton.textContent = 'Generiere...';

                const prompt = finalPrompt.value.trim();
                if (!prompt) {
                    throw new Error('Bitte geben Sie einen Prompt ein');
                }

                const result = await API.generateImage(prompt);
                
                if (result?.success) {
                    showNotification('Bild wurde erfolgreich generiert und zur Freigabe hinzugefügt', 'success');
                    // Optional: Weiterleitung zur Freigabeseite
                    // window.location.href = 'approval.html';
                } else {
                    showNotification('Fehler bei der Bildgenerierung. Bitte versuchen Sie es erneut.', 'error');
                }
            } catch (error) {
                console.error('Fehler:', error);
                showNotification('Ein Fehler ist aufgetreten. Bitte versuchen Sie es später erneut.', 'error');
            } finally {
                generateButton.disabled = false;
                generateButton.textContent = 'Bild generieren';
            }
        });

    } catch (error) {
        console.error('Fehler bei der Initialisierung des Prompt-Generators:', error);
    }
}

// LLaMA Chat
function initLLamaChat() {
    try {
        const elements = {
            chatMessages: '#chatMessages',
            chatInput: '#chatInput',
            sendButton: '#sendButton'
        };

        const {
            chatMessages,
            chatInput,
            sendButton
        } = getDomElements(elements);

        let isTyping = false;

        // Nachrichten hinzufügen
        function addMessage(message, isUser) {
            const messageElement = document.createElement('div');
            messageElement.className = `message ${isUser ? 'user' : 'assistant'}`;
            messageElement.innerHTML = `
                <div class="message-content">
                    <p>${message}</p>
                    <span class="message-time">${new Date().toLocaleTimeString()}</span>
                </div>
            `;
            chatMessages.appendChild(messageElement);
            chatMessages.scrollTop = chatMessages.scrollHeight;
        }

        // Tippen-Indikator
        function setTypingIndicator(active) {
            isTyping = active;
            sendButton.disabled = active;
            chatInput.disabled = active;
        }

        // Chat-Nachricht senden
        async function sendMessage(message) {
            try {
                setTypingIndicator(true);
                addMessage(message, true);
                chatInput.value = '';

                const response = await API.sendChatMessage(message);
                
                if (response?.reply) {
                    addMessage(response.reply, false);
                } else {
                    addMessage('Entschuldigung, ich konnte keine Antwort generieren. Bitte versuchen Sie es erneut.', false);
                }
            } catch (error) {
                console.error('Chat-Fehler:', error);
                addMessage('Ein Fehler ist aufgetreten. Bitte versuchen Sie es später erneut.', false);
            } finally {
                setTypingIndicator(false);
            }
        }

        // Event listener für Senden
        sendButton.addEventListener('click', sendMessage);
        chatInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') sendMessage();
        });

        // Willkommensnachricht
        addMessage('Hallo! Ich bin LLaMA. Wie kann ich Ihnen bei der Bildgenerierung oder Instagram-Automatisierung helfen?', false);
    } catch (error) {
        console.error('Fehler bei der Initialisierung des LLaMA Chats:', error);
    }
}

// Benutzerfreundliche Fehleranzeige
function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.remove();
    }, CONFIG.NOTIFICATION_DURATION);
}

// Initialisierung
document.addEventListener('DOMContentLoaded', () => {
    try {
        initPromptGenerator();
        initLLamaChat();
    } catch (error) {
        console.error('Fehler bei der Initialisierung:', error);
        showNotification('Eine kritische Fehler ist aufgetreten. Bitte laden Sie die Seite neu.', 'error');
    }
});

// Cleanup
window.addEventListener('beforeunload', () => {
    // Bereinigen von Event-Listenern
    document.removeEventListener('DOMContentLoaded', () => {});
});
