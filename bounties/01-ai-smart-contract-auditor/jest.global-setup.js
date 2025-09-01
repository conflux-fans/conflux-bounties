module.exports = async () => {
  // Global setup for all tests
  process.env.NODE_ENV = 'test'
  process.env.OPENAI_API_KEY = 'test-openai-key'
  process.env.ANTHROPIC_API_KEY = 'test-anthropic-key'
}