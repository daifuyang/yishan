const originalWarn = console.warn;

console.warn = (...args) => {
  const message = String(args[0] ?? '');
  if (message.startsWith('[baseline-browser-mapping] The data in this module is over two months old.')) {
    return;
  }
  originalWarn(...args);
};
