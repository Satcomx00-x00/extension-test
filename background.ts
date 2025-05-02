// Background script for handling ChatGPT API requests

interface ChatGPTRequest {
  action: string;
  question: string;
}

// Store the ChatGPT URL
let chatgptUrl = '';

// Listen for setting changes
chrome.storage.local.get(['chatgptUrl'], (data) => {
  if (data.chatgptUrl) {
    chatgptUrl = data.chatgptUrl;
    console.log('ChatGPT URL loaded:', chatgptUrl);
  }
});

chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === 'local' && changes.chatgptUrl) {
    chatgptUrl = changes.chatgptUrl.newValue;
    console.log('ChatGPT URL updated:', chatgptUrl);
  }
});

// Listen for messages from content scripts
chrome.runtime.onMessage.addListener((request: ChatGPTRequest, sender, sendResponse) => {
  if (request.action === 'queryChatGPT') {
    console.log('Received request to query ChatGPT:', request.question);
    
    if (!chatgptUrl) {
      console.error('ChatGPT URL is not set');
      sendResponse({ success: false, error: 'ChatGPT URL is not set' });
      return true;
    }
    
    // Query ChatGPT and return the response
    queryChatGPT(request.question)
      .then(answer => {
        console.log('Got answer from ChatGPT:', answer);
        sendResponse({ success: true, answer });
      })
      .catch(error => {
        console.error('Error querying ChatGPT:', error);
        sendResponse({ success: false, error: error.toString() });
      });
    
    return true; // Required for async sendResponse
  }
});

// Function to query ChatGPT using the shared URL
async function queryChatGPT(question: string): Promise<string> {
  try {
    // Extract the session ID from the URL
    const sessionId = extractSessionId(chatgptUrl);
    if (!sessionId) {
      throw new Error('Invalid ChatGPT URL');
    }
    
    // Construct API endpoint for the shared conversation
    const apiUrl = `https://chatgpt.com/api/shared/${sessionId}/conversation`;
    
    // Send request to ChatGPT API
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: question,
        conversation_id: sessionId,
      }),
    });
    
    if (!response.ok) {
      throw new Error(`ChatGPT API returned status ${response.status}`);
    }
    
    const data = await response.json();
    
    // Extract the answer from the response
    const answer = extractAnswerFromResponse(data);
    return answer;
  } catch (error) {
    console.error('Error in queryChatGPT:', error);
    
    // Fallback: Try to fetch the shared conversation page and extract the answer
    return fetchSharedConversationPage(chatgptUrl, question);
  }
}

// Extract session ID from ChatGPT shared URL
function extractSessionId(url: string): string | null {
  const match = url.match(/https:\/\/chatgpt\.com\/share\/([a-zA-Z0-9-]+)/);
  return match ? match[1] : null;
}

// Extract answer from API response
function extractAnswerFromResponse(data: any): string {
  try {
    // The structure of the response may vary
    if (data.response && typeof data.response === 'string') {
      return data.response;
    } else if (data.message && data.message.content && data.message.content.parts) {
      return data.message.content.parts.join('\n');
    } else {
      console.warn('Unexpected response structure:', data);
      return 'Could not extract answer from response';
    }
  } catch (error) {
    console.error('Error extracting answer from response:', error);
    return 'Error extracting answer';
  }
}

// Fallback method: Try to fetch the shared conversation page and simulate asking a question
async function fetchSharedConversationPage(url: string, question: string): Promise<string> {
  try {
    // This is a more complex approach that would require headless browser interaction
    // or very specific knowledge of the ChatGPT web interface
    
    // For now, return a helpful message
    return `Sorry, I couldn't get an answer from ChatGPT for "${question}". Please check your shared URL and try again.`;
  } catch (error) {
    console.error('Error in fetchSharedConversationPage:', error);
    return 'Error communicating with ChatGPT';
  }
}
