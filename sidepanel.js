async function loadTabSpecificExplanation() {
    // Get the current tab ID
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    const tabId = tabs[0].id;

    // Get the stored explanation for this tab
    const data = await chrome.storage.local.get(`explanation_${tabId}`);
    const explanation = data[`explanation_${tabId}`] || 'Select text on the page to get an explanation.';

    displayExplanation(explanation);
}

function displayExplanation(explanation) {
    const explanationDiv = document.getElementById('explanation');
    explanationDiv.innerText = explanation;
}

// Load the correct explanation when the panel opens
document.addEventListener('DOMContentLoaded', loadTabSpecificExplanation);

// Listen for tab changes
chrome.tabs.onActivated.addListener(loadTabSpecificExplanation);

// Listen for new explanations
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'showExplanation') {
        displayExplanation(request.explanation);
    }
});