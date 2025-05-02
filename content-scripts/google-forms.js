"use strict";
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
        console.log('Starting to process Google Form...');
        // Try different selectors that Google Forms might use
        // The structure of Google Forms can change, so we check multiple possible selectors
        const selectors = [
            '.freebirdFormviewerComponentsQuestionBaseRoot', // Common selector for questions
            '.freebirdFormviewerViewItemsItemItem', // Alternative item selector
            '.freebirdFormviewerViewQuestionRoot', // Another question root
            '[role="listitem"]' // Generic role-based selector
        ];
        let questionElements = [];
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
    }
    catch (error) {
        console.error('Error processing Google Form:', error);
        throw error;
    }
}
async function processGoogleFormQuestion(questionElement) {
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
        }
        else if (questionElement.querySelector('textarea')) {
            questionType = 'paragraph';
        }
        else if (questionElement.querySelector('input[type="radio"]')) {
            questionType = 'multiple-choice';
        }
        else if (questionElement.querySelector('input[type="checkbox"]')) {
            questionType = 'checkbox';
        }
        else if (questionElement.querySelector('select')) {
            questionType = 'dropdown';
        }
        console.log('Question type detected:', questionType);
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
                inputEl.dispatchEvent(new Event('input', { bubbles: true }));
                inputEl.dispatchEvent(new Event('change', { bubbles: true }));
            }
        }
        else if (questionType === 'multiple-choice') {
            // For Google Forms, we need to find the option that matches our answer
            const options = Array.from(questionElement.querySelectorAll('.docssharedWizToggleLabeledContainer') ||
                questionElement.querySelectorAll('[role="radio"]') ||
                questionElement.querySelectorAll('.freebirdFormviewerComponentsQuestionRadioChoice'));
            // Find best match
            const bestOption = googleFormsFindBestMatchingOption(options, answer);
            if (bestOption) {
                bestOption.click();
            }
        }
        else if (questionType === 'checkbox') {
            const options = Array.from(questionElement.querySelectorAll('.docssharedWizToggleLabeledContainer') ||
                questionElement.querySelectorAll('[role="checkbox"]') ||
                questionElement.querySelectorAll('.freebirdFormviewerComponentsQuestionCheckboxChoice'));
            // For checkboxes, we might need to select multiple options
            const optionsToSelect = googleFormsFindCheckboxOptionsToSelect(options, answer);
            for (const option of optionsToSelect) {
                option.click();
            }
        }
        else if (questionType === 'dropdown') {
            const selectEl = questionElement.querySelector('select');
            if (selectEl) {
                const options = Array.from(selectEl.querySelectorAll('option'));
                const bestOption = googleFormsFindBestMatchingOption(options, answer);
                if (bestOption) {
                    const selectElement = selectEl;
                    selectElement.value = bestOption.getAttribute('value') || '';
                    selectEl.dispatchEvent(new Event('change', { bubbles: true }));
                }
            }
        }
    }
    catch (error) {
        console.error('Error processing question:', error);
    }
}
// Helper functions specific to Google Forms
function googleFormsFindBestMatchingOption(options, answer) {
    try {
        const answerLower = answer.toLowerCase();
        // Get option text for each option
        const optionsWithText = options.map(opt => {
            // Try different ways to get the text content
            let text = '';
            // Try to get text from span inside option
            const textSpan = opt.querySelector('span');
            if (textSpan && textSpan.textContent) {
                text = textSpan.textContent.trim().toLowerCase();
            }
            // If no text from span, get from option itself
            else if (opt.textContent) {
                text = opt.textContent.trim().toLowerCase();
            }
            return {
                element: opt,
                text: text
            };
        });
        // Debug output
        console.log('Available options:', optionsWithText.map(o => o.text));
        // Check if any option text is contained in the answer
        for (const option of optionsWithText) {
            if (option.text && answerLower.includes(option.text)) {
                console.log('Found direct match with option:', option.text);
                return option.element;
            }
        }
        // Check if answer is contained in any option
        for (const option of optionsWithText) {
            if (option.text && option.text.includes(answerLower)) {
                console.log('Found answer contained in option:', option.text);
                return option.element;
            }
        }
        // If no direct match, look for key terms
        const answerWords = answerLower.split(/\s+/);
        let bestMatch = null;
        let bestMatchCount = 0;
        for (const option of optionsWithText) {
            if (!option.text)
                continue;
            const optionWords = option.text.split(/\s+/);
            let matchCount = 0;
            for (const word of optionWords) {
                if (word.length > 3 && answerWords.includes(word)) {
                    matchCount++;
                }
            }
            if (matchCount > bestMatchCount) {
                bestMatchCount = matchCount;
                bestMatch = option.element;
            }
        }
        if (bestMatch) {
            console.log('Found best match with word count:', bestMatchCount);
        }
        else if (options.length > 0) {
            console.log('No good match found, defaulting to first option');
            bestMatch = options[0]; // Default to first option if no match
        }
        return bestMatch;
    }
    catch (error) {
        console.error('Error finding best matching option:', error);
        return options.length > 0 ? options[0] : null; // Default to first option
    }
}
function googleFormsFindCheckboxOptionsToSelect(options, answer) {
    try {
        const answerLower = answer.toLowerCase();
        const optionsToSelect = [];
        // Get option text for each option
        const optionsWithText = options.map(opt => {
            // Try different ways to get the text content
            let text = '';
            // Try to get text from span inside option
            const textSpan = opt.querySelector('span');
            if (textSpan && textSpan.textContent) {
                text = textSpan.textContent.trim().toLowerCase();
            }
            // If no text from span, get from option itself
            else if (opt.textContent) {
                text = opt.textContent.trim().toLowerCase();
            }
            return {
                element: opt,
                text: text
            };
        });
        // Check each option against the answer
        for (const option of optionsWithText) {
            if (option.text && answerLower.includes(option.text)) {
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
                    if (!option.text)
                        continue;
                    const optionWords = option.text.split(/\s+/);
                    for (const word of optionWords) {
                        if (word.length > 3 && answerLower.includes(word)) {
                            optionsToSelect.push(option.element);
                            break;
                        }
                    }
                }
            }
            else {
                // If still no matches, just pick the best matching one
                const bestMatch = googleFormsFindBestMatchingOption(options, answer);
                if (bestMatch)
                    optionsToSelect.push(bestMatch);
            }
        }
        return optionsToSelect;
    }
    catch (error) {
        console.error('Error finding checkbox options to select:', error);
        return [];
    }
}
