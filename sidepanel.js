async function loadTabSpecificExplanation() {
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
}

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

document.addEventListener('DOMContentLoaded', loadTabSpecificExplanation);
chrome.tabs.onActivated.addListener(loadTabSpecificExplanation);

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'showExplanation') {
        displayPageInfo(request.pageInfo);
        displaySelectedText(request.selectedText);
        displayExplanation(request.explanation);
    }
});