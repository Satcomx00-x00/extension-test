document.addEventListener('DOMContentLoaded', function() {
  const chatgptUrlInput = document.getElementById('chatgpt-url');
  const saveSettingsButton = document.getElementById('save-settings');
  const autoAnswerButton = document.getElementById('auto-answer');
  const statusMessage = document.getElementById('status-message');

  // Load saved settings
  chrome.storage.local.get(['chatgptUrl'], function(data) {
    if (data.chatgptUrl) {
      chatgptUrlInput.value = data.chatgptUrl;
      autoAnswerButton.disabled = false;
    }
  });

  // Save settings
  saveSettingsButton.addEventListener('click', function() {
    const chatgptUrl = chatgptUrlInput.value.trim();
    
    if (!chatgptUrl) {
      showStatus('Please enter a valid ChatGPT session URL', 'error');
      return;
    }

    // Validate URL format
    if (!chatgptUrl.startsWith('https://chatgpt.com/share/')) {
      showStatus('URL must be a valid ChatGPT shared session URL', 'error');
      return;
    }

    chrome.storage.local.set({ chatgptUrl }, function() {
      showStatus('Settings saved successfully!', 'success');
      autoAnswerButton.disabled = false;
    });
  });

  // Auto answer button
  autoAnswerButton.addEventListener('click', function() {
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      const currentUrl = tabs[0].url;
      
      if (currentUrl.includes('docs.google.com/forms')) {
        chrome.tabs.sendMessage(tabs[0].id, { action: 'autoAnswerForm' }, function(response) {
          if (response && response.status === 'success') {
            showStatus('Processing Google Form...', 'success');
          } else {
            showStatus('Error: Could not process form', 'error');
          }
        });
      } else if (currentUrl.includes('forms.office.com') || currentUrl.includes('forms.microsoft.com')) {
        chrome.tabs.sendMessage(tabs[0].id, { action: 'autoAnswerForm' }, function(response) {
          if (response && response.status === 'success') {
            showStatus('Processing Microsoft Form...', 'success');
          } else {
            showStatus('Error: Could not process form', 'error');
          }
        });
      } else {
        showStatus('Not on a supported form page!', 'error');
      }
    });
  });

  function showStatus(message, type) {
    statusMessage.textContent = message;
    statusMessage.className = type;
    setTimeout(() => {
      statusMessage.textContent = '';
      statusMessage.className = '';
    }, 3000);
  }
});
