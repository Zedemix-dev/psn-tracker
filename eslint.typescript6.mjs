// typescript-eslint (used by eslint-config-next/typescript) refuses TypeScript 7 and needs the
// TypeScript 6 JavaScript API. The project compiles with TypeScript 7 (tsc), so ESLint alone gets
// the side-by-side "typescript-6" copy: every require("typescript") made inside the ESLint process
// resolves to it. Remove this file (and the typescript-6 devDependency) once typescript-eslint
// supports TypeScript 7.
import Module, { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const typescript6 = require.resolve('typescript-6')
const originalResolve = Module._resolveFilename

Module._resolveFilename = function (request, ...rest) {
  if (request === 'typescript') return typescript6
  return originalResolve.call(this, request, ...rest)
}
