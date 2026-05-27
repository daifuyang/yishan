type OpenApiSchema = {
  type?: string
  enum?: unknown[]
  default?: unknown
  anyOf?: OpenApiSchema[]
  properties?: Record<string, OpenApiSchema>
  required?: string[]
  description?: string
  $ref?: string
}

type OpenApiOperation = {
  operationId?: string
  parameters?: Array<{ name: string; in: string; required?: boolean; schema?: OpenApiSchema }>
  requestBody?: {
    required?: boolean
    content?: Record<string, { schema?: OpenApiSchema }>
  }
}

type OpenApiDoc = {
  paths?: Record<string, Record<string, OpenApiOperation>>
  components?: {
    schemas?: Record<string, OpenApiSchema>
  }
}

export interface EndpointInputSpec {
  operationId?: string
  queryRequired: string[]
  queryOptional: string[]
  bodyRequired: string[]
  bodyOptional: string[]
  bodyProperties: Record<string, { type?: string; description?: string; enum?: unknown[]; default?: unknown }>
  hasBody: boolean
}

function normalizeApiPath(path: string): string {
  const slashFixed = path.endsWith('/') && path !== '/' ? path.slice(0, -1) : path
  return slashFixed.replace(':id', '{id}')
}

function findOperation(doc: OpenApiDoc, path: string, method: string): OpenApiOperation | undefined {
  const lowerMethod = method.toLowerCase()
  const normalized = normalizeApiPath(path)
  const withSlash = `${normalized}/`
  return doc.paths?.[normalized]?.[lowerMethod] || doc.paths?.[withSlash]?.[lowerMethod]
}

function resolveSchema(schema: OpenApiSchema | undefined, doc: OpenApiDoc): OpenApiSchema | undefined {
  if (!schema) return undefined
  if (!schema.$ref) return schema
  const prefix = '#/components/schemas/'
  if (!schema.$ref.startsWith(prefix)) return undefined
  const key = schema.$ref.slice(prefix.length)
  return doc.components?.schemas?.[key]
}

function extractObjectFields(schema: OpenApiSchema | undefined, doc: OpenApiDoc): { required: string[]; optional: string[] } {
  const resolved = resolveSchema(schema, doc)
  if (!resolved || resolved.type !== 'object') {
    return { required: [], optional: [] }
  }
  const required = new Set(resolved.required || [])
  const props = Object.keys(resolved.properties || {})
  const optional = props.filter((name) => !required.has(name))
  return { required: [...required], optional }
}

function extractObjectProperties(
  schema: OpenApiSchema | undefined,
  doc: OpenApiDoc
): Record<string, { type?: string; description?: string; enum?: unknown[]; default?: unknown }> {
  const resolved = resolveSchema(schema, doc)
  if (!resolved || resolved.type !== 'object' || !resolved.properties) {
    return {}
  }
  const result: Record<string, { type?: string; description?: string; enum?: unknown[]; default?: unknown }> = {}

  const inferType = (field: OpenApiSchema): string | undefined => {
    if (field.type) return field.type
    if (field.anyOf && field.anyOf.length > 0) {
      const firstTyped = field.anyOf.find((item) => item.type)
      return firstTyped?.type
    }
    return undefined
  }

  for (const [key, value] of Object.entries(resolved.properties)) {
    const field = resolveSchema(value, doc) || value
    result[key] = {
      type: inferType(field),
      description: field.description,
      enum: field.enum,
      default: field.default
    }
  }
  return result
}

export async function getEndpointInputSpec(params: {
  baseUrl: string
  path: string
  method: 'GET' | 'POST' | 'PUT' | 'DELETE'
}): Promise<EndpointInputSpec | null> {
  const url = new URL('/api/docs/json', params.baseUrl).toString()
  const response = await fetch(url)
  if (!response.ok) {
    return null
  }
  const doc = (await response.json()) as OpenApiDoc
  const op = findOperation(doc, params.path, params.method)
  if (!op) {
    return null
  }

  const queryRequired: string[] = []
  const queryOptional: string[] = []
  for (const item of op.parameters || []) {
    if (item.in !== 'query') continue
    if (item.required) queryRequired.push(item.name)
    else queryOptional.push(item.name)
  }

  const requestSchema = op.requestBody?.content?.['application/json']?.schema
  const bodyFields = extractObjectFields(requestSchema, doc)

  return {
    operationId: op.operationId,
    queryRequired,
    queryOptional,
    bodyRequired: bodyFields.required,
    bodyOptional: bodyFields.optional,
    bodyProperties: extractObjectProperties(requestSchema, doc),
    hasBody: Boolean(requestSchema)
  }
}
