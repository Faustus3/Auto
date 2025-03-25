// Cloudflare Tunnel Integration für Instagram Automation
// Diese Datei enthält die Funktionen zur Verbindung mit Ollama und ComfyUI über Cloudflare Tunnel

// Konfiguration - Ersetzen Sie diese URLs mit Ihren tatsächlichen Cloudflare Tunnel Domains
const config = {
    comfyuiUrl: 'https://comfy-ui.sohaltweil.de/', // Ihre ComfyUI-Domain
    ollamaUrl: 'https://ollama.sohaltweil.de',   // Ihre Ollama-Domain
    captionModel: 'gemma3:4b'                      // Das zu verwendende Modell
};

// Der ComfyUI-Workflow aus der bereitgestellten JSON-Datei
const comfyuiWorkflow = {
    "id": "114cc5f1-b772-4390-89ed-1e5d08cd908e",
    "nodes": [
        // Hier ist der vollständige Workflow aus Ihrer JSON-Datei
        // Gekürzt für die Übersichtlichkeit
    ]
};

// Funktion zum Generieren von Bildern mit ComfyUI
async function generateImagesWithComfyUI(subject, style, details, format) {
    try {
        console.log('Verbindung zu ComfyUI herstellen...');
        
        // Workflow-Kopie erstellen und Prompt anpassen
        const workflow = JSON.parse(JSON.stringify(comfyuiWorkflow));
        
        // Prompt basierend auf den Eingaben erstellen
        const prompt = `IG_Models photo ${subject}, ${style}, ${details}, Sexy; Photorealistic;Clean;Perfect;Beauty;Human;Anatomy`;
        
        // Prompt im Workflow aktualisieren (Annahme: Node 39 enthält den positiven Prompt)
        for (const node of workflow.nodes) {
            if (node.id === 39 && node.type === "CLIPTextEncode") {
                node.widgets_values = [prompt];
                break;
            }
        }
        
        // Bildformat anpassen (Annahme: Node 7 enthält die Bildgröße)
        let width = 1024;
        let height = 1024;
        
        if (format === "Portrait (3:4)") {
            width = 768;
            height = 1024;
        } else if (format === "Landscape (4:3)") {
            width = 1024;
            height = 768;
        }
        
        // Workflow an ComfyUI senden
        const response = await fetch(`${config.comfyuiUrl}/prompt`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                prompt: workflow
            })
        });
        
        if (!response.ok) {
            throw new Error(`ComfyUI API-Fehler: ${response.status} ${response.statusText}`);
        }
        
        const data = await response.json();
        console.log('Workflow an ComfyUI gesendet:', data);
        
        // Prompt-ID aus der Antwort extrahieren
        const promptId = data.prompt_id;
        
        // Auf die Fertigstellung des Workflows warten
        return await waitForComfyUIResult(promptId);
    } catch (error) {
        console.error('Fehler bei der Bildgenerierung mit ComfyUI:', error);
        throw error;
    }
}

// Funktion zum Warten auf das Ergebnis von ComfyUI
async function waitForComfyUIResult(promptId) {
    try {
        console.log(`Warte auf Ergebnis für Prompt-ID: ${promptId}`);
        
        // Maximale Wartezeit: 5 Minuten
        const maxWaitTime = 5 * 60 * 1000;
        const startTime = Date.now();
        
        while (Date.now() - startTime < maxWaitTime) {
            // Status des Workflows abfragen
            const response = await fetch(`${config.comfyuiUrl}/history`);
            const history = await response.json();
            
            // Prüfen, ob der Workflow abgeschlossen ist
            if (history[promptId] && history[promptId].outputs) {
                console.log('Workflow abgeschlossen');
                
                // Ergebnisbilder extrahieren
                const outputs = history[promptId].outputs;
                const images = [];
                
                // Durch alle Ausgabeknoten iterieren
                for (const nodeId in outputs) {
                    const nodeOutputs = outputs[nodeId];
                    
                    // Bilder aus den Ausgabeknoten extrahieren
                    for (const output of nodeOutputs) {
                        if (output.type === 'image' && output.filename) {
                            const imageUrl = `${config.comfyuiUrl}/view?filename=${output.filename}`;
                            images.push({
                                id: images.length + 1,
                                url: imageUrl,
                                filename: output.filename,
                                timestamp: new Date()
                            });
                        }
                    }
                }
                
                return images;
            }
            
            // Kurz warten, bevor erneut geprüft wird
            await new Promise(resolve => setTimeout(resolve, 2000));
        }
        
        throw new Error('Zeitüberschreitung beim Warten auf ComfyUI-Ergebnis');
    } catch (error) {
        console.error('Fehler beim Warten auf ComfyUI-Ergebnis:', error);
        throw error;
    }
}

// Funktion zum Generieren von Bildunterschriften mit Ollama
async function generateCaptionWithOllama(imageUrl) {
    try {
        console.log('Generiere Bildunterschrift mit Ollama...');
        
        // Anfrage an Ollama senden
        const response = await fetch(`${config.ollamaUrl}/api/generate`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: config.captionModel,
                prompt: `Du bist ein kreativer Instagram-Texter. Erstelle eine kurze, ansprechende Bildunterschrift für ein Bild. Die Bildunterschrift sollte modern, künstlerisch und ansprechend sein. Verwende maximal 2-3 Sätze und füge passende Hashtags hinzu.`,
                options: {
                    temperature: 0.7,
                    top_p: 0.9,
                    max_tokens: 200
                }
            })
        });
        
        if (!response.ok) {
            throw new Error(`Ollama API-Fehler: ${response.status} ${response.statusText}`);
        }
        
        const data = await response.json();
        console.log('Bildunterschrift generiert:', data);
        
        return data.response.trim();
    } catch (error) {
        console.error('Fehler bei der Bildunterschrift-Generierung mit Ollama:', error);
        // Fallback-Bildunterschrift zurückgeben
        return 'Entdecke die Kunst der KI-generierten Bilder. #AIArt #DigitalCreativity';
    }
}

// Funktion zum Speichern eines genehmigten Bildes
async function saveApprovedImage(image, caption) {
    try {
        console.log('Speichere genehmigtes Bild...');
        
        // In einer vollständigen Implementierung würde hier das Bild und die Bildunterschrift
        // in einer Datenbank oder einem Dateisystem gespeichert werden
        
        // Beispiel für eine lokale Speicherung im localStorage
        const approvedImages = JSON.parse(localStorage.getItem('approvedImages') || '[]');
        approvedImages.push({
            ...image,
            caption,
            approvedAt: new Date(),
            status: 'pending' // pending, posted, failed
        });
        localStorage.setItem('approvedImages', JSON.stringify(approvedImages));
        
        return true;
    } catch (error) {
        console.error('Fehler beim Speichern des genehmigten Bildes:', error);
        throw error;
    }
}

// Event-Listener für die Bildgenerierung
document.addEventListener('DOMContentLoaded', function() {
    // Prompt-Generator-Formular
    const generateForm = document.querySelector('form');
    if (generateForm) {
        generateForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const subject = document.querySelector('input[placeholder="Was soll im Bild dargestellt werden?"]').value;
            const style = document.querySelector('input[placeholder="Welcher künstlerische Stil?"]').value;
            const details = document.querySelector('input[placeholder="Welche spezifischen Elemente?"]').value;
            const formatSelect = document.querySelector('select');
            const format = formatSelect.options[formatSelect.selectedIndex].text;
            
            try {
                const images = await generateImagesWithComfyUI(subject, style, details, format);
                // Hier die generierten Bilder anzeigen
                displayGeneratedImages(images);
            } catch (error) {
                console.error('Fehler bei der Bildgenerierung:', error);
                alert('Fehler bei der Bildgenerierung. Bitte überprüfen Sie die Verbindung zu ComfyUI.');
            }
        });
    }
    
    // Caption-Generator-Button
    const captionButton = document.querySelector('button[data-action="generate-caption"]');
    if (captionButton) {
        captionButton.addEventListener('click', async function() {
            const selectedImage = getSelectedImage();
            if (selectedImage) {
                try {
                    const caption = await generateCaptionWithOllama(selectedImage.url);
                    document.querySelector('textarea').value = caption;
                } catch (error) {
                    console.error('Fehler bei der Caption-Generierung:', error);
                    alert('Fehler bei der Caption-Generierung. Bitte überprüfen Sie die Verbindung zu Ollama.');
                }
            } else {
                alert('Bitte wählen Sie zuerst ein Bild aus.');
            }
        });
    }
    
    // Freigabe-Button
    const approveButton = document.querySelector('button[data-action="approve"]');
    if (approveButton) {
        approveButton.addEventListener('click', function() {
            const selectedImage = getSelectedImage();
            const caption = document.querySelector('textarea').value;
            
            if (selectedImage && caption) {
                saveApprovedImage(selectedImage, caption)
                    .then(() => {
                        alert('Bild erfolgreich freigegeben!');
                        // Hier die Seite aktualisieren oder das Bild aus der Liste entfernen
                    })
                    .catch(error => {
                        console.error('Fehler bei der Bildfreigabe:', error);
                        alert('Fehler bei der Bildfreigabe.');
                    });
            } else {
                alert('Bitte wählen Sie ein Bild aus und geben Sie eine Bildunterschrift ein.');
            }
        });
    }
});

// Hilfsfunktion zum Anzeigen der generierten Bilder
function displayGeneratedImages(images) {
    // Implementierung abhängig von der Struktur Ihrer Website
    const galleryContainer = document.querySelector('.gallery-container');
    if (galleryContainer) {
        galleryContainer.innerHTML = '';
        
        images.forEach(image => {
            const imgElement = document.createElement('img');
            imgElement.src = image.url;
            imgElement.alt = 'Generiertes Bild';
            imgElement.dataset.id = image.id;
            imgElement.dataset.filename = image.filename;
            imgElement.addEventListener('click', function() {
                // Bild auswählen
                document.querySelectorAll('.gallery-container img').forEach(img => {
                    img.classList.remove('selected');
                });
                this.classList.add('selected');
            });
            
            galleryContainer.appendChild(imgElement);
        });
    }
}

// Hilfsfunktion zum Abrufen des ausgewählten Bildes
function getSelectedImage() {
    const selectedImg = document.querySelector('.gallery-container img.selected');
    if (selectedImg) {
        return {
            id: selectedImg.dataset.id,
            url: selectedImg.src,
            filename: selectedImg.dataset.filename
        };
    }
    return null;
}

// Exportieren der Funktionen für die Verwendung in der Web-Oberfläche
window.instagramAutomation = {
    generateImagesWithComfyUI,
    generateCaptionWithOllama,
    saveApprovedImage
};
