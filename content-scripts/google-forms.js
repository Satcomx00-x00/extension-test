// Google Forms content script

// Listen for messages from the popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'autoAnswerForm') {
    processGoogleForm()
      .then(() => sendResponse({ status: 'success' }))
      .catch(error => sendResponse({ status: 'error', message: error.toString() }));
    return true; // Required for async sendResponse
  }
});

async function processGoogleForm() {
  try {
    // Get all questions on the form
    const questionElements = document.querySelectorAll('.freebirdFormviewerComponentsQuestionBaseRoot');
    
    if (questionElements.length === 0) {
      throw new Error('No questions found on this page');
    }
    
    console.log(`Found ${questionElements.length} questions on the page`);
    
    for (const questionEl of questionElements) {
      await processGoogleFormQuestion(questionEl);
    }
    
    console.log('All questions processed');
    return true;
  } catch (error) {
    console.error('Error processing Google Form:', error);
    throw error;
  }
}

async function processGoogleFormQuestion(questionElement) {
  try {
    // Extract question text
    const questionTextEl = questionElement.querySelector('.freebirdFormviewerComponentsQuestionBaseHeader');
    if (!questionTextEl) return; // Skip if no question text found
    
    const questionText = questionTextEl.textContent.trim();
    console.log('Processing question:', questionText);
    
    // Get question type
    let questionType = 'unknown';
    if (questionElement.querySelector('input[type="text"]')) {
      questionType = 'short-text';
    } else if (questionElement.querySelector('textarea')) {
      questionType = 'paragraph';
    } else if (questionElement.querySelector('input[type="radio"]')) {
      questionType = 'multiple-choice';
    } else if (questionElement.querySelector('input[type="checkbox"]')) {
      questionType = 'checkbox';
    }
    
    // Query ChatGPT for the answer
    const response = await chrome.runtime.sendMessage({
      action: 'queryChatGPT',
      question: questionText
    });
    
    if (!response || !response.success) {
      console.error('Failed to get answer from ChatGPT');
      return;
    }
    
    const answer = response.answer;
    console.log('Got answer:', answer);
    
    // Fill in the answer based on question type
    if (questionType === 'short-text' || questionType === 'paragraph') {
      const inputEl = questionElement.querySelector('input[type="text"]') || questionElement.querySelector('textarea');
      if (inputEl) {
        inputEl.value = answer;
        // Trigger input event to ensure Google Forms recognizes the change
        inputEl.dispatchEvent(new Event('input', { bubbles: true }));
      }
    } else if (questionType === 'multiple-choice') {
      const options = Array.from(questionElement.querySelectorAll('.docssharedWizToggleLabeledLabelWrapper'));
      
      // Find best matching option based on answer
      let bestMatch = findBestMatchingOption(options, answer);
      
      if (bestMatch) {
        // Click the matching option
        bestMatch.click();
      }
    } else if (questionType === 'checkbox') {
      const options = Array.from(questionElement.querySelectorAll('.docssharedWizToggleLabeledLabelWrapper'));
      
      // For checkboxes, we might need to select multiple options
      // Parse the answer to determine which checkboxes to select
      const optionsToSelect = findCheckboxOptionsToSelect(options, answer);
      
      for (const option of optionsToSelect) {
        option.click();
      }
    }
    
  } catch (error) {
    console.error('Error processing question:', error);
  }
}

function findBestMatchingOption(options, answer) {
  try {
    // Get option text for each option
    const optionsWithText = options.map(opt => ({
      element: opt,
      text: opt.textContent.trim().toLowerCase()
    }));
    
    // Simple algorithm: check if any option text is contained in the answer
    for (const option of optionsWithText) {
      if (answer.toLowerCase().includes(option.text)) {
        return option.element;
      }
    }
    
    // If no direct match, look for key terms
    const answerWords = answer.toLowerCase().split(/\s+/);
    let bestMatch = null;
    let bestMatchCount = 0;
    
    for (const option of optionsWithText) {
      const optionWords = option.text.split(/\s+/);
      let matchCount = 0;
      
      for (const word of optionWords) {
        if (word.length > 3 && answerWords.includes(word)) { // Consider only words longer than 3 chars
          matchCount++;
        }
      }
      
      if (matchCount > bestMatchCount) {
        bestMatchCount = matchCount;
        bestMatch = option.element;
      }
    }
    
    return bestMatch;
  } catch (error) {
    console.error('Error finding best matching option:', error);
    return null;
  }
}

function findCheckboxOptionsToSelect(options, answer) {
  try {
    // Similar to findBestMatchingOption but can return multiple options
    const answerLower = answer.toLowerCase();
    const optionsToSelect = [];
    
    // Get option text for each option
    const optionsWithText = options.map(opt => ({
      element: opt,
      text: opt.textContent.trim().toLowerCase()
    }));
    
    // Check each option
    for (const option of optionsWithText) {
      if (answerLower.includes(option.text)) {
        optionsToSelect.push(option.element);
      }
    }
    
    // If we didn't find any matches, try a more advanced approach
    if (optionsToSelect.length === 0) {
      // Look for keywords in answer that might suggest multiple selections
      const keywords = ['all', 'both', 'multiple', 'several', 'and'];
      const hasMultipleIndicator = keywords.some(keyword => answerLower.includes(keyword));
      
      if (hasMultipleIndicator) {
        // If answer suggests multiple selections, check each option against the answer
        for (const option of optionsWithText) {
          const optionWords = option.text.split(/\s+/);
          for (const word of optionWords) {
            if (word.length > 3 && answerLower.includes(word)) {
              optionsToSelect.push(option.element);
              break;
            }
          }
        }
      } else {
        // If still no matches, just pick one that seems most likely
        const bestMatch = findBestMatchingOption(options, answer);
        if (bestMatch) optionsToSelect.push(bestMatch);
      }
    }
    
    return optionsToSelect;
  } catch (error) {
    console.error('Error finding checkbox options to select:', error);
    return [];
  }
}
