// Funktionen für die Einstellungsseite
document.addEventListener('DOMContentLoaded', function() {
    // Nur auf der Einstellungsseite ausführen
    if (document.getElementById('saveScheduleButton')) {
        initSettingsPage();
    }
});

// Einstellungsseite initialisieren
function initSettingsPage() {
    // Zeitplan-Einstellungen
    const saveScheduleButton = document.getElementById('saveScheduleButton');
    
    // E-Mail-Einstellungen
    const saveEmailSettingsButton = document.getElementById('saveEmailSettingsButton');
    
    // ComfyUI-Einstellungen
    const saveComfyUISettingsButton = document.getElementById('saveComfyUISettingsButton');
    
    // Zeitplan speichern
    saveScheduleButton.addEventListener('click', async () => {
        const schedule = getScheduleFromForm();
        
        saveScheduleButton.disabled = true;
        saveScheduleButton.textContent = 'Speichere...';
        
        try {
            const result = await API.saveSchedule(schedule);
            
            if (result && result.success) {
                alert('Zeitplan wurde erfolgreich gespeichert.');
            } else {
                alert('Fehler beim Speichern des Zeitplans. Bitte versuchen Sie es erneut.');
            }
        } catch (error) {
            console.error('Fehler:', error);
            alert('Ein Fehler ist aufgetreten. Bitte versuchen Sie es später erneut.');
        } finally {
            saveScheduleButton.disabled = false;
            saveScheduleButton.textContent = 'Zeitplan speichern';
        }
    });
    
    // E-Mail-Einstellungen speichern
    saveEmailSettingsButton.addEventListener('click', async () => {
        const emailSettings = getEmailSettingsFromForm();
        
        saveEmailSettingsButton.disabled = true;
        saveEmailSettingsButton.textContent = 'Speichere...';
        
        try {
            const result = await API.saveEmailSettings(emailSettings);
            
            if (result && result.success) {
                alert('E-Mail-Einstellungen wurden erfolgreich gespeichert.');
            } else {
                alert('Fehler beim Speichern der E-Mail-Einstellungen. Bitte versuchen Sie es erneut.');
            }
        } catch (error) {
            console.error('Fehler:', error);
            alert('Ein Fehler ist aufgetreten. Bitte versuchen Sie es später erneut.');
        } finally {
            saveEmailSettingsButton.disabled = false;
            saveEmailSettingsButton.textContent = 'E-Mail-Einstellungen speichern';
        }
    });
    
    // ComfyUI-Einstellungen speichern
    saveComfyUISettingsButton.addEventListener('click', async () => {
        const comfyUISettings = getComfyUISettingsFromForm();
        
        saveComfyUISettingsButton.disabled = true;
        saveComfyUISettingsButton.textContent = 'Speichere...';
        
        try {
            const result = await API.saveComfyUISettings(comfyUISettings);
            
            if (result && result.success) {
                alert('ComfyUI-Einstellungen wurden erfolgreich gespeichert.');
            } else {
                alert('Fehler beim Speichern der ComfyUI-Einstellungen. Bitte versuchen Sie es erneut.');
            }
        } catch (error) {
            console.error('Fehler:', error);
            alert('Ein Fehler ist aufgetreten. Bitte versuchen Sie es später erneut.');
        } finally {
            saveComfyUISettingsButton.disabled = false;
            saveComfyUISettingsButton.textContent = 'ComfyUI-Einstellungen speichern';
        }
    });
    
    // Einstellungen aus der Konfiguration laden
    loadSettingsFromConfig();
}

// Zeitplan aus dem Formular auslesen
function getScheduleFromForm() {
    return {
        TUESDAY: {
            enabled: document.getElementById('tuesday-enabled').checked,
            time: document.getElementById('tuesday-time').value
        },
        WEDNESDAY: [
            {
                enabled: document.getElementById('wednesday-enabled1').checked,
                time: document.getElementById('wednesday-time1').value
            },
            {
                enabled: document.getElementById('wednesday-enabled2').checked,
                time: document.getElementById('wednesday-time2').value
            }
        ],
        THURSDAY: {
            enabled: document.getElementById('thursday-enabled').checked,
            time: document.getElementById('thursday-time').value
        },
        FRIDAY: {
            enabled: document.getElementById('friday-enabled').checked,
            time: document.getElementById('friday-time').value
        }
    };
}

// E-Mail-Einstellungen aus dem Formular auslesen
function getEmailSettingsFromForm() {
    return {
        address: document.getElementById('notificationEmail').value,
        sendReminder: document.getElementById('reminderEnabled').checked
    };
}

// ComfyUI-Einstellungen aus dem Formular auslesen
function getComfyUISettingsFromForm() {
    return {
        URL: document.getElementById('comfyuiUrl').value,
        DEFAULT_PROMPT: document.getElementById('defaultPrompt').value,
        NEGATIVE_PROMPT: document.getElementById('negativePrompt').value
    };
}

// Einstellungen aus der Konfiguration laden
function loadSettingsFromConfig() {
    // Zeitplan-Einstellungen
    document.getElementById('tuesday-enabled').checked = CONFIG.SCHEDULE.TUESDAY.enabled;
    document.getElementById('tuesday-time').value = CONFIG.SCHEDULE.TUESDAY.time;
    
    document.getElementById('wednesday-enabled1').checked = CONFIG.SCHEDULE.WEDNESDAY[0].enabled;
    document.getElementById('wednesday-time1').value = CONFIG.SCHEDULE.WEDNESDAY[0].time;
    document.getElementById('wednesday-enabled2').checked = CONFIG.SCHEDULE.WEDNESDAY[1].enabled;
    document.getElementById('wednesday-time2').value = CONFIG.SCHEDULE.WEDNESDAY[1].time;
    
    document.getElementById('thursday-enabled').checked = CONFIG.SCHEDULE.THURSDAY.enabled;
    document.getElementById('thursday-time').value = CONFIG.SCHEDULE.THURSDAY.time;
    
    document.getElementById('friday-enabled').checked = CONFIG.SCHEDULE.FRIDAY.enabled;
    document.getElementById('friday-time').value = CONFIG.SCHEDULE.FRIDAY.time;
    
    // E-Mail-Einstellungen
    document.getElementById('notificationEmail').value = CONFIG.EMAIL.address;
    document.getElementById('reminderEnabled').checked = CONFIG.EMAIL.sendReminder;
    
    // ComfyUI-Einstellungen
    document.getElementById('comfyuiUrl').value = CONFIG.COMFYUI.URL;
    document.getElementById('defaultPrompt').value = CONFIG.COMFYUI.DEFAULT_PROMPT;
    document.getElementById('negativePrompt').value = CONFIG.COMFYUI.NEGATIVE_PROMPT;
}