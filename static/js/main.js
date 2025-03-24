// Hauptfunktionalität der Anwendung
document.addEventListener('DOMContentLoaded', function() {
    // Prompt-Generator initialisieren
    initPromptGenerator();
    
    // LLaMA-Chat initialisieren
    initLLamaChat();
});

// Prompt-Generator initialisieren
function initPromptGenerator() {
    const subjectInput = document.getElementById('subject');
    const styleInput = document.getElementById('style');
    const detailsInput = document.getElementById('details');
    const formatSelect = document.getElementById('format');
    const finalPromptTextarea = document.getElementById('finalPrompt');
    const generateButton = document.getElementById('generateButton');
    
    if (!subjectInput || !styleInput || !detailsInput || !formatSelect || !finalPromptTextarea || !generateButton) {
        return; // Nicht auf der richtigen Seite
    }
    
    // Prompt aktualisieren, wenn Eingaben geändert werden
    const updatePrompt = () => {
        const subject = subjectInput.value.trim();
        const style = styleInput.value.trim();
        const details = detailsInput.value.trim();
        const format = formatSelect.value;
        
        let prompt = '';
        
        if (subject) {
            prompt += subject;
            
            if (style) {
                prompt += ` im Stil von ${style}`;
            }
            
            if (details) {
                prompt += `, ${details}`;
            }
            
            if (format) {
                prompt += `, ${format} Format`;
            }
        } else {
            prompt = CONFIG.COMFYUI.DEFAULT_PROMPT;
        }
        
        finalPromptTextarea.value = prompt;
    };
    
    subjectInput.addEventListener('input', updatePrompt);
    styleInput.addEventListener('input', updatePrompt);
    detailsInput.addEventListener('input', updatePrompt);
    formatSelect.addEventListener('change', updatePrompt);
    
    // Initial aktualisieren
    updatePrompt();
    
    // Bild generieren
    generateButton.addEventListener('click', async () => {
        const prompt = finalPromptTextarea.value.trim();
        
        if (!prompt) {
            alert('Bitte geben Sie einen Prompt ein.');
            return;
        }
        
        generateButton.disabled = true;
        generateButton.textContent = 'Generiere...';
        
        try {
            const result = await API.generateImage(prompt);
            
            if (result && result.success) {
                alert('Bild wurde erfolgreich generiert und zur Freigabe hinzugefügt.');
                // Optional: Zur Freigabe-Seite weiterleiten
                // window.location.href = 'approval.html';
            } else {
                alert('Fehler bei der Bildgenerierung. Bitte versuchen Sie es erneut.');
            }
        } catch (error) {
            console.error('Fehler:', error);
            alert('Ein Fehler ist aufgetreten. Bitte versuchen Sie es später erneut.');
        } finally {
            generateButton.disabled = false;
            generateButton.textContent = 'Bild generieren';
        }
    });
}

// LLaMA-Chat initialisieren
function initLLamaChat() {
    const chatMessages = document.getElementById('chatMessages');
    const chatInput = document.getElementById('chatInput');
    const sendButton = document.getElementById('sendButton');
    
    if (!chatMessages || !chatInput || !sendButton) {
        return; // Nicht auf der richtigen Seite
    }
    
    // Nachricht zum Chat hinzufügen
    const addMessage = (message, isUser) => {
        const messageElement = document.createElement('div');
        messageElement.className = isUser ? 'user-message' : 'llama-message';
        messageElement.innerHTML = `
            <div class="message-content">
                <p>${message}</p>
                <span class="message-time">${new Date().toLocaleTimeString()}</span>
            </div>
        `;
        
        chatMessages.appendChild(messageElement);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    };
    
    // Willkommensnachricht
    addMessage('Hallo! Ich bin LLaMA. Wie kann ich Ihnen bei der Bildgenerierung oder Instagram-Automatisierung helfen?', false);
    
    // Nachricht senden
    const sendMessage = async () => {
        const message = chatInput.value.trim();
        
        if (!message) {
            return;
        }
        
        addMessage(message, true);
        chatInput.value = '';
        
        try {
            const response = await API.sendChatMessage(message);
            
            if (response && response.reply) {
                addMessage(response.reply, false);
            } else {
                addMessage('Entschuldigung, ich konnte keine Antwort generieren. Bitte versuchen Sie es erneut.', false);
            }
        } catch (error) {
            console.error('Chat-Fehler:', error);
            addMessage('Ein Fehler ist aufgetreten. Bitte versuchen Sie es später erneut.', false);
        }
    };
    
    sendButton.addEventListener('click', sendMessage);
    
    chatInput.addEventListener('keypress', (event) => {
        if (event.key === 'Enter') {
            sendMessage();
        }
    });
}