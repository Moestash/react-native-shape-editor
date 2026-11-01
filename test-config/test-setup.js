global.IS_REACT_ACT_ENVIRONMENT = true;
// React still ships this renderer for library-level gesture regression tests.
// Keep all other warnings visible.
const originalError = console.error;
beforeAll(() => {
  jest.spyOn(console, 'error').mockImplementation((message, ...args) => {
    if (typeof message === 'string' && message.startsWith('react-test-renderer is deprecated')) return;
    originalError(message, ...args);
  });
});
afterAll(() => console.error.mockRestore());
