// Function to get all text content from the webpage
function getAllPageText() {
    // Create a clone of the body to avoid modifying the original DOM
    const bodyClone = document.body.cloneNode(true);

    // Remove script and style elements from the clone
    const scripts = bodyClone.querySelectorAll('script, style');
    scripts.forEach(script => script.remove());

    // Get text from the clone
    return bodyClone.innerText.trim();
}

// Function to get selected text with surrounding context
async function getSelectedTextWithContext() {
    const selection = window.getSelection();
    if (!selection.rangeCount) return { selected: '', context: '' };

    const range = selection.getRangeAt(0);
    const selected = selection.toString().trim();

    // Get configurable context length
    const result = await chrome.storage.local.get('contextLength');
    const contextLength = result.contextLength || 250;

    // Get the containing element
    let container = range.startContainer;
    while (container && container.nodeName !== 'BODY' &&
        !['P', 'DIV', 'ARTICLE', 'SECTION'].includes(container.nodeName)) {
        container = container.parentNode;
    }

    const fullText = container.textContent;
    const selectionStart = fullText.indexOf(selected);

    if (selectionStart === -1) return { selected, context: selected };

    // Get context before and after the selection
    const contextStart = Math.max(0, selectionStart - contextLength);
    const contextEnd = Math.min(fullText.length, selectionStart + selected.length + contextLength);

    let context = fullText.slice(contextStart, contextEnd);

    // Add ellipsis if we're not at the start/end
    if (contextStart > 0) context = '...' + context;
    if (contextEnd < fullText.length) context = context + '...';

    return { selected, context };
}

// Function to detect category using AI
async function detectCategory(pageContent) {
    try {
        const result = await chrome.storage.local.get([
            'openaiApiKey',
            'categoryDetectionPrompt',
            'openaiModel',
            'maxTokens',
            'temperature',
            'categories'
        ]);

        const OPENAI_API_KEY = result.openaiApiKey;
        const categories = result.categories || [];

        // If no categories are defined, return 'General' as fallback
        if (categories.length === 0) {
            console.log('No categories defined, using fallback: General');
            return 'General';
        }

        // Build list of available category names
        const categoryNames = categories.map(cat => cat.name).filter(name => name && name.trim());

        // If no valid category names, use first category as fallback
        if (categoryNames.length === 0) {
            console.log('No valid category names found, using first category');
            return categories[0]?.name || 'General';
        }

        // The first category is always the default
        const defaultCategory = categoryNames[0];

        const categoryDetectionPrompt = result.categoryDetectionPrompt ||
            `Analyze the following page content and determine which category it belongs to. Available categories: {categories}. Respond with only the category name. If none of the categories match, respond with the first category (default). Page content: {pageContent}`;
        const model = result.openaiModel || 'gpt-4o-mini';
        const temperature = result.temperature !== undefined ? result.temperature : 1.0;

        if (!OPENAI_API_KEY) {
            console.log('No API key, using default category:', defaultCategory);
            return defaultCategory;
        }

        // Limit page content to avoid token limits (first 2000 characters should be enough for category detection)
        const limitedContent = pageContent.substring(0, 2000);
        const categoriesList = categoryNames.join(', ');
        let prompt = categoryDetectionPrompt.replace(/{pageContent}/g, limitedContent);
        prompt = prompt.replace(/{categories}/g, categoriesList);

        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${OPENAI_API_KEY}`
            },
            body: JSON.stringify({
                model: model,
                messages: [{
                    role: "user",
                    content: prompt
                }],
                max_tokens: 50, // Category detection only needs a short response
                temperature: temperature
            })
        });

        if (!response.ok) {
            console.warn('Category detection failed, using default category:', defaultCategory);
            return defaultCategory;
        }

        const data = await response.json();
        const detectedCategory = data.choices?.[0]?.message?.content?.trim() || defaultCategory;

        // Validate that the detected category is in the list of available categories
        // If not, use the default category
        if (categoryNames.includes(detectedCategory)) {
            return detectedCategory;
        } else {
            console.warn(`Detected category "${detectedCategory}" not in available categories, using default:`, defaultCategory);
            return defaultCategory;
        }
    } catch (error) {
        console.warn('Category detection error:', error);
        const result = await chrome.storage.local.get('categories');
        const categories = result.categories || [];
        // Return first category name or 'General' as fallback
        return categories[0]?.name || 'General';
    }
}

// Function to send request to ChatGPT API
async function askChatGPT(selectedText, context, category) {
    const result = await chrome.storage.local.get([
        'openaiApiKey',
        'openaiModel',
        'maxTokens',
        'temperature',
        'categoryPromptMapping'
    ]);
    const OPENAI_API_KEY = result.openaiApiKey;

    if (!OPENAI_API_KEY) {
        const errorMessage = 'OpenAI API key not found. Please set it in the extension settings.';
        console.error(errorMessage);
        return { explanation: errorMessage, category: 'General' };
    }

    const loadingMessage = 'Generating explanation...';
    try {
        // Notify user that processing has started
        chrome.runtime.sendMessage({
            action: 'showExplanation',
            selectedText,
            explanation: loadingMessage
        });

        // Get prompt template based on category
        let promptTemplate;

        // Try to use category prompt mapping first (built from user-defined categories)
        if (result.categoryPromptMapping && typeof result.categoryPromptMapping === 'object') {
            promptTemplate = result.categoryPromptMapping[category];
        }

        // Final fallback if no template found
        if (!promptTemplate) {
            promptTemplate = `Concisely explain "{selectedText}". The etymology of the word is also important. If it includes phrases, explain the phrases, too. Use <br> to break the text into lines. Context: {context}`;
        }

        // Replace placeholders with actual values
        const promptContent = promptTemplate
            .replace(/{selectedText}/g, selectedText)
            .replace(/{context}/g, context);

        const model = result.openaiModel || 'gpt-4o-mini';
        const maxTokens = result.maxTokens || 5000;
        const temperature = result.temperature !== undefined ? result.temperature : 1.0;

        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${OPENAI_API_KEY}`
            },
            body: JSON.stringify({
                model: model,
                messages: [{
                    role: "user",
                    content: promptContent
                }],
                max_tokens: maxTokens,
                temperature: temperature
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            const errorMessage = errorData.error?.message || 'API request failed';
            console.error('OpenAI API Error:', errorMessage);
            throw new Error(errorMessage);
        }

        const data = await response.json();
        if (!data.choices?.[0]?.message?.content) {
            throw new Error('Invalid response format from OpenAI API');
        }

        return { explanation: data.choices[0].message.content, category: category };
    } catch (error) {
        const errorMessage = `Failed to get explanation: ${error.message}`;
        console.error(errorMessage);
        return { explanation: errorMessage, category: category };
    }
}

// Main function to execute the explanation
async function explainSelection() {
    const { selected: selectedText, context: surroundingContext } = await getSelectedTextWithContext();
    if (!selectedText) {
        console.log('You didn\'t choose any words.');
        return;
    }

    const pageInfo = {
        url: window.location.href,
        title: document.title
    };

    try {
        await chrome.runtime.sendMessage({
            type: 'open_side_panel',
            selectedText: selectedText,
            surroundingContext: surroundingContext,
            pageInfo: pageInfo
        });
    } catch (error) {
        console.error('Error opening side panel:', error);
    }

    const pageContext = getAllPageText();

    // Detect category using AI
    const category = await detectCategory(pageContext);
    console.log('Detected category:', category);

    // Get explanation with category
    const { explanation, category: detectedCategory } = await askChatGPT(selectedText, pageContext, category);
    const finalCategory = detectedCategory || category;

    // Check if auto-add to Anki is enabled
    const settings = await chrome.storage.local.get('autoAddToAnki');
    const autoAddToAnki = settings.autoAddToAnki !== false; // Default to true

    // Add to Anki if enabled
    if (autoAddToAnki) {
        try {
            await window.ankiConnect.addToAnki(
                selectedText,
                explanation,
                window.location.href,
                document.title,
                surroundingContext,
                finalCategory
            );
            console.log('Successfully added to Anki');
        } catch (error) {
            console.error('Failed to add to Anki:', error);
        }
    }

    chrome.runtime.sendMessage({
        action: 'showExplanation',
        selectedText: selectedText,
        explanation: explanation,
        pageInfo: pageInfo,
        surroundingContext: surroundingContext,
        category: finalCategory
    });
}

// Listen for messages from the context menu click
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === 'contextMenuClick') {
        explainSelection();
    }
});

// Add a listener for the keyboard shortcut "cmd + shift + E"
document.addEventListener('keydown', (event) => {
    const isMeta = event.metaKey;
    const isShift = event.shiftKey;
    const isE = event.key === 'e';

    if (isMeta && isShift && isE) {
        chrome.runtime.sendMessage({ type: 'open_side_panel' });
        explainSelection();
        event.preventDefault();
    }

    if (event.key === 'Escape') {
        chrome.runtime.sendMessage({ type: 'close_side_panel' });
    }
});