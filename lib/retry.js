'use strict';

/**
 * Retry utility module
 * Provides retry logic for operations that may fail transiently
 * 
 * @module lib/retry
 */

/**
 * @typedef {Object} RetryResult
 * @property {boolean} success - Whether the operation succeeded
 * @property {number} attempts - Number of attempts made
 * @property {*} [result] - Result of successful operation
 * @property {Error} [error] - Last error if failed
 */

/**
 * Executes an operation with retry logic
 * 
 * @param {Function} operation - Async function to execute
 * @param {Object} options - Retry options
 * @param {number} [options.maxRetries=3] - Maximum number of retry attempts
 * @param {number} [options.delay=1000] - Delay between retries in ms
 * @param {Function} [options.onRetry] - Callback called before each retry
 * @returns {Promise<RetryResult>} Result of the operation
 */
async function withRetry(operation, options = {}) {
  const maxRetries = options.maxRetries ?? 3;
  const delay = options.delay ?? 1000;
  const onRetry = options.onRetry ?? (() => {});

  let lastError;
  let attempts = 0;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    attempts = attempt;
    try {
      const result = await operation();
      return {
        success: true,
        attempts,
        result,
      };
    } catch (error) {
      lastError = error;

      if (attempt < maxRetries) {
        onRetry(attempt, error);
        if (delay > 0) {
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
  }

  return {
    success: false,
    attempts,
    error: lastError,
  };
}

/**
 * Synchronous version for testing - simulates retry behavior
 * 
 * @param {Function} operation - Function that returns { success: boolean, error?: Error }
 * @param {number} maxRetries - Maximum number of retry attempts
 * @returns {RetryResult} Result of the operation
 */
function withRetrySync(operation, maxRetries = 3) {
  let lastError;
  let attempts = 0;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    attempts = attempt;
    const result = operation(attempt);
    
    if (result.success) {
      return {
        success: true,
        attempts,
        result: result.value,
      };
    }
    
    lastError = result.error || new Error('Operation failed');
  }

  return {
    success: false,
    attempts,
    error: lastError,
  };
}

module.exports = {
  withRetry,
  withRetrySync,
};
