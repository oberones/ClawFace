import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { createRequire } from "node:module";
import ts from "typescript";

const nodeRequire = createRequire(import.meta.url);

const COMPILER_OPTIONS = {
  esModuleInterop: true,
  jsx: ts.JsxEmit.ReactJSX,
  module: ts.ModuleKind.CommonJS,
  target: ts.ScriptTarget.ES2022,
};

function resolveLocalModule(specifier, fromDir) {
  const basePath = path.resolve(fromDir, specifier);
  const candidates = [
    basePath,
    `${basePath}.ts`,
    `${basePath}.tsx`,
    `${basePath}.js`,
    `${basePath}.mjs`,
    path.join(basePath, "index.ts"),
    path.join(basePath, "index.tsx"),
    path.join(basePath, "index.js"),
    path.join(basePath, "index.mjs"),
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
      return candidate;
    }
  }
  throw new Error(`Unable to resolve local module "${specifier}" from ${fromDir}`);
}

export function createTsModuleLoader() {
  const cache = new Map();

  const loadModule = (modulePath) => {
    const resolvedPath = path.resolve(modulePath);
    const cached = cache.get(resolvedPath);
    if (cached) {
      return cached.exports;
    }

    const source = fs.readFileSync(resolvedPath, "utf8");
    const transpiled = ts.transpileModule(source, {
      compilerOptions: COMPILER_OPTIONS,
      fileName: resolvedPath,
    });
    const module = { exports: {} };
    cache.set(resolvedPath, module);

    const localRequire = (specifier) => {
      if (specifier.startsWith(".") || specifier.startsWith("/")) {
        const dependencyPath = resolveLocalModule(specifier, path.dirname(resolvedPath));
        if (dependencyPath.endsWith(".ts") || dependencyPath.endsWith(".tsx")) {
          return loadModule(dependencyPath);
        }
        return nodeRequire(dependencyPath);
      }
      return nodeRequire(specifier);
    };

    const wrapped = `(function (exports, require, module, __filename, __dirname) {${transpiled.outputText}\n})`;
    const compiled = vm.runInThisContext(wrapped, { filename: resolvedPath });
    compiled(module.exports, localRequire, module, resolvedPath, path.dirname(resolvedPath));
    return module.exports;
  };

  return { loadModule };
}
