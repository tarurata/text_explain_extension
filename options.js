document.addEventListener('DOMContentLoaded', async () => {
    // Load saved API key
    const result = await chrome.storage.local.get('openaiApiKey');
    if (result.openaiApiKey) {
        document.getElementById('apiKey').value = result.openaiApiKey;
    }

    // Save API key
    document.getElementById('save').addEventListener('click', async () => {
        const apiKey = document.getElementById('apiKey').value.trim();
        await chrome.storage.local.set({ openaiApiKey: apiKey });

        // Show success message
        const status = document.getElementById('status');
        status.textContent = 'Settings saved!';
        status.className = 'status success';
        status.style.display = 'block';

        setTimeout(() => {
            status.style.display = 'none';
        }, 3000);
    });
});
