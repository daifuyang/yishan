# System Admin

`@yishan/core-system-admin` owns the default System business screens and their shared controls. It exposes source files for the consuming Umi application to compile with its own styles and runtime configuration.

Wrap System screens and controls in `SystemAdminProvider`. Pass the product's dictionary values, current user, cloud storage configuration and upload callback through its typed `value` prop. The package does not read the product's Umi models or private source aliases.

- `./pages/<name>` exposes a default System page.
- `./components/<name>` exposes a System control; `./components` groups the existing controls.
- `./services/<name>` exposes the generated System client.
- `./types` exposes stable identity and attachment types and the generated `SystemAPI` declarations.
- `./attachment-upload` exposes the existing System upload helpers.
- `./umi` exposes the build-time page registry and OpenAPI output directory.

The generated client uses the consuming application's official `@umijs/max` request runtime, so its existing authentication and error handling apply. OpenAPI generation belongs to product composition: filter the System operations, use namespace `SystemAPI`, and write into the directory exposed by `./umi`. Business module clients stay in the product.

Run `pnpm --filter @yishan/core-system-admin typecheck` to check the package. The Demo Admin consumer tests exercise the provider and a real System page through the public package exports.

Max declares its request export in the host's generated `.umi` files. Standalone checking uses a private compile-time declaration of the official data-returning request overload in `typecheck/umi-request.d.ts`; it preserves generated response types without importing a host's private files. The host's typecheck uses its own full Umi declarations.
