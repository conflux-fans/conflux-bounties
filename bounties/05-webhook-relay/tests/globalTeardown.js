/**
 * Global teardown for Jest tests
 * This file ensures proper cleanup after all tests complete
 */

module.exports = async () => {
  console.log('Running global test teardown...');
  
  // Force garbage collection if available
  if (global.gc) {
    global.gc();
  }
  
  // Add any additional cleanup logic here if needed
  
  console.log('Global test teardown completed');
};