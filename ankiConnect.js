window.ankiConnect = {
    invoke: async function (action, version, params = {}) {
        try {
            const request = { action, version, params };
            console.log(`Sending request to AnkiConnect:`, request);

            // Get Anki Connect URL from storage, with fallback to default
            const defaultUrl = 'http://127.0.0.1:8765';
            const result = await chrome.storage.local.get('ankiConnectUrl');
            const ankiConnectUrl = result.ankiConnectUrl || defaultUrl;

            const response = await fetch(ankiConnectUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(request)
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();

            if (!data || typeof data !== 'object') {
                throw new Error('Invalid response format from AnkiConnect');
            }
            if (!('error' in data) || !('result' in data)) {
                throw new Error('Response missing required fields');
            }
            if (data.error) {
                throw new Error(data.error);
            }

            return data.result;
        } catch (error) {
            console.error('AnkiConnect Error:', error);
            throw error;
        }
    },

    addToAnki: async function (selectedText, explanation, pageUrl, pageTitle, surroundingContext, category) {
        try {
            // Validate input parameters
            if (!selectedText || !explanation) {
                throw new Error('Selected text and explanation are required');
            }

            // Check if AnkiConnect is available
            await this.invoke('version', 6);

            // Get configurable settings
            const settings = await chrome.storage.local.get([
                'ankiModelName', // For backward compatibility
                'ankiTags', // For backward compatibility
                'categories'
            ]);

            const categories = settings.categories || [];

            // Determine category-specific settings
            let deckName = 'WebExplanations';
            let modelName = settings.ankiModelName || 'WebExplanationTemplate';
            let tags = ['web_explanation']; // Default tag

            if (category && categories.length > 0) {
                // Try to find the category in the user-defined categories
                const categoryObj = categories.find(cat => cat.name === category);
                if (categoryObj) {
                    deckName = categoryObj.deckName || categories[0]?.deckName || 'WebExplanations';
                    modelName = categoryObj.ankiModelName || settings.ankiModelName || 'WebExplanationTemplate';
                    // Parse tags from category
                    if (categoryObj.ankiTags) {
                        if (typeof categoryObj.ankiTags === 'string') {
                            tags = categoryObj.ankiTags.split(',').map(tag => tag.trim()).filter(tag => tag.length > 0);
                        } else if (Array.isArray(categoryObj.ankiTags)) {
                            tags = categoryObj.ankiTags;
                        }
                    } else if (settings.ankiTags) {
                        // Fallback to global settings for backward compatibility
                        if (typeof settings.ankiTags === 'string') {
                            tags = settings.ankiTags.split(',').map(tag => tag.trim()).filter(tag => tag.length > 0);
                        } else if (Array.isArray(settings.ankiTags)) {
                            tags = settings.ankiTags;
                        }
                    }
                } else {
                    // If category not found, use first category (default) settings
                    const defaultCategory = categories[0];
                    if (defaultCategory) {
                        deckName = defaultCategory.deckName || 'WebExplanations';
                        modelName = defaultCategory.ankiModelName || settings.ankiModelName || 'WebExplanationTemplate';
                        if (defaultCategory.ankiTags) {
                            if (typeof defaultCategory.ankiTags === 'string') {
                                tags = defaultCategory.ankiTags.split(',').map(tag => tag.trim()).filter(tag => tag.length > 0);
                            } else if (Array.isArray(defaultCategory.ankiTags)) {
                                tags = defaultCategory.ankiTags;
                            }
                        }
                    }
                }
            } else {
                // No category specified, use first category (default) settings
                const defaultCategory = categories[0];
                if (defaultCategory) {
                    deckName = defaultCategory.deckName || 'WebExplanations';
                    modelName = defaultCategory.ankiModelName || settings.ankiModelName || 'WebExplanationTemplate';
                    if (defaultCategory.ankiTags) {
                        if (typeof defaultCategory.ankiTags === 'string') {
                            tags = defaultCategory.ankiTags.split(',').map(tag => tag.trim()).filter(tag => tag.length > 0);
                        } else if (Array.isArray(defaultCategory.ankiTags)) {
                            tags = defaultCategory.ankiTags;
                        }
                    }
                }
            }

            // Ensure the model exists
            const models = await this.invoke('modelNames', 6);
            if (!models.includes(modelName)) {
                throw new Error(`Model '${modelName}' not found in Anki. Please create it first.`);
            }

            // Create deck if it doesn't exist
            await this.invoke('createDeck', 6, { deck: deckName });

            // Tags are already parsed above based on category

            // Add the note with sanitized input
            const result = await this.invoke('addNote', 6, {
                note: {
                    deckName: deckName,
                    modelName: modelName,
                    fields: {
                        Front: selectedText.trim(),
                        Back: explanation.trim(),
                        pageUrl: pageUrl || '',
                        pageTitle: pageTitle || '',
                        surroundingContext: surroundingContext || ''
                    },
                    options: {
                        allowDuplicate: true,
                        duplicateScope: "deck"
                    },
                    tags: tags
                }
            });

            console.log('Successfully added note to Anki:', result);
            return result;
        } catch (error) {
            const errorMessage = `Failed to add note to Anki: ${error.message}`;
            console.error(errorMessage);
            throw new Error(errorMessage);
        }
    }
}; 