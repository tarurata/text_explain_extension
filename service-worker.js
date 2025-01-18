chrome.runtime.onInstalled.addListener(() => {
    chrome.contextMenus.create({
        id: 'openSidePanel',
        title: 'Open side panel',
        contexts: ['all']
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
        } else if (message.action === 'showExplanation') {
            // Store the explanation with the tab ID
            await chrome.storage.local.set({
                [`explanation_${sender.tab.id}`]: message.explanation,
                [`selectedText_${sender.tab.id}`]: message.selectedText,
                [`pageInfo_${sender.tab.id}`]: message.pageInfo
            });
        }
    })();
});