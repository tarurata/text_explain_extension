window.ankiConnect = {
    invoke: function (action, version, params = {}) {
        return new Promise((resolve, reject) => {
            const request = { action, version, params };
            console.log(`Sending request to AnkiConnect:`, request);

            fetch('http://127.0.0.1:8765', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(request)
            })
                .then(response => {
                    if (!response.ok) {
                        throw new Error(`HTTP error! status: ${response.status}`);
                    }
                    return response.json();
                })
                .then(response => {
                    if (!response || typeof response !== 'object') {
                        throw new Error('Invalid response format from AnkiConnect');
                    }
                    if (!('error' in response) || !('result' in response)) {
                        throw new Error('Response missing required fields');
                    }
                    if (response.error) {
                        throw new Error(response.error);
                    }
                    resolve(response.result);
                })
                .catch(error => {
                    console.error('AnkiConnect Error:', error);
                    reject(error);
                });
        });
    },

    addToAnki: async function (selectedText, explanation, pageUrl, pageTitle, surroundingContext) {
        try {
            // Validate input parameters
            if (!selectedText || !explanation) {
                throw new Error('Selected text and explanation are required');
            }

            // Check if AnkiConnect is available
            await this.invoke('version', 6);

            // Determine the deck name based on URL
            const deckName = (pageUrl.toLowerCase().includes('comptia-security') ||
                pageUrl.toLowerCase().includes('securityplus'))
                ? 'CompTIA Security+'
                : 'WebExplanations';

            // Ensure the model exists
            const modelName = 'WebExplanationTemplate';
            const models = await this.invoke('modelNames', 6);
            if (!models.includes(modelName)) {
                throw new Error(`Model '${modelName}' not found in Anki. Please create it first.`);
            }

            // Create deck if it doesn't exist
            await this.invoke('createDeck', 6, { deck: deckName });

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
                    tags: ['web_explanation']
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