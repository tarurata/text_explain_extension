document.addEventListener('DOMContentLoaded', async () => {
    // Load saved settings
    const result = await chrome.storage.local.get([
        'openaiApiKey',
        'openaiModel',
        'maxTokens',
        'temperature',
        'ankiConnectUrl',
        'ankiModelName',
        'ankiTags',
        'autoAddToAnki',
        'categoryDetectionPrompt',
        'categories',
        'defaultCategory',
        'contextLength'
    ]);

    // API Configuration
    if (result.openaiApiKey) {
        document.getElementById('apiKey').value = result.openaiApiKey;
    }

    const defaultModel = 'gpt-4o-mini';
    document.getElementById('openaiModel').value = result.openaiModel || defaultModel;

    const defaultMaxTokens = 5000;
    document.getElementById('maxTokens').value = result.maxTokens || defaultMaxTokens;

    const defaultTemperature = 1.0;
    document.getElementById('temperature').value = result.temperature !== undefined ? result.temperature : defaultTemperature;

    // Anki Configuration
    const defaultAnkiConnectUrl = 'http://127.0.0.1:8765';
    document.getElementById('ankiConnectUrl').value = result.ankiConnectUrl || defaultAnkiConnectUrl;

    const defaultAnkiModelName = 'WebExplanationTemplate';
    document.getElementById('ankiModelName').value = result.ankiModelName || defaultAnkiModelName;

    const defaultGeneralDeckName = 'WebExplanations';
    document.getElementById('generalDeckName').value = result.generalDeckName || defaultGeneralDeckName;

    const defaultAnkiTags = 'web_explanation';
    document.getElementById('ankiTags').value = result.ankiTags || defaultAnkiTags;

    document.getElementById('autoAddToAnki').checked = result.autoAddToAnki !== false; // Default to true

    // Category Management
    const defaultCategoryDetectionPrompt = `Analyze the following page content and determine which category it belongs to. Available categories: {categories}. Respond with only the category name. If none of the categories match, respond with the first category (default). Page content: {pageContent}`;
    document.getElementById('categoryDetectionPrompt').value = result.categoryDetectionPrompt || defaultCategoryDetectionPrompt;

    // Load categories
    let categories = result.categories || [];

    // If no categories exist, create a default one
    if (categories.length === 0) {
        const defaultGeneralPrompt = `Concisely explain "{selectedText}". The etymology of the word is also important. If it includes phrases, explain the phrases, too. Use <br> to break the text into lines. Context: {context}`;
        const defaultDeckName = 'WebExplanations';

        // Create default category (first category is always the default)
        categories = [
            {
                name: 'General',
                prompt: defaultGeneralPrompt,
                deckName: defaultDeckName
            }
        ];
    }

    // Context Settings
    const defaultContextLength = 250;
    document.getElementById('contextLength').value = result.contextLength || defaultContextLength;

    // Category management functions
    const categoriesContainer = document.getElementById('categoriesContainer');
    let categoryCounter = 0;

    function createCategoryElement(category, index) {
        const categoryDiv = document.createElement('div');
        const isDefault = index === 0;
        categoryDiv.className = isDefault ? 'category-item default-category' : 'category-item';
        categoryDiv.dataset.index = index;

        const removeButton = isDefault
            ? '<span style="color: #999; font-size: 0.9em;">Cannot remove default category</span>'
            : `<button type="button" class="btn-remove" onclick="removeCategory(${index})">Remove</button>`;

        categoryDiv.innerHTML = `
            <div class="category-item-header">
                <h4>Category ${index + 1}</h4>
                ${removeButton}
            </div>
            <div class="form-group">
                <label>Category Name:</label>
                <input type="text" class="category-name" value="${escapeHtml(category.name || '')}" placeholder="e.g., General, Programming, Math, etc.">
            </div>
            <div class="form-group">
                <label>Prompt Template:</label>
                <textarea class="category-prompt" placeholder="Enter the prompt template. Use {selectedText} and {context} as placeholders.">${escapeHtml(category.prompt || '')}</textarea>
                <small>Use {selectedText} for the selected text and {context} for the context.</small>
            </div>
            <div class="form-group">
                <label>Deck Name:</label>
                <input type="text" class="category-deck" value="${escapeHtml(category.deckName || '')}" placeholder="Deck name in Anki">
            </div>
        `;

        return categoryDiv;
    }

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    function renderCategories() {
        categoriesContainer.innerHTML = '';
        categories.forEach((category, index) => {
            const categoryElement = createCategoryElement(category, index);
            categoriesContainer.appendChild(categoryElement);
        });
    }

    window.removeCategory = function (index) {
        // Prevent removing the first category (default category)
        if (index === 0) {
            return;
        }
        categories.splice(index, 1);
        renderCategories();
    };

    document.getElementById('addCategoryBtn').addEventListener('click', () => {
        const defaultPrompt = `Concisely explain "{selectedText}". Use <br> to break the text into lines. Context: {context}`;
        categories.push({
            name: '',
            prompt: defaultPrompt,
            deckName: ''
        });
        renderCategories();
    });

    // Initial render
    renderCategories();

    // Save settings
    document.getElementById('save').addEventListener('click', async () => {
        try {
            const apiKey = document.getElementById('apiKey').value.trim();
            const openaiModel = document.getElementById('openaiModel').value.trim();
            const maxTokens = parseInt(document.getElementById('maxTokens').value) || 5000;
            const temperature = parseFloat(document.getElementById('temperature').value) || 1.0;
            const ankiConnectUrl = document.getElementById('ankiConnectUrl').value.trim();
            const ankiModelName = document.getElementById('ankiModelName').value.trim();
            const ankiTags = document.getElementById('ankiTags').value.trim();
            const autoAddToAnki = document.getElementById('autoAddToAnki').checked;
            const categoryDetectionPrompt = document.getElementById('categoryDetectionPrompt').value.trim();
            const contextLength = parseInt(document.getElementById('contextLength').value) || 250;

            // Collect categories from UI
            const categoryElements = categoriesContainer.querySelectorAll('.category-item');
            const savedCategories = [];
            categoryElements.forEach((element) => {
                const name = element.querySelector('.category-name').value.trim();
                const prompt = element.querySelector('.category-prompt').value.trim();
                const deckName = element.querySelector('.category-deck').value.trim();

                if (name) { // Only save categories with names
                    savedCategories.push({
                        name: name,
                        prompt: prompt,
                        deckName: deckName
                    });
                }
            });

            // Ensure at least one category exists (the default)
            if (savedCategories.length === 0) {
                const defaultPrompt = `Concisely explain "{selectedText}". The etymology of the word is also important. If it includes phrases, explain the phrases, too. Use <br> to break the text into lines. Context: {context}`;
                const defaultDeckName = 'WebExplanations';
                savedCategories.push({
                    name: 'General',
                    prompt: defaultPrompt,
                    deckName: defaultDeckName
                });
            }

            // Build category prompt mapping from categories
            const categoryPromptMapping = {};
            savedCategories.forEach(cat => {
                categoryPromptMapping[cat.name] = cat.prompt;
            });

            // The first category is always the default
            const defaultCategory = savedCategories[0].name;

            await chrome.storage.local.set({
                openaiApiKey: apiKey,
                openaiModel: openaiModel,
                maxTokens: maxTokens,
                temperature: temperature,
                ankiConnectUrl: ankiConnectUrl,
                ankiModelName: ankiModelName,
                ankiTags: ankiTags,
                autoAddToAnki: autoAddToAnki,
                categoryDetectionPrompt: categoryDetectionPrompt,
                categories: savedCategories,
                defaultCategory: defaultCategory,
                categoryPromptMapping: categoryPromptMapping,
                contextLength: contextLength
            });

            // Show success message
            const status = document.getElementById('status');
            status.textContent = 'Settings saved successfully!';
            status.className = 'status success';
            status.style.display = 'block';

            setTimeout(() => {
                status.style.display = 'none';
            }, 3000);
        } catch (error) {
            const status = document.getElementById('status');
            status.textContent = 'Error saving settings: ' + error.message;
            status.className = 'status';
            status.style.display = 'block';
            status.style.backgroundColor = '#f2dede';
            status.style.color = '#a94442';
        }
    });
});
