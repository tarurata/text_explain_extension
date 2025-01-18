// Define display functions first
function displayPageInfo(pageInfo) {
    const titleDiv = document.getElementById('pageTitle');
    const urlDiv = document.getElementById('pageUrl');
    titleDiv.innerText = pageInfo.title;
    urlDiv.innerText = pageInfo.url;
}

function displaySelectedText(text) {
    const selectedTextDiv = document.getElementById('selectedText');
    selectedTextDiv.innerText = text;
}

function displayExplanation(explanation) {
    const explanationDiv = document.getElementById('explanation');
    explanationDiv.innerText = explanation;
}

function addAnkiButtonListener() {
    document.getElementById('addToAnki').addEventListener('click', async () => {
        const selectedText = document.getElementById('selectedText').innerText;
        const explanation = document.getElementById('explanation').innerText;
        const pageUrl = document.getElementById('pageUrl').innerText;
        const pageTitle = document.getElementById('pageTitle').innerText;

        try {
            await window.ankiConnect.addToAnki(selectedText, explanation, pageUrl, pageTitle);
            alert('Successfully added to Anki!');
        } catch (error) {
            alert('Failed to add to Anki. Make sure Anki is running with AnkiConnect installed.');
        }
    });
}

async function loadTabSpecificExplanation() {
    try {
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        const tabId = tabs[0].id;

        const data = await chrome.storage.local.get([
            `explanation_${tabId}`,
            `selectedText_${tabId}`,
            `pageInfo_${tabId}`
        ]);

        const explanation = data[`explanation_${tabId}`] || 'Select text on the page to get an explanation.';
        const selectedText = data[`selectedText_${tabId}`] || 'No text selected';
        const pageInfo = data[`pageInfo_${tabId}`] || { title: 'No page loaded', url: '' };

        displayPageInfo(pageInfo);
        displaySelectedText(selectedText);
        displayExplanation(explanation);
    } catch (error) {
        console.error('Error loading tab-specific explanation:', error);
    }
}

// Initialize when the document is loaded
document.addEventListener('DOMContentLoaded', () => {
    loadTabSpecificExplanation();
    addAnkiButtonListener();
});

chrome.tabs.onActivated.addListener(loadTabSpecificExplanation);

document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape') {
        window.close();
    }
})
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'showExplanation') {
        displayPageInfo(request.pageInfo);
        displaySelectedText(request.selectedText);
        displayExplanation(request.explanation);
    } else if (request.action === 'close_side_panel') {
        window.close();
    }
});