// Listen for messages from content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'queryChatGPT') {
    queryChatGPT(message.question)
      .then(answer => {
        sendResponse({ success: true, answer: answer });
      })
      .catch(error => {
        sendResponse({ success: false, error: error.toString() });
      });
    return true; // Required for async sendResponse
  }
});

async function queryChatGPT(question) {
  try {
    // Get the ChatGPT session URL from storage
    const data = await chrome.storage.local.get(['chatgptUrl']);
    if (!data.chatgptUrl) {
      throw new Error('ChatGPT session URL not configured');
    }
    
    // Extract the session ID from the URL
    const sessionId = data.chatgptUrl.split('/').pop();
    
    // For this extension, we'll use a simple technique to get answers
    // from a publicly shared ChatGPT conversation
    // In a real implementation, you might need to use an API or more advanced methods
    
    // Here we make a request to the shared conversation and extract the answer
    const response = await fetch(`https://chatgpt.com/api/shared/${sessionId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: question,
        conversation_id: sessionId
      })
    });

    if (!response.ok) {
      throw new Error('Failed to get answer from ChatGPT');
    }

    const data = await response.json();
    return data.answer || 'No answer found';
    
    // Note: This is a simplified placeholder implementation
    // The actual implementation would depend on how OpenAI's API for shared sessions works
    // Since direct API access might not be possible with just a shared URL,
    // users might need to provide API keys or use another integration method
  } catch (error) {
    console.error('Error querying ChatGPT:', error);
    throw error;
  }
}
