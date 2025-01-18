// Create a Set to track tabs with open side panels
const openSidePanelTabs = new Set();

chrome.runtime.onInstalled.addListener(() => {
    chrome.contextMenus.create({
        id: 'openSidePanel',
        title: 'Open side panel',
        contexts: ['all']
    });
    chrome.contextMenus.create({
        id: 'explainSelection',
        title: 'Explain Selection',
        contexts: ['selection']
    });
});

chrome.runtime.onMessage.addListener((message, sender) => {
    // The callback for runtime.onMessage must return falsy if we're not sending a response
    (async () => {
        if (message.type === 'open_side_panel') {
            // This will open a tab-specific side panel only on the current tab.
            await chrome.sidePanel.open({ tabId: sender.tab.id });
            await chrome.sidePanel.setOptions({
                tabId: sender.tab.id,
                path: 'sidepanel.html',
                enabled: true
            });
            if (message.selectedText) {
                await chrome.storage.local.set({
                    [`selectedText_${sender.tab.id}`]: message.selectedText,
                    [`pageInfo_${sender.tab.id}`]: message.pageInfo
                });
            }
            openSidePanelTabs.add(sender.tab.id);
            //        } else if (message.type === 'close_side_panel') {
            //            await chrome.sidePanel.setOptions({ enabled: false });
            //            //openSidePanelTabs.delete(sender.tab.id);
        } else if (message.action === 'showExplanation') {
            // Store the explanation with the tab ID
            await chrome.storage.local.set({
                [`explanation_${sender.tab.id}`]: message.explanation,
                [`selectedText_${sender.tab.id}`]: message.selectedText,
                [`pageInfo_${sender.tab.id}`]: message.pageInfo,
                [`surroundingContext_${sender.tab.id}`]: message.surroundingContext
            });
        }
    })();
});

// Clean up when tabs are closed
chrome.tabs.onRemoved.addListener((tabId) => {
    openSidePanelTabs.delete(tabId);
});

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId === 'explainSelection') {
        chrome.tabs.sendMessage(tab.id, { type: 'contextMenuClick' });
    }
});