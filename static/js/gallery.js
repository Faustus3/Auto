// Funktionen für die Galerie-Ansicht
document.addEventListener('DOMContentLoaded', function() {
    // Nur auf der Galerie-Seite ausführen
    if (document.getElementById('imageGallery')) {
        loadGalleryImages();
    }
});

// Bilder für die Galerie laden
async function loadGalleryImages() {
    const gallery = document.getElementById('imageGallery');
    gallery.innerHTML = '<p>Bilder werden geladen...</p>';
    
    try {
        const images = await API.getImages();
        
        if (images.length === 0) {
            gallery.innerHTML = '<p>Keine Bilder gefunden. Generieren Sie neue Bilder mit dem Prompt-Generator.</p>';
            return;
        }
        
        gallery.innerHTML = '';
        
        images.forEach(image => {
            const galleryItem = document.createElement('div');
            galleryItem.className = 'gallery-item';
            
            galleryItem.innerHTML = `
                <img src="${image.url}" alt="${image.prompt.substring(0, 50)}...">
                <div class="gallery-item-overlay">
                    <p>${formatDate(image.created_at)}</p>
                    <div class="gallery-item-actions">
                        <button onclick="viewImageDetails('${image.id}')">Details</button>
                        <button onclick="deleteImage('${image.id}')">Löschen</button>
                    </div>
                </div>
            `;
            
            gallery.appendChild(galleryItem);
        });
    } catch (error) {
        console.error('Fehler beim Laden der Galerie:', error);
        gallery.innerHTML = '<p>Fehler beim Laden der Bilder. Bitte versuchen Sie es später erneut.</p>';
    }
}

// Bilderdetails anzeigen
function viewImageDetails(imageId) {
    // Hier könnte ein Modal mit Bilddetails angezeigt werden
    alert(`Bilddetails für ID: ${imageId}`);
}

// Bild löschen
function deleteImage(imageId) {
    if (confirm('Möchten Sie dieses Bild wirklich löschen?')) {
        // Hier könnte die API zum Löschen aufgerufen werden
        alert(`Bild mit ID ${imageId} wird gelöscht`);
    }
}

// Datum formatieren
function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('de-DE', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}