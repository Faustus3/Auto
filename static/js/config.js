// Konfigurationsdatei für die Instagram Automation
const CONFIG = {
    // API-URL des Backend-Dienstes
    API_URL: "https://Faust3.pythonanywhere.com",
    // Ollama Chat API URL
    OLLAMA_URL: "https://ollama.sohaltweil.de",
    
    // Comfy-UI Einstellungen
    COMFY_UI: {
        URL: "https://comfy-ui.sohaltweil.de",
        DEFAULT_PROMPT: "Ein künstlerisches Bild im modernen Stil, mit lebendigen Farben und abstrakten Elementen",
        NEGATIVE_PROMPT: "schlechte Qualität, niedrige Auflösung, verschwommen, verpixelt"
    },
    
    // Posting-Zeitplan
    SCHEDULE: {
        TUESDAY: {
            enabled: true,
            time: "13:00"
        },
        WEDNESDAY: [
            {
                enabled: true,
                time: "11:00"
            },
            {
                enabled: true,
                time: "17:00"
            }
        ],
        THURSDAY: {
            enabled: true,
            time: "13:00"
        },
        FRIDAY: {
            enabled: true,
            time: "13:00"
        }
    },
    
    // E-Mail-Einstellungen
    EMAIL: {
        address: "theaterfreiburgfaust3@gmail.com",
        sendReminder: true
    }
};
