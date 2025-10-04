declare global {
  // eslint-disable-next-line no-var
  var module: { exports: unknown } | undefined;
  // eslint-disable-next-line no-var
  var exports: unknown;
}

if (typeof globalThis.module === 'undefined') {
  globalThis.module = { exports: {} };
}

if (typeof globalThis.exports === 'undefined') {
  globalThis.exports = globalThis.module!.exports;
}

export {};
