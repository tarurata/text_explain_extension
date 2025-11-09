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

    // Note: Anki Model Name and Tags are now per-category, not global
    // Keeping these for backward compatibility and as defaults for new categories
    const defaultAnkiModelName = result.ankiModelName || 'WebExplanationTemplate';
    const defaultAnkiTags = result.ankiTags || 'web_explanation';

    document.getElementById('autoAddToAnki').checked = result.autoAddToAnki !== false; // Default to true

    // Category Management
    const defaultCategoryDetectionPrompt = `Analyze the following page content and determine which category it belongs to. Available categories: {categories}. Respond with only the category name. If none of the categories match, respond with the first category (default). Page content: {pageContent}`;
    document.getElementById('categoryDetectionPrompt').value = result.categoryDetectionPrompt || defaultCategoryDetectionPrompt;

    // Load categories
    let categories = result.categories || [];

    // If no categories exist, create a default one and save it immediately
    if (categories.length === 0) {
        const defaultGeneralPrompt = `Concisely explain "{selectedText}". The etymology of the word is also important. If it includes phrases, explain the phrases, too. Use <br> to break the text into lines. Context: {context}`;
        const defaultDeckName = 'WebExplanations';

        // Create default category (first category is always the default)
        categories = [
            {
                name: 'General',
                prompt: defaultGeneralPrompt,
                deckName: defaultDeckName,
                ankiModelName: defaultAnkiModelName,
                ankiTags: defaultAnkiTags
            }
        ];

        // Save the default category immediately
        await chrome.storage.local.set({ categories: categories });
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
            : `<button type="button" class="btn-remove" data-category-index="${index}">Remove</button>`;

        // Get default values from global settings if not set in category
        const defaultAnkiModelName = result.ankiModelName || 'WebExplanationTemplate';
        const defaultAnkiTags = result.ankiTags || 'web_explanation';
        const categoryAnkiModelName = category.ankiModelName || defaultAnkiModelName;
        const categoryAnkiTags = category.ankiTags || defaultAnkiTags;

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
            <div class="form-group">
                <label>Anki Note Type (Model Name):</label>
                <input type="text" class="category-anki-model" value="${escapeHtml(categoryAnkiModelName)}" placeholder="WebExplanationTemplate">
                <small>The name of the note type in Anki for this category</small>
            </div>
            <div class="form-group">
                <label>Anki Tags (comma-separated):</label>
                <input type="text" class="category-anki-tags" value="${escapeHtml(categoryAnkiTags)}" placeholder="web_explanation">
                <small>Tags to add to Anki cards for this category (separate multiple tags with commas)</small>
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

    // Set up modal event listeners once
    let currentConfirmCallback = null;
    const modal = document.getElementById('confirmModal');
    const messageEl = document.getElementById('confirmMessage');
    const cancelBtn = document.getElementById('confirmCancel');
    const okBtn = document.getElementById('confirmOk');

    cancelBtn.addEventListener('click', () => {
        modal.classList.remove('show');
        currentConfirmCallback = null;
    });

    okBtn.addEventListener('click', () => {
        if (currentConfirmCallback) {
            currentConfirmCallback();
            currentConfirmCallback = null;
        }
        modal.classList.remove('show');
    });

    // Close on overlay click
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.classList.remove('show');
            currentConfirmCallback = null;
        }
    });

    function showConfirmModal(message, onConfirm) {
        messageEl.textContent = message;
        currentConfirmCallback = onConfirm;
        modal.classList.add('show');
    }

    function removeCategory(index) {
        // Prevent removing the first category (default category)
        if (index === 0) {
            showConfirmModal('Cannot remove the default category. The first category must always remain.', () => { });
            return;
        }

        // Validate index
        if (index < 0 || index >= categories.length) {
            console.error('Invalid category index:', index);
            return;
        }

        // Get category name for confirmation message
        const categoryName = categories[index].name || `Category ${index + 1}`;

        // Show custom confirmation modal
        showConfirmModal(
            `Are you sure you want to remove "${categoryName}"?\n\nThis action cannot be undone.`,
            () => {
                // Remove the category
                categories.splice(index, 1);

                // Re-render to update the UI
                renderCategories();

                // Show a brief visual feedback
                const status = document.getElementById('status');
                if (status) {
                    status.textContent = `Category "${categoryName}" has been removed.`;
                    status.className = 'status';
                    status.style.display = 'block';
                    status.style.backgroundColor = '#dff0d8';
                    status.style.color = '#3c763d';

                    setTimeout(() => {
                        status.style.display = 'none';
                    }, 3000);
                }
            }
        );
    }

    // Use event delegation for remove buttons
    categoriesContainer.addEventListener('click', (event) => {
        if (event.target.classList.contains('btn-remove')) {
            const index = parseInt(event.target.getAttribute('data-category-index'), 10);
            if (!isNaN(index)) {
                removeCategory(index);
            }
        }
    });

    document.getElementById('addCategoryBtn').addEventListener('click', () => {
        const defaultPrompt = `Concisely explain "{selectedText}". Use <br> to break the text into lines. Context: {context}`;
        const defaultAnkiModelName = result.ankiModelName || 'WebExplanationTemplate';
        const defaultAnkiTags = result.ankiTags || 'web_explanation';
        categories.push({
            name: '',
            prompt: defaultPrompt,
            deckName: '',
            ankiModelName: defaultAnkiModelName,
            ankiTags: defaultAnkiTags
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
            // Note: ankiModelName and ankiTags are now per-category
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
                const ankiModelName = element.querySelector('.category-anki-model').value.trim();
                const ankiTags = element.querySelector('.category-anki-tags').value.trim();

                if (name) { // Only save categories with names
                    savedCategories.push({
                        name: name,
                        prompt: prompt,
                        deckName: deckName,
                        ankiModelName: ankiModelName,
                        ankiTags: ankiTags
                    });
                }
            });

            // Ensure at least one category exists (the default)
            if (savedCategories.length === 0) {
                const defaultPrompt = `Concisely explain "{selectedText}". The etymology of the word is also important. If it includes phrases, explain the phrases, too. Use <br> to break the text into lines. Context: {context}`;
                const defaultDeckName = 'WebExplanations';
                const defaultAnkiModelName = ankiModelName || 'WebExplanationTemplate';
                const defaultAnkiTags = ankiTags || 'web_explanation';
                savedCategories.push({
                    name: 'General',
                    prompt: defaultPrompt,
                    deckName: defaultDeckName,
                    ankiModelName: defaultAnkiModelName,
                    ankiTags: defaultAnkiTags
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
                // Note: ankiModelName and ankiTags are now stored per-category
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
