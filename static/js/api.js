// API-Funktionen für die Kommunikation mit dem Backend
const API = {
    // Bilder abrufen
    getImages: async function() {
        try {
            const response = await fetch(`${CONFIG.API_URL}/api/images`);
            if (!response.ok) {
                throw new Error('Fehler beim Abrufen der Bilder');
            }
            return await response.json();
        } catch (error) {
            console.error('API-Fehler:', error);
            return [];
        }
    },
    
    // Bilder zur Freigabe abrufen
    getPendingImages: async function() {
        try {
            const response = await fetch(`${CONFIG.API_URL}/api/images/pending`);
            if (!response.ok) {
                throw new Error('Fehler beim Abrufen der ausstehenden Bilder');
            }
            return await response.json();
        } catch (error) {
            console.error('API-Fehler:', error);
            return [];
        }
    },
    
    // Bild generieren
    generateImage: async function(prompt) {
        try {
            const response = await fetch(`${CONFIG.API_URL}/api/generate`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ prompt })
            });
            if (!response.ok) {
                throw new Error('Fehler bei der Bildgenerierung');
            }
            return await response.json();
        } catch (error) {
            console.error('API-Fehler:', error);
            return null;
        }
    },
    
    // Bild freigeben
    approveImage: async function(imageId, caption) {
        try {
            const response = await fetch(`${CONFIG.API_URL}/api/images/${imageId}/approve`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ caption })
            });
            if (!response.ok) {
                throw new Error('Fehler bei der Bildfreigabe');
            }
            return await response.json();
        } catch (error) {
            console.error('API-Fehler:', error);
            return null;
        }
    },
    
    // Bild ablehnen
    rejectImage: async function(imageId) {
        try {
            const response = await fetch(`${CONFIG.API_URL}/api/images/${imageId}/reject`, {
                method: 'POST'
            });
            if (!response.ok) {
                throw new Error('Fehler bei der Bildablehnung');
            }
            return await response.json();
        } catch (error) {
            console.error('API-Fehler:', error);
            return null;
        }
    },
    
    // Bild sofort posten
    postImageNow: async function(imageId, caption) {
        try {
            const response = await fetch(`${CONFIG.API_URL}/api/images/${imageId}/post`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ caption })
            });
            if (!response.ok) {
                throw new Error('Fehler beim sofortigen Posten');
            }
            return await response.json();
        } catch (error) {
            console.error('API-Fehler:', error);
            return null;
        }
    },
    
    // Caption generieren
    generateCaption: async function(imageId) {
        try {
            const response = await fetch(`${CONFIG.API_URL}/api/images/${imageId}/caption`, {
                method: 'GET'
            });
            if (!response.ok) {
                throw new Error('Fehler bei der Caption-Generierung');
            }
            return await response.json();
        } catch (error) {
            console.error('API-Fehler:', error);
            return null;
        }
    },
    
    // Zeitplan speichern
    saveSchedule: async function(schedule) {
        try {
            const response = await fetch(`${CONFIG.API_URL}/api/settings/schedule`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(schedule)
            });
            if (!response.ok) {
                throw new Error('Fehler beim Speichern des Zeitplans');
            }
            return await response.json();
        } catch (error) {
            console.error('API-Fehler:', error);
            return null;
        }
    },
    
    // E-Mail-Einstellungen speichern
    saveEmailSettings: async function(settings) {
        try {
            const response = await fetch(`${CONFIG.API_URL}/api/settings/email`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(settings)
            });
            if (!response.ok) {
                throw new Error('Fehler beim Speichern der E-Mail-Einstellungen');
            }
            return await response.json();
        } catch (error) {
            console.error('API-Fehler:', error);
            return null;
        }
    },
    
    // ComfyUI-Einstellungen speichern
    saveComfyUISettings: async function(settings) {
        try {
            const response = await fetch(`${CONFIG.API_URL}/api/settings/comfyui`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(settings)
            });
            if (!response.ok) {
                throw new Error('Fehler beim Speichern der ComfyUI-Einstellungen');
            }
            return await response.json();
        } catch (error) {
            console.error('API-Fehler:', error);
            return null;
        }
    },
    
    // LLaMA-Chat-Nachricht senden
    sendChatMessage: async function(message) {
        try {
            const response = await fetch(`${CONFIG.API_URL}/api/llama/chat`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ message })
            });
            if (!response.ok) {
                throw new Error('Fehler beim Senden der Chat-Nachricht');
            }
            return await response.json();
        } catch (error) {
            console.error('API-Fehler:', error);
            return null;
        }
    }
};