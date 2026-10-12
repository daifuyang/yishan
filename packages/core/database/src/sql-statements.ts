const breakpoint = '--> statement-breakpoint'

export function splitMigrationStatements(content: string): string[] {
  const statements: string[] = []
  let current = ''
  let quote: string | undefined
  const finish = () => {
    if (current.trim()) statements.push(current.trim())
    current = ''
  }
  for (let index = 0; index < content.length; index++) {
    const char = content[index]
    if (quote) {
      current += char
      if (char === '\\' && index + 1 < content.length) current += content[++index]
      else if (char === quote) {
        if (content[index + 1] === quote) current += content[++index]
        else quote = undefined
      }
      continue
    }
    if (content.startsWith(breakpoint, index)) {
      finish()
      index += breakpoint.length - 1
    } else if (char === "'" || char === '"' || char === '`') {
      quote = char
      current += char
    } else if (char === '#' || (content.startsWith('--', index) && /\s/.test(content[index + 2] ?? ' '))) {
      const newline = content.indexOf('\n', index)
      index = newline === -1 ? content.length : newline
      current += '\n'
    } else if (content.startsWith('/*', index)) {
      const end = content.indexOf('*/', index + 2)
      if (end === -1) throw new Error('Unterminated SQL comment')
      // MySQL version and optimizer comments can contain executable SQL.
      current += content[index + 2] === '!' || content[index + 2] === '+' ? content.slice(index, end + 2) : ' '
      index = end + 1
    } else if (char === ';') finish()
    else current += char
  }
  if (quote) throw new Error('Unterminated SQL quoted value or identifier')
  finish()
  if (statements.some((statement) => /^DELIMITER\b/i.test(statement))) {
    throw new Error('DELIMITER is a mysql CLI command and is not supported in migration SQL')
  }
  return statements
}

export interface CreatedTable { schema?: string; name: string }

export function createdTable(statement: string): CreatedTable | undefined {
  const executable = statement.replace(/^\/\*!\d*\s*([\s\S]*?)\*\/$/, '$1').trim()
  const identifier = '(?:`(?:``|[^`])+`|[A-Za-z_$][A-Za-z0-9_$]*)'
  const match = new RegExp(`^CREATE\\s+(?:TEMPORARY\\s+)?TABLE\\s+(?:IF\\s+NOT\\s+EXISTS\\s+)?(${identifier})(?:\\s*\\.\\s*(${identifier}))?`, 'i').exec(executable)
  if (!match) return undefined
  const unquote = (value: string) => value.startsWith('`') ? value.slice(1, -1).replace(/``/g, '`') : value
  return match[2] ? { schema: unquote(match[1]), name: unquote(match[2]) } : { name: unquote(match[1]) }
}
