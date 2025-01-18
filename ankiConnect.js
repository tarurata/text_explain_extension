window.ankiConnect = {
    invoke: function (action, version, params = {}) {
        return new Promise((resolve, reject) => {
            fetch('http://127.0.0.1:8765', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ action, version, params })
            })
                .then(response => response.json())
                .then(response => {
                    if (Object.getOwnPropertyNames(response).length != 2) {
                        throw 'response has an unexpected number of fields';
                    }
                    if (!response.hasOwnProperty('error')) {
                        throw 'response is missing required error field';
                    }
                    if (!response.hasOwnProperty('result')) {
                        throw 'response is missing required result field';
                    }
                    if (response.error) {
                        throw response.error;
                    }
                    resolve(response.result);
                })
                .catch(error => reject(error));
        });
    },

    addToAnki: async function (selectedText, explanation, pageUrl, pageTitle) {
        try {
            // First, ensure the deck exists
            await this.invoke('createDeck', 6, { deck: 'WebExplanations' });

            // Add the note
            const result = await this.invoke('addNote', 6, {
                note: {
                    deckName: 'WebExplanations',
                    modelName: 'WebExplanationTemplate',
                    fields: {
                        Front: selectedText,
                        Back: explanation,
                        pageUrl: pageUrl,
                        pageTitle: pageTitle
                    },
                    options: {
                        allowDuplicate: true,
                        duplicateScope: "deck"
                    },
                    tags: ['web_explanation']
                }
            });

            return result;
        } catch (error) {
            console.error('Error adding note to Anki:', error);
            throw error;
        }
    }
}; 