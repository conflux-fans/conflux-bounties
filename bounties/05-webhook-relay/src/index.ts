// Main application entry point
import { Application } from './Application';

export * from './types';
export { Application };

// If this file is run directly, start the application
if (require.main === module) {
  const app = new Application();
  
  app.start().catch((error) => {
    console.error('Failed to start application:', error);
    process.exit(1);
  });
}