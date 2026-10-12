export function selectOpenApi<T extends { paths: Record<string, unknown> }>(document: T, includePath: (path: string) => boolean): T
