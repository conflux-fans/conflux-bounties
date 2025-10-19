import '@testing-library/jest-dom';

// @ts-ignore
globalThis.import = { meta: { env: {} } };

Object.defineProperty(window, 'matchMedia', {
  value: () => ({ matches: false, addListener: () => {}, removeListener: () => {} }),
});