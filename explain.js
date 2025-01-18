// Function to get all text content from the webpage
function getAllPageText() {
    // Remove script and style elements to get only visible text
    const scripts = document.querySelectorAll('script, style');
    scripts.forEach(script => script.remove());

    // Get text from body
    return document.body.innerText.trim();
}

// Function to get selected text
function getSelectedText() {
    return window.getSelection().toString().trim();
}

// Function to send request to ChatGPT API
async function askChatGPT(selectedText, context) {
    // Get the API key from storage
    const result = await chrome.storage.local.get('openaiApiKey');
    const OPENAI_API_KEY = result.openaiApiKey;

    if (!OPENAI_API_KEY) {
        return 'Please set your OpenAI API key in the extension settings (right-click the extension icon and select "Options")';
    }

    try {
        console.log('Sending request to ChatGPT with selected text:', selectedText); // Debug log
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${OPENAI_API_KEY}`
            },
            body: JSON.stringify({
                model: "gpt-4o-mini",
                messages: [{
                    role: "user",
                    content: `Explain "${selectedText}" with the context of this text: ${context}`
                }],
                max_tokens: 5000
            })
        });

        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.error?.message || 'API request failed');
        }
        console.log('Received response from ChatGPT:', data); // Debug log
        return data.choices[0].message.content;
    } catch (error) {
        console.error('Error:', error);
        return `Error: ${error.message}`;
    }
}

// Main function to execute the explanation
async function explainSelection() {
    const selectedText = getSelectedText();
    if (!selectedText) {
        console.log('You didn\'t choose any words.');
        return;
    }

    try {
        // Just send the message to open the side panel
        await chrome.runtime.sendMessage({ type: 'open_side_panel' });
    } catch (error) {
        console.error('Error opening side panel:', error);
    }

    const pageContext = getAllPageText();
    const explanation = await askChatGPT(selectedText, pageContext);

    // Send the explanation to the service worker
    // The service worker will get the tabId from sender.tab.id
    chrome.runtime.sendMessage({
        action: 'showExplanation',
        explanation: explanation
    });
}

// Add a listener for the keyboard shortcut "cmd + shift + E"
document.addEventListener('keydown', (event) => {
    const isMeta = event.metaKey; // Check if the Meta key is pressed
    const isShift = event.shiftKey; // Check if the Shift key is pressed
    const isE = event.key === 'e'; // Check if the pressed key is 'E'

    if (isMeta && isShift && isE) {
        chrome.runtime.sendMessage({ type: 'open_side_panel' });
        explainSelection();
        event.preventDefault(); // Prevent default behavior to avoid conflicts
    }
});
