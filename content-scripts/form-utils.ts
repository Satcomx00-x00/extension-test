/**
 * Utility functions for form processing
 */

interface QuestionOption {
  element: Element;
  text: string;
}

/**
 * Finds the best matching option from a list based on the answer
 */
export function findBestMatchingOption(options: Element[], answer: string): Element | null {
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
    let bestMatch: Element | null = null;
    let bestMatchCount = 0;
    
    for (const option of optionsWithText) {
      if (!option.text) continue;
      
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
    } else if (options.length > 0) {
      console.log('No good match found, defaulting to first option');
      bestMatch = options[0]; // Default to first option if no match
    }
    
    return bestMatch;
  } catch (error) {
    console.error('Error finding best matching option:', error);
    return options.length > 0 ? options[0] : null; // Default to first option
  }
}

/**
 * Finds which checkbox options should be selected based on the answer
 */
export function findCheckboxOptionsToSelect(options: Element[], answer: string): Element[] {
  try {
    const answerLower = answer.toLowerCase();
    const optionsToSelect: Element[] = [];
    
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
          if (!option.text) continue;
          
          const optionWords = option.text.split(/\s+/);
          for (const word of optionWords) {
            if (word.length > 3 && answerLower.includes(word)) {
              optionsToSelect.push(option.element);
              break;
            }
          }
        }
      } else {
        // If still no matches, just pick the best matching one
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
