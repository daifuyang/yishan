/** Partition operations without changing any server schema or importing server code. */
function selectOpenApi(document, includePath) {
  const paths = Object.fromEntries(Object.entries(document.paths).filter(([path]) => includePath(path)))
  const components = { schemas: {} }
  const seen = new Set()
  const visit = (value) => {
    if (!value || typeof value !== 'object') return
    if (Array.isArray(value)) { value.forEach(visit); return }
    for (const requirement of value.security ?? []) for (const name of Object.keys(requirement)) {
      if (document.components?.securitySchemes?.[name]) {
        components.securitySchemes ??= {}
        components.securitySchemes[name] = document.components.securitySchemes[name]
      }
    }
    if (typeof value.$ref === 'string' && value.$ref.startsWith('#/components/')) {
      const [, , kind, name] = value.$ref.split('/')
      if (!seen.has(value.$ref)) {
        seen.add(value.$ref)
        const definition = document.components?.[kind]?.[name]
        if (!definition) throw new Error(`Unresolved OpenAPI reference: ${value.$ref}`)
        components[kind] ??= {}
        components[kind][name] = definition
        visit(definition)
      }
    }
    Object.values(value).forEach(visit)
  }
  visit(paths)
  visit({ security: document.security })
  return { ...document, paths, components }
}
module.exports = { selectOpenApi }
