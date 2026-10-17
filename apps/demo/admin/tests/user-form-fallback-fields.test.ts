import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * UserForm 的 `fallbackEditableFields` 是服务端白名单 `USER_CREATE_DRAFT_FIELD_KEYS`
 * 的一份手抄兜底：create-form 拿不到时它决定哪些字段还能写。
 *
 * 两份列表相隔两个包，一份在前端组件里、一份在后端 schema 里，改一处忘另一处不会有
 * 任何类型或运行时报错——只会静默地把某个字段从「助手可写」变成「静默丢弃」。
 * 这个测试直接把两份源码读出来比对，让漂移变成一次失败。
 */

const REPO_ROOT = resolve(__dirname, '../../../..');

function readRepoFile(...segments: string[]): string {
  return readFileSync(resolve(REPO_ROOT, ...segments), 'utf8');
}

/** 取出一个数组字面量里的字符串项。两个来源的写法不同，用各自的锚点定位。 */
function readStringArray(body: string | undefined): string[] {
  expect(typeof body).toBe('string');
  return [...String(body).matchAll(/['"]([^'"]+)['"]/g)].map((match) => match[1]);
}

describe('UserForm 兜底字段集与服务端白名单一致', () => {
  const serverKeys = readStringArray(
    readRepoFile(
      'packages/core/system-api/src/core/schemas/user.ts',
    ).match(/USER_CREATE_DRAFT_FIELD_KEYS\s*=\s*\[([\s\S]*?)\]/)?.[1],
  );
  const fallbackKeys = readStringArray(
    readRepoFile(
      'packages/core/system-admin/src/pages/user/components/UserForm.tsx',
    ).match(
      /fallbackEditableFields\s*=\s*useMemo\([\s\S]*?\[([\s\S]*?)\]/,
    )?.[1],
  );

  it('两份列表逐项相同（顺序也一致，避免无意义的 diff）', () => {
    expect(fallbackKeys).toEqual(serverKeys);
  });

  it('不包含密码——密码永不允许进入草稿', () => {
    expect(serverKeys).not.toContain('password');
    expect(fallbackKeys).not.toContain('password');
  });
});
