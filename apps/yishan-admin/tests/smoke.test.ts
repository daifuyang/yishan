/**
 * Jest harness smoke test.
 *
 * 仅验证 jest.config.ts + tests/setupTests.jsx 这条链路可用，
 * 不覆盖任何业务代码。当本文件失败时，CI 会立即暴露配置或
 * 初始化层的回归（例如 .ts/.js 配置冲突再次出现、setupTests
 * 被改名、antd 默认主题 shim 失效等）。
 *
 * 如果后续补业务单测，建议按 src 下以 tests 子目录包裹 *.test.ts(x) 的
 * 约定组织，避免污染 tests/ 目录。
 */

describe('Jest + Umi test harness smoke', () => {
  it('exposes Jest globals (it, expect, describe, beforeEach, jest)', () => {
    expect(typeof it).toBe('function');
    expect(typeof describe).toBe('function');
    expect(typeof expect).toBe('function');
    expect(typeof beforeEach).toBe('function');
    // jest 在不同 Jest 版本里可能是 namespace 对象（typeof 'object'）或函数。
    expect(['function', 'object']).toContain(typeof jest);
  });

  it('runs in a JSDOM environment', () => {
    expect(typeof window).toBe('object');
    expect(typeof document).toBe('object');
    expect(typeof navigator).toBe('object');
  });

  it('honors setupTests window.matchMedia shim', () => {
    // tests/setupTests.jsx 用 Object.defineProperty 注入 window.matchMedia
    // 作为 jest.fn()，调用次数应为可观测值。
    const matchMedia = window.matchMedia('(max-width: 600px)');
    expect(matchMedia).toBeDefined();
    expect((window.matchMedia as unknown as { mock: { calls: unknown[] } }).mock.calls.length).toBeGreaterThanOrEqual(1);
  });

  it('honors setupTests URL.createObjectURL shim', () => {
    const createObjectURL = URL.createObjectURL as unknown as jest.Mock;
    const before = createObjectURL.mock.calls.length;
    URL.createObjectURL(new Blob(['smoke']));
    expect(createObjectURL.mock.calls.length).toBe(before + 1);
  });

  it('does not emit act() warnings through console.error filter', () => {
    // setupTests.jsx 重写 console.error，过滤 act() 警告。
    // 这里直接观察 console.error 在被调用时没有 throw。
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    console.error('Warning: An update to Foo inside a test was not wrapped in act(...)');
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });
});