// Funktionen für die Bildfreigabe-Seite
document.addEventListener('DOMContentLoaded', function() {
    // Nur auf der Freigabe-Seite ausführen
    if (document.getElementById('pendingImages')) {
        loadPendingImages();
        initApprovalActions();
    }
});

// Ausstehende Bilder laden
async function loadPendingImages() {
    const pendingContainer = document.getElementById('pendingImages');
    pendingContainer.innerHTML = '<p>Bilder werden geladen...</p>';
    
    try {
        const images = await API.getPendingImages();
        
        if (images.length === 0) {
            pendingContainer.innerHTML = '<p>Keine ausstehenden Bilder zur Freigabe gefunden.</p>';
            return;
        }
        
        pendingContainer.innerHTML = '';
        
        images.forEach(image => {
            const pendingItem = document.createElement('div');
            pendingItem.className = 'pending-item';
            pendingItem.dataset.id = image.id;
            
            pendingItem.innerHTML = `
                <img src="${image.url}" alt="${image.prompt.substring(0, 50)}...">
                <div class="pending-item-info">
                    <h3>Generiert am ${formatDate(image.created_at)}</h3>
                    <p>${image.prompt}</p>
                    <div class="pending-item-actions">
                        <button onclick="selectImage('${image.id}')">Auswählen</button>
                    </div>
                </div>
            `;
            
            pendingContainer.appendChild(pendingItem);
        });
        
        // Erstes Bild automatisch auswählen
        if (images.length > 0) {
            selectImage(images[0].id);
        }
    } catch (error) {
        console.error('Fehler beim Laden der ausstehenden Bilder:', error);
        pendingContainer.innerHTML = '<p>Fehler beim Laden der Bilder. Bitte versuchen Sie es später erneut.</p>';
    }
}

// Bild auswählen
async function selectImage(imageId) {
    // Aktives Bild markieren
    const pendingItems = document.querySelectorAll('.pending-item');
    pendingItems.forEach(item => {
        if (item.dataset.id === imageId) {
            item.classList.add('active');
        } else {
            item.classList.remove('active');
        }
    });
    
    // Bild in der Vorschau anzeigen
    const selectedImage = document.getElementById('selectedImage');
    const captionText = document.getElementById('captionText');
    const scheduledTime = document.getElementById('scheduledTime');
    
    try {
        // Hier würde normalerweise ein API-Aufruf stehen, um die Bilddetails zu laden
        // Für dieses Beispiel verwenden wir die Daten aus dem DOM
        const pendingItem = document.querySelector(`.pending-item[data-id="${imageId}"]`);
        const imageUrl = pendingItem.querySelector('img').src;
        
        selectedImage.src = imageUrl;
        selectedImage.dataset.id = imageId;
        captionText.value = ''; // Caption zurücksetzen
        
        // Geplante Zeit anzeigen (hier ein Beispiel)
        const nextPostingTime = getNextPostingTime();
        scheduledTime.textContent = nextPostingTime ? 
            `Geplant für ${formatDateTime(nextPostingTime)}` : 
            'Nicht geplant';
    } catch (error) {
        console.error('Fehler beim Auswählen des Bildes:', error);
        alert('Fehler beim Laden der Bilddetails. Bitte versuchen Sie es erneut.');
    }
}

// Freigabe-Aktionen initialisieren
function initApprovalActions() {
    const approveButton = document.getElementById('approveButton');
    const rejectButton = document.getElementById('rejectButton');
    const postNowButton = document.getElementById('postNowButton');
    const generateCaptionButton = document.getElementById('generateCaptionButton');
    const saveCaptionButton = document.getElementById('saveCaptionButton');
    const captionText = document.getElementById('captionText');
    
    // Caption generieren
    generateCaptionButton.addEventListener('click', async () => {
        const selectedImage = document.getElementById('selectedImage');
        const imageId = selectedImage.dataset.id;
        
        if (!imageId) {
            alert('Bitte wählen Sie zuerst ein Bild aus.');
            return;
        }
        
        generateCaptionButton.disabled = true;
        generateCaptionButton.textContent = 'Generiere...';
        
        try {
            const result = await API.generateCaption(imageId);
            
            if (result && result.caption) {
                captionText.value = result.caption;
            } else {
                alert('Fehler bei der Caption-Generierung. Bitte versuchen Sie es erneut.');
            }
        } catch (error) {
            console.error('Fehler:', error);
            alert('Ein Fehler ist aufgetreten. Bitte versuchen Sie es später erneut.');
        } finally {
            generateCaptionButton.disabled = false;
            generateCaptionButton.textContent = 'Caption generieren';
        }
    });
    
    // Caption speichern
    saveCaptionButton.addEventListener('click', () => {
        alert('Caption gespeichert!');
        // Hier könnte ein API-Aufruf zum Speichern der Caption erfolgen
    });
    
    // Bild freigeben
    approveButton.addEventListener('click', async () => {
        const selectedImage = document.getElementById('selectedImage');
        const imageId = selectedImage.dataset.id;
        const caption = captionText.value.trim();
        
        if (!imageId) {
            alert('Bitte wählen Sie zuerst ein Bild aus.');
            return;
        }
        
        if (!caption) {
            alert('Bitte geben Sie eine Caption ein oder generieren Sie eine.');
            return;
        }
        
        if (confirm('Möchten Sie dieses Bild für den nächsten geplanten Post freigeben?')) {
            approveButton.disabled = true;
            
            try {
                const result = await API.approveImage(imageId, caption);
                
                if (result && result.success) {
                    alert('Bild wurde erfolgreich freigegeben und wird zum geplanten Zeitpunkt gepostet.');
                    loadPendingImages(); // Liste aktualisieren
                } else {
                    alert('Fehler bei der Bildfreigabe. Bitte versuchen Sie es erneut.');
                }
            } catch (error) {
                console.error('Fehler:', error);
                alert('Ein Fehler ist aufgetreten. Bitte versuchen Sie es später erneut.');
            } finally {
                approveButton.disabled = false;
            }
        }
    });
    
    // Bild ablehnen
    rejectButton.addEventListener('click', async () => {
        const selectedImage = document.getElementById('selectedImage');
        const imageId = selectedImage.dataset.id;
        
        if (!imageId) {
            alert('Bitte wählen Sie zuerst ein Bild aus.');
            return;
        }
        
        if (confirm('Möchten Sie dieses Bild wirklich ablehnen? Es wird dauerhaft gelöscht.')) {
            rejectButton.disabled = true;
            
            try {
                const result = await API.rejectImage(imageId);
                
                if (result && result.success) {
                    alert('Bild wurde abgelehnt und gelöscht.');
                    loadPendingImages(); // Liste aktualisieren
                } else {
                    alert('Fehler beim Ablehnen des Bildes. Bitte versuchen Sie es erneut.');
                }
            } catch (error) {
                console.error('Fehler:', error);
                alert('Ein Fehler ist aufgetreten. Bitte versuchen Sie es später erneut.');
            } finally {
                rejectButton.disabled = false;
            }
        }
    });
    
    // Bild sofort posten
    postNowButton.addEventListener('click', async () => {
        const selectedImage = document.getElementById('selectedImage');
        const imageId = selectedImage.dataset.id;
        const caption = captionText.value.trim();
        
        if (!imageId) {
            alert('Bitte wählen Sie zuerst ein Bild aus.');
            return;
        }
        
        if (!caption) {
            alert('Bitte geben Sie eine Caption ein oder generieren Sie eine.');
            return;
        }
        
        if (confirm('Möchten Sie dieses Bild sofort auf Instagram posten?')) {
            postNowButton.disabled = true;
            
            try {
                const result = await API.postImageNow(imageId, caption);
                
                if (result && result.success) {
                    alert('Bild wurde erfolgreich auf Instagram gepostet.');
                    loadPendingImages(); // Liste aktualisieren
                } else {
                    alert('Fehler beim Posten des Bildes. Bitte versuchen Sie es erneut.');
                }
            } catch (error) {
                console.error('Fehler:', error);
                alert('Ein Fehler ist aufgetreten. Bitte versuchen Sie es später erneut.');
            } finally {
                postNowButton.disabled = false;
            }
        }
    });
}

// Nächste Posting-Zeit ermitteln
function getNextPostingTime() {
    const now = new Date();
    const day = now.getDay(); // 0 = Sonntag, 1 = Montag, ...
    const hours = now.getHours();
    const minutes = now.getMinutes();
    
    // Einfache Logik zur Bestimmung der nächsten Posting-Zeit
    // basierend auf dem konfigurierten Zeitplan
    
    // Beispiel: Nächster Zeitpunkt ist morgen um 13:00 Uhr
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(13, 0, 0, 0);
    
    return tomorrow;
}

// Datum formatieren
function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('de-DE', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
    });
}

// Datum und Uhrzeit formatieren
function formatDateTime(date) {
    return date.toLocaleDateString('de-DE', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}