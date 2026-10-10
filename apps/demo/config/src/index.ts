/** Product configuration owns the default address; complete targets override port-only settings. */
export function resolveApiTarget(
  defaultTarget: string,
  env: Readonly<Record<string, string | undefined>> = process.env,
): string {
  const explicitTarget = env.API_TARGET?.trim() || env.YISHAN_API_TARGET?.trim()
  if (explicitTarget) return explicitTarget

  const port = env.YISHAN_API_PORT?.trim()
  if (!port) return defaultTarget
  if (!/^\d+$/.test(port) || Number(port) < 1 || Number(port) > 65535) {
    throw new Error('YISHAN_API_PORT must be an integer between 1 and 65535')
  }

  const target = new URL(defaultTarget)
  target.port = port
  // URL adds a slash to a bare origin; keep the caller's original address shape.
  return !defaultTarget.endsWith('/') && !target.search && !target.hash
    ? target.toString().replace(/\/$/, '')
    : target.toString()
}
