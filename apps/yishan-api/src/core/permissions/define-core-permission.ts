/**
 * Core permission metadata declared next to the module that owns it.
 *
 * This deliberately is a plain function rather than a TypeScript decorator:
 * it is type-safe at runtime and can be statically inspected by the quality
 * gate without reflection or compiler flags.
 */
export interface CorePermissionDefinition {
  code: string;
  label: string;
  group: 'system';
  description?: string;
}

export function defineCorePermission<T extends CorePermissionDefinition>(definition: T): Readonly<T> {
  return Object.freeze(definition);
}
