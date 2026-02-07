/**
 * Prompt Service
 * Zentraler Service für alle System-Prompts mit intelligentem Context-Management
 * 
 * Features:
 * - Einheitliche Prompt-Verwaltung
 * - Kontext-basierte Prompt-Auswahl
 * - Template-Rendering mit Variablen
 * - Prompt-Kombination für komplexe Szenarien
 * - Versionierung und Changelog
 */

const { MASTER_PROMPTS, renderTemplate, combinePrompts, getPrompt } = require('./config/prompts');

class PromptService {
  constructor() {
    this.version = MASTER_PROMPTS.version;
    this.defaultLanguage = MASTER_PROMPTS.language;
    this.promptHistory = [];
  }

  // ============================================================================
  // BASIS-METHODEN
  // ============================================================================

  /**
   * Holt einen spezifischen Prompt
   * @param {string} path - Pfad im Prompt-Objekt (z.B. 'rag.contextWrapper')
   * @param {Object} variables - Template-Variablen
   * @returns {Object} { role: 'system', content: string }
   */
  get(path, variables = {}) {
    const content = getPrompt(path, variables);
    
    if (!content) {
      console.warn(`[PromptService] Prompt nicht gefunden: ${path}`);
      return null;
    }

    this.logPromptUsage(path, variables);
    
    return {
      role: 'system',
      content: content
    };
  }

  /**
   * Kombiniert mehrere Prompts zu einem System-Prompt
   * @param {Array<string>} paths - Array von Prompt-Pfaden
   * @param {Object} variables - Template-Variablen
   * @returns {Object} { role: 'system', content: string }
   */
  combine(paths, variables = {}) {
    const contents = paths
      .map(path => getPrompt(path, variables))
      .filter(content => content && content.length > 0);
    
    if (contents.length === 0) {
      return null;
    }

    const combined = combinePrompts(contents, '\n\n---\n\n');
    
    return {
      role: 'system',
      content: combined
    };
  }

  /**
   * Baut einen RAG-Prompt mit Kontext
   * @param {string} context - Gefundener Kontext aus Wissensdatenbank
   * @param {Object} options - Zusätzliche Optionen
   * @returns {Object} System-Prompt für RAG
   */
  buildRagPrompt(context, options = {}) {
    const {
      searchMethod = 'hybrid',
      resultCount = 0,
      includeToolInfo = false
    } = options;

    // Basis-Personality
    const basePrompt = this.get('basePersonality');
    
    // Tool-Info falls gewünscht
    let toolPrompt = '';
    if (includeToolInfo) {
      toolPrompt = this.get('tools.availableTools')?.content || '';
    }

    // RAG Kontext
    let ragContent;
    if (context && context.trim().length > 0) {
      ragContent = getPrompt('rag.contextWrapper', {
        CONTEXT: context
      });
      
      // Suchmethoden-Hinweis hinzufügen
      const methodHint = getPrompt('rag.searchMethodHint', {
        METHOD: searchMethod.toUpperCase(),
        COUNT: resultCount
      });
      
      ragContent = `${ragContent}\n\n${methodHint}`;
    } else {
      ragContent = getPrompt('rag.noResults');
    }

    // Kombinieren
    const finalContent = [basePrompt?.content, toolPrompt, ragContent]
      .filter(c => c && c.length > 0)
      .join('\n\n');

    return {
      role: 'system',
      content: finalContent
    };
  }

  /**
   * Baut einen Websearch-Prompt mit Kontext
   * @param {string} context - Gefundener Web-Kontext
   * @param {Object} options - Zusätzliche Optionen
   * @returns {Object} System-Prompt für Websearch
   */
  buildWebsearchPrompt(context, options = {}) {
    const {
      query = '',
      sourceCount = 0,
      includeBasePersonality = true
    } = options;

    const prompts = [];

    // Basis-Personality
    if (includeBasePersonality) {
      const base = this.get('basePersonality');
      if (base) prompts.push(base.content);
    }

    // Websearch Kontext
    let webContent;
    if (context && context.trim().length > 0) {
      webContent = getPrompt('websearch.contextWrapper', {
        CONTEXT: context
      });
      
      // Quellenangabe-Format hinzufügen
      const citationFormat = getPrompt('websearch.citationFormat');
      webContent = `${webContent}\n\n${citationFormat}`;
    } else {
      webContent = getPrompt('websearch.noResults');
    }
    
    prompts.push(webContent);

    return {
      role: 'system',
      content: prompts.join('\n\n---\n\n')
    };
  }

  /**
   * Baut einen kombinierten Prompt (RAG + Websearch)
   * @param {Object} contexts - { rag: string, websearch: string }
   * @param {Object} options - Zusätzliche Optionen
   * @returns {Object} Kombinierter System-Prompt
   */
  buildCombinedPrompt(contexts, options = {}) {
    const {
      ragContext = '',
      webContext = '',
      query = ''
    } = contexts;

    const hasRag = ragContext && ragContext.trim().length > 0;
    const hasWeb = webContext && webContext.trim().length > 0;

    // Basis-Personality
    const basePrompt = this.get('basePersonality')?.content || '';

    const sections = [basePrompt];

    // RAG Section
    if (hasRag) {
      const ragSection = getPrompt('rag.contextWrapper', {
        CONTEXT: ragContext
      });
      sections.push(`=== LOKALE WISSENSBASIS ===\n${ragSection}\n=== ENDE LOKALE WISSENSBASIS ===`);
    }

    // Websearch Section
    if (hasWeb) {
      const webSection = getPrompt('websearch.contextWrapper', {
        CONTEXT: webContext
      });
      const citationFormat = getPrompt('websearch.citationFormat');
      sections.push(`=== WEB-RECHERCHE ===\n${webSection}\n=== ENDE WEB-RECHERCHE ===\n\n${citationFormat}`);
    }

    // Kombinierte Anweisungen
    if (hasRag && hasWeb) {
      sections.push(`ANWEISUNGEN:
Du hast Zugriff auf sowohl lokale Wissensdatenbank als auch aktuelle Web-Informationen.
- Priorisiere Web-Informationen bei zeitsensitiven Fragen
- Nutze lokale Daten für persönliche/projektspezifische Informationen
- Zitiere Web-Quellen mit [1], [2], etc.
- Zitiere lokale Quellen mit [Quelle: Typ - Titel]
- Wenn die Quellen widersprüchlich sind, diskutiere dies offen`);
    }

    return {
      role: 'system',
      content: sections.filter(s => s && s.length > 0).join('\n\n---\n\n')
    };
  }

  // ============================================================================
  // SPEZIALISIERTE PROMPTS
  // ============================================================================

  /**
   * Prompt für Code-Assistent
   * @param {string} language - Programmiersprache (optional)
   * @returns {Object} System-Prompt
   */
  getCodeAssistantPrompt(language = null) {
    const base = this.get('basePersonality')?.content || '';
    const code = getPrompt('chat.codeAssistant');
    
    let content = `${base}\n\n${code}`;
    
    if (language) {
      content += `\n\nFOKUS-SPRACHE: ${language}\nBitte berücksichtige Best Practices und Idiome von ${language} in deinen Antworten.`;
    }

    return { role: 'system', content };
  }

  /**
   * Prompt für Analyse-Aufgaben
   * @returns {Object} System-Prompt
   */
  getAnalysisPrompt() {
    return this.combine([
      'basePersonality',
      'chat.analysis'
    ]);
  }

  /**
   * Prompt für zeitsensitive Fragen
   * @returns {Object} System-Prompt mit aktuellem Datum
   */
  getTimeSensitivePrompt() {
    const currentDate = new Date().toLocaleDateString('de-DE', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    return this.get('specialized.timeSensitive', {
      CURRENT_DATE: currentDate
    });
  }

  /**
   * Prompt für Faktencheck
   * @returns {Object} System-Prompt
   */
  getFactCheckPrompt() {
    return this.combine([
      'basePersonality',
      'specialized.factCheck'
    ]);
  }

  /**
   * Prompt für Lern-Assistent
   * @param {string} topic - Thema (optional)
   * @returns {Object} System-Prompt
   */
  getLearningPrompt(topic = null) {
    const prompt = this.combine([
      'basePersonality',
      'specialized.learning'
    ]);

    if (topic && prompt) {
      prompt.content += `\n\nAKTUELLES THEMA: ${topic}`;
    }

    return prompt;
  }

  /**
   * Prompt für Übersetzungen
   * @param {string} sourceLang - Ausgangssprache
   * @param {string} targetLang - Zielsprache
   * @returns {Object} System-Prompt
   */
  getTranslationPrompt(sourceLang, targetLang) {
    const base = this.get('specialized.translation');
    
    if (base) {
      base.content += `\n\nÜBERSETZUNG: ${sourceLang} → ${targetLang}`;
    }

    return base;
  }

  // ============================================================================
  // FEHLERBEHANDLUNG
  // ============================================================================

  /**
   * Error-Prompt für verschiedene Fehlertypen
   * @param {string} errorType - 'general', 'ollamaConnection', 'noResults'
   * @returns {Object} Error-System-Prompt
   */
  getErrorPrompt(errorType = 'general') {
    const validTypes = ['general', 'ollamaConnection', 'noResults'];
    
    if (!validTypes.includes(errorType)) {
      errorType = 'general';
    }

    return this.get(`errors.${errorType}`);
  }

  // ============================================================================
  // HILFSMETHODEN
  // ============================================================================

  /**
   * Loggt die Verwendung eines Prompts (für Analytics/Debugging)
   * @param {string} path - Prompt-Pfad
   * @param {Object} variables - Verwendete Variablen
   */
  logPromptUsage(path, variables) {
    this.promptHistory.push({
      path,
      variables: Object.keys(variables),
      timestamp: new Date().toISOString()
    });

    // History auf letzte 100 Einträge begrenzen
    if (this.promptHistory.length > 100) {
      this.promptHistory = this.promptHistory.slice(-100);
    }
  }

  /**
   * Gibt Prompt-Usage-Statistiken zurück
   * @returns {Object} Statistiken
   */
  getUsageStats() {
    const stats = {};
    
    for (const entry of this.promptHistory) {
      stats[entry.path] = (stats[entry.path] || 0) + 1;
    }

    return {
      totalUsage: this.promptHistory.length,
      byPrompt: stats,
      recentUsage: this.promptHistory.slice(-10)
    };
  }

  /**
   * Zeigt alle verfügbaren Prompt-Pfade
   * @returns {Array<string>} Liste aller Pfade
   */
  listAvailablePrompts() {
    const paths = [];
    
    const traverse = (obj, currentPath = '') => {
      for (const key of Object.keys(obj)) {
        const newPath = currentPath ? `${currentPath}.${key}` : key;
        
        if (typeof obj[key] === 'string') {
          paths.push(newPath);
        } else if (typeof obj[key] === 'object' && obj[key] !== null) {
          if (obj[key].content) {
            paths.push(newPath);
          } else {
            traverse(obj[key], newPath);
          }
        }
      }
    };

    traverse(MASTER_PROMPTS);
    return paths;
  }

  /**
   * Validiert einen Prompt-Pfad
   * @param {string} path - Zu prüfender Pfad
   * @returns {boolean} true wenn gültig
   */
  isValidPath(path) {
    const parts = path.split('.');
    let current = MASTER_PROMPTS;
    
    for (const part of parts) {
      if (current[part] === undefined) {
        return false;
      }
      current = current[part];
    }
    
    return typeof current === 'string' || 
           (typeof current === 'object' && current.content);
  }

  /**
   * Gibt Prompt-Version und Metadaten zurück
   * @returns {Object} Version-Info
   */
  getVersionInfo() {
    return {
      version: this.version,
      language: this.defaultLanguage,
      totalPrompts: this.listAvailablePrompts().length,
      lastUpdated: new Date().toISOString()
    };
  }
}

// Singleton-Instanz exportieren
module.exports = new PromptService();
