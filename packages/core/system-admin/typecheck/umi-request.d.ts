import '@umijs/max';

// Max publishes the request export through each host's generated .umi files.
// Standalone package checking needs only the official data-returning overload
// used by generated clients. This declaration is not part of public exports;
// the host keeps Umi's full RequestOptions and getResponse overloads.
declare module '@umijs/max' {
  export function request<T>(url: string, options?: Record<string, unknown>): Promise<T>;
}
