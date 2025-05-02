// Google Forms content script
import { findBestMatchingOption, findCheckboxOptionsToSelect } from './form-utils';

// Define types for the messages and responses
interface AutoAnswerMessage {
  action: string;
}

interface ChatGPTQueryMessage {
  action: string;
  question: string;
}

interface ChatGPTResponse {
  success: boolean;
  answer: string;
}

interface SendResponseCallback {
  (response?: any): void;
}

// Listen for messages from the popup
chrome.runtime.onMessage.addListener((message: AutoAnswerMessage, sender, sendResponse: SendResponseCallback) => {
  if (message.action === 'autoAnswerForm') {
    processGoogleForm()
      .then(() => sendResponse({ status: 'success' }))
      .catch(error => sendResponse({ status: 'error', message: error.toString() }));
    return true; // Required for async sendResponse
  }
});

async function processGoogleForm(): Promise<boolean> {
  try {
    console.log('Starting to process Google Form...');
    
    // Try different selectors that Google Forms might use
    // The structure of Google Forms can change, so we check multiple possible selectors
    const selectors = [
      '.freebirdFormviewerComponentsQuestionBaseRoot', // Common selector for questions
      '.freebirdFormviewerViewItemsItemItem', // Alternative item selector
      '.freebirdFormviewerViewQuestionRoot', // Another question root
      '[role="listitem"]' // Generic role-based selector
    ];
    
    let questionElements: Element[] = [];
    
    // Try each selector until we find questions
    for (const selector of selectors) {
      const elements = document.querySelectorAll(selector);
      if (elements.length > 0) {
        console.log(`Found ${elements.length} questions using selector: ${selector}`);
        questionElements = Array.from(elements);
        break;
      }
    }
    
    if (questionElements.length === 0) {
      // Final attempt: look for any element that might contain a form question
      const possibleContainers = document.querySelectorAll('div[role="list"] > div');
      if (possibleContainers.length > 0) {
        console.log(`Found ${possibleContainers.length} potential question containers`);
        questionElements = Array.from(possibleContainers);
      }
    }
    
    if (questionElements.length === 0) {
      // Debug output to help understand the page structure
      console.log('Page structure:', document.body.innerHTML.substring(0, 500) + '...');
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

async function processGoogleFormQuestion(questionElement: Element): Promise<void> {
  try {
    // Extract question text - try different possible selectors
    const questionTextSelectors = [
      '.freebirdFormviewerComponentsQuestionBaseHeader', // Common header
      '.freebirdFormviewerComponentsQuestionTextRoot', // Text root
      '.freebirdFormviewerViewItemsItemItemTitle', // Item title
      '[role="heading"]', // Role-based heading
    ];
    
    let questionText = '';
    
    // Try each selector for question text
    for (const selector of questionTextSelectors) {
      const textEl = questionElement.querySelector(selector);
      if (textEl && textEl.textContent) {
        questionText = textEl.textContent.trim();
        break;
      }
    }
    
    // If no text found, try getting inner text of the question element
    if (!questionText && questionElement.textContent) {
      // Get all text and try to extract the first part as the question
      const text = questionElement.textContent.trim();
      if (text) {
        // Take first line or first X characters as the question
        questionText = text.split('\n')[0] || text.substring(0, 100);
      }
    }
    
    if (!questionText) {
      console.log('Could not extract question text, skipping this question');
      return;
    }
    
    console.log('Processing question:', questionText);
    
    // Determine question type
    let questionType = 'unknown';
    
    if (questionElement.querySelector('input[type="text"]')) {
      questionType = 'short-text';
    } else if (questionElement.querySelector('textarea')) {
      questionType = 'paragraph';
    } else if (questionElement.querySelector('input[type="radio"]')) {
      questionType = 'multiple-choice';
    } else if (questionElement.querySelector('input[type="checkbox"]')) {
      questionType = 'checkbox';
    } else if (questionElement.querySelector('select')) {
      questionType = 'dropdown';
    }
    
    console.log('Question type detected:', questionType);
    
    // Query ChatGPT for the answer
    const response = await chrome.runtime.sendMessage({
      action: 'queryChatGPT',
      question: questionText
    } as ChatGPTQueryMessage) as ChatGPTResponse;
    
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
        (inputEl as HTMLInputElement | HTMLTextAreaElement).value = answer;
        inputEl.dispatchEvent(new Event('input', { bubbles: true }));
        inputEl.dispatchEvent(new Event('change', { bubbles: true }));
      }
    } else if (questionType === 'multiple-choice') {
      // For Google Forms, we need to find the option that matches our answer
      const options = Array.from(questionElement.querySelectorAll('.docssharedWizToggleLabeledContainer') || 
                               questionElement.querySelectorAll('[role="radio"]') ||
                               questionElement.querySelectorAll('.freebirdFormviewerComponentsQuestionRadioChoice'));
      
      // Find best match
      const bestOption = findBestMatchingOption(options, answer);
      if (bestOption) {
        (bestOption as HTMLElement).click();
      }
    } else if (questionType === 'checkbox') {
      const options = Array.from(questionElement.querySelectorAll('.docssharedWizToggleLabeledContainer') || 
                               questionElement.querySelectorAll('[role="checkbox"]') ||
                               questionElement.querySelectorAll('.freebirdFormviewerComponentsQuestionCheckboxChoice'));
      
      // For checkboxes, we might need to select multiple options
      const optionsToSelect = findCheckboxOptionsToSelect(options, answer);
      for (const option of optionsToSelect) {
        (option as HTMLElement).click();
      }
    } else if (questionType === 'dropdown') {
      const selectEl = questionElement.querySelector('select');
      if (selectEl) {
        const options = Array.from(selectEl.querySelectorAll('option'));
        const bestOption = findBestMatchingOption(options, answer);
        
        if (bestOption) {
          const selectElement = selectEl as HTMLSelectElement;
          selectElement.value = bestOption.getAttribute('value') || '';
          selectEl.dispatchEvent(new Event('change', { bubbles: true }));
        }
      }
    }
    
  } catch (error) {
    console.error('Error processing question:', error);
  }
}
