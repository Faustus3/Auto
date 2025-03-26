// Konfigurationsdatei für die Instagram Automation
const CONFIG = {
    // API-URL des Backend-Dienstes
    API_URL: "https://Faust3.pythonanywhere.com",
    // OpenRouter API Configuration
    OPENROUTER: {
        URL: "https://openrouter.ai/api/v1",
        API_KEY: "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", // Get from https://openrouter.ai/keys
        DEFAULT_MODEL: "meta-llama/llama-2-70b-chat"
    },
    
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
