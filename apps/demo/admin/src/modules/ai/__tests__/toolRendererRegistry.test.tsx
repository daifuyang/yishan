import React from 'react';
import { createToolRendererRegistry } from '../tools/registry';

it('resolves trusted tool overrides, presentation mappings and the generic fallback deterministically', () => {
  const fallback = () => <div>通用</div>;
  const query = () => <div>查询</div>;
  const special = () => <div>特殊</div>;
  const registry = createToolRendererRegistry(fallback);
  registry.register('query', query);
  registry.registerTool('trusted_lookup', special);
  expect(registry.resolve('query', 'trusted_lookup')).toBe(special);
  expect(registry.resolve('query', 'other')).toBe(query);
  expect(registry.resolve('https://untrusted.test/component', 'other')).toBe(fallback);
  expect(registry.resolve(undefined, 'other')).toBe(fallback);
  expect(() => registry.register('query', special)).toThrow(/重复注册/);
  expect(registry.resolve('query', 'other')).toBe(query);
});
