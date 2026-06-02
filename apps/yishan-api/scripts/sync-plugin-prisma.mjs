import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const rootDir = new URL('..', import.meta.url).pathname;
const modulesDir = join(rootDir, 'src/plugins/modules');
const prismaSchemaDir = join(rootDir, 'prisma/schema');
const systemSchemaPath = join(prismaSchemaDir, 'system.prisma');
const sourceCandidates = ['schema.prisma.fragment', 'schema.prisma'];
const extensionModelNames = new Set(['SysUser']);

const generatedHeader = (moduleName, sourceFileName) => [
  '// AUTO-GENERATED FILE. DO NOT EDIT DIRECTLY.',
  `// Source: src/plugins/modules/${moduleName}/prisma/${sourceFileName}`,
  '',
].join('\n');

function resolveModuleSource(moduleName) {
  for (const fileName of sourceCandidates) {
    const source = join(modulesDir, moduleName, 'prisma', fileName);
    if (existsSync(source)) {
      return { source, sourceFileName: fileName };
    }
  }

  return null;
}

function assertNoDatasourceOrGenerator(moduleName, sourceContent) {
  if (/^\s*datasource\s+\w+\s*\{/m.test(sourceContent)) {
    throw new Error(`[${moduleName}] plugin schema must not define datasource block`);
  }
  if (/^\s*generator\s+\w+\s*\{/m.test(sourceContent)) {
    throw new Error(`[${moduleName}] plugin schema must not define generator block`);
  }
}

function assertNoForbiddenModels(moduleName, sourceContent) {
  const modelNames = Array.from(sourceContent.matchAll(/^\s*model\s+(\w+)\s*\{/gm)).map((item) => item[1]);
  const hit = modelNames.find((name) => extensionModelNames.has(name));
  if (hit) {
    return;
  }
}

function extractModelBlock(content, modelName) {
  const modelHead = new RegExp(`(^\\s*model\\s+${modelName}\\s*\\{)`, 'm');
  const headMatch = modelHead.exec(content);
  if (!headMatch) {
    return null;
  }

  const start = headMatch.index;
  const afterHead = content.indexOf('{', start);
  let depth = 0;
  let end = -1;
  for (let i = afterHead; i < content.length; i += 1) {
    const ch = content[i];
    if (ch === '{') depth += 1;
    if (ch === '}') {
      depth -= 1;
      if (depth === 0) {
        end = i;
        break;
      }
    }
  }
  if (end === -1) {
    return null;
  }

  const fullText = content.slice(start, end + 1);
  const body = content.slice(afterHead + 1, end);
  return { start, end: end + 1, fullText, body };
}

function extractExtensionFields(modelBody) {
  const lines = modelBody
    .split('\n')
    .map((line) => line.trimEnd())
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('//'))
    .filter((line) => !line.startsWith('@@'))
    .filter((line) => !line.startsWith('@@'))
    .filter((line) => !line.startsWith('id '));

  return Array.from(new Set(lines));
}

function parseFieldSignature(line) {
  const normalized = line.trim().replace(/\s+/g, ' ');
  const tokens = normalized.split(' ');
  if (tokens.length < 2) {
    return null;
  }
  return { name: tokens[0], type: tokens[1], normalized };
}

function injectFieldsToModel(schemaContent, modelName, fieldsToInject) {
  if (fieldsToInject.length === 0) {
    return schemaContent;
  }

  const block = extractModelBlock(schemaContent, modelName);
  if (!block) {
    throw new Error(`system schema missing model \"${modelName}\"`);
  }

  const existingBody = block.body;
  const missing = fieldsToInject.filter((field) => {
    const incoming = parseFieldSignature(field);
    if (!incoming) {
      return false;
    }

    const fieldName = incoming.name;
    const lineMatch = existingBody.match(new RegExp(`^\\s*${fieldName}\\s+(.+)$`, 'm'));
    if (!lineMatch) {
      return true;
    }

    const existing = parseFieldSignature(`${fieldName} ${lineMatch[1].trim()}`);
    if (existing && existing.type === incoming.type) {
      return false;
    }

    throw new Error(`conflict on ${modelName}.${fieldName}: existing field differs from plugin declaration`);
  });

  if (missing.length === 0) {
    return schemaContent;
  }

  const insertAt = (() => {
    const indexMatch = /^\s*@@/m.exec(block.fullText);
    if (indexMatch && indexMatch.index > 0) {
      return indexMatch.index;
    }
    return block.fullText.lastIndexOf('}');
  })();

  const beforeInsert = block.fullText.slice(0, insertAt).trimEnd();
  const suffix = block.fullText.slice(insertAt);
  const injectedLines = missing.map((line) => `  ${line}`).join('\n');
  const nextBlock = `${beforeInsert}\n\n  // Injected from plugin schemas\n${injectedLines}\n\n${suffix}`;
  return `${schemaContent.slice(0, block.start)}${nextBlock}${schemaContent.slice(block.end)}`;
}

function syncModuleSchema(moduleName, extensionFieldsByModel) {
  const resolved = resolveModuleSource(moduleName);
  if (!resolved) {
    return false;
  }

  const { source, sourceFileName } = resolved;

  const target = join(prismaSchemaDir, `${moduleName}.prisma`);
  const sourceContent = readFileSync(source, 'utf8').trimEnd();
  assertNoDatasourceOrGenerator(moduleName, sourceContent);
  assertNoForbiddenModels(moduleName, sourceContent);

  let nextSourceContent = sourceContent;
  for (const modelName of extensionModelNames) {
    const block = extractModelBlock(nextSourceContent, modelName);
    if (!block) {
      continue;
    }
    const fields = extractExtensionFields(block.body);
    if (fields.length > 0) {
      if (!extensionFieldsByModel.has(modelName)) {
        extensionFieldsByModel.set(modelName, []);
      }
      extensionFieldsByModel.get(modelName).push(...fields);
    }
    nextSourceContent = `${nextSourceContent.slice(0, block.start).trimEnd()}\n\n${nextSourceContent.slice(block.end).trimStart()}`.trim();
  }

  const nextContent = `${generatedHeader(moduleName, sourceFileName)}${nextSourceContent}\n`;
  writeFileSync(target, nextContent, 'utf8');
  return true;
}

function injectExtensions(extensionFieldsByModel) {
  if (!existsSync(systemSchemaPath)) {
    return;
  }

  let systemContent = readFileSync(systemSchemaPath, 'utf8');
  for (const [modelName, fields] of extensionFieldsByModel.entries()) {
    const uniqueFields = Array.from(new Set(fields));
    systemContent = injectFieldsToModel(systemContent, modelName, uniqueFields);
  }
  writeFileSync(systemSchemaPath, systemContent, 'utf8');
}

function main() {
  if (!existsSync(modulesDir)) {
    console.log('No plugin modules directory found, skip sync.');
    return;
  }

  mkdirSync(prismaSchemaDir, { recursive: true });
  const moduleNames = readdirSync(modulesDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();

  const extensionFieldsByModel = new Map();
  const synced = [];
  for (const moduleName of moduleNames) {
    if (syncModuleSchema(moduleName, extensionFieldsByModel)) {
      synced.push(moduleName);
    }
  }

  injectExtensions(extensionFieldsByModel);

  if (synced.length === 0) {
    console.log('No plugin prisma schema found, nothing synced.');
    return;
  }

  console.log(`Synced plugin prisma schema: ${synced.join(', ')}`);
}

main();
