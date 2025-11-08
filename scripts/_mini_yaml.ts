// RESUME_MARKER: CHK_1
/* eslint-disable @typescript-eslint/no-explicit-any */

type YAMLValue = any;

type Line = {
  indent: number;
  content: string;
};

function iterLines(text: string): Line[] {
  const result: Line[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const stripped = raw.trim();
    if (!stripped || stripped.startsWith('#')) {
      continue;
    }
    const indent = raw.length - raw.replace(/^\s+/, '').length;
    let content = raw.slice(indent).trim();
    if (content.startsWith('#')) {
      continue;
    }
    const hashIndex = content.indexOf(' #');
    if (hashIndex !== -1) {
      content = content.slice(0, hashIndex).trimEnd();
    }
    if (!content) {
      continue;
    }
    result.push({ indent, content });
  }
  return result;
}

function parseValue(token: string): YAMLValue {
  const t = token.trim();
  if (t === '') {
    return null;
  }
  const lower = t.toLowerCase();
  if (lower === 'true') return true;
  if (lower === 'false') return false;
  if (lower === 'null' || lower === 'none') return null;
  if ((t.startsWith("'") && t.endsWith("'")) || (t.startsWith('"') && t.endsWith('"'))) {
    return t.slice(1, -1);
  }
  if (t.startsWith('[') && t.endsWith(']')) {
    const inner = t.slice(1, -1).trim();
    if (!inner) return [];
    return splitItems(inner).map(parseValue);
  }
  if (t.startsWith('{') && t.endsWith('}')) {
    const inner = t.slice(1, -1).trim();
    const obj: Record<string, YAMLValue> = {};
    if (!inner) return obj;
    for (const item of splitItems(inner)) {
      const [key, value] = splitPair(item);
      obj[key] = parseValue(value);
    }
    return obj;
  }
  if (/^[+-]?\d+$/.test(t)) {
    const intVal = Number.parseInt(t, 10);
    if (!Number.isNaN(intVal)) {
      return intVal;
    }
  }
  if (/^[+-]?(\d+\.\d*|\.\d+)([eE][+-]?\d+)?$/.test(t) || /^[+-]?\d+[eE][+-]?\d+$/.test(t)) {
    const floatVal = Number.parseFloat(t);
    if (!Number.isNaN(floatVal)) {
      return floatVal;
    }
  }
  return t;
}

function splitItems(text: string): string[] {
  const items: string[] = [];
  let current = '';
  let depth = 0;
  let quote: string | null = null;
  let escape = false;
  for (const ch of text) {
    if (quote) {
      current += ch;
      if (escape) {
        escape = false;
        continue;
      }
      if (ch === '\\') {
        escape = true;
        continue;
      }
      if (ch === quote) {
        quote = null;
      }
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      current += ch;
      continue;
    }
    if (ch === '[' || ch === '{') {
      depth += 1;
      current += ch;
      continue;
    }
    if (ch === ']' || ch === '}') {
      depth -= 1;
      current += ch;
      continue;
    }
    if (ch === ',' && depth === 0) {
      if (current.trim()) {
        items.push(current.trim());
      }
      current = '';
      continue;
    }
    current += ch;
  }
  if (current.trim()) {
    items.push(current.trim());
  }
  return items;
}

function splitPair(item: string): [string, string] {
  const idx = item.indexOf(':');
  if (idx === -1) {
    throw new Error(`Invalid mapping token: ${item}`);
  }
  const key = item
    .slice(0, idx)
    .trim()
    .replace(/^['"]|['"]$/g, '');
  const value = item.slice(idx + 1).trim();
  return [key, value];
}

type ParseResult = [YAMLValue, number];

type LineList = Line[];

function parseBlock(entries: LineList, start: number, indent: number): ParseResult {
  const result: Record<string, YAMLValue> = {};
  let i = start;
  while (i < entries.length) {
    const line = entries[i];
    if (line.indent < indent) break;
    if (line.indent > indent) {
      throw new Error(`Unexpected indentation at line: ${line.content}`);
    }
    if (line.content.startsWith('- ')) {
      throw new Error('Unexpected list item without key');
    }
    const hasColon = line.content.includes(':');
    const [rawKey, rawValue] = hasColon ? splitPair(line.content) : [line.content.trim(), ''];
    if (rawValue === '') {
      const next = entries[i + 1];
      if (next && next.indent > indent && next.content.startsWith('- ')) {
        const [value, newIndex] = parseList(entries, i + 1, indent + 2);
        result[rawKey] = value;
        i = newIndex;
        continue;
      }
      const [value, newIndex] = parseBlock(entries, i + 1, indent + 2);
      result[rawKey] = value;
      i = newIndex;
    } else {
      result[rawKey] = parseValue(rawValue);
      i += 1;
    }
  }
  return [result, i];
}

function parseList(entries: LineList, start: number, indent: number): ParseResult {
  const items: YAMLValue[] = [];
  let i = start;
  while (i < entries.length) {
    const line = entries[i];
    if (line.indent < indent) {
      break;
    }
    if (!line.content.startsWith('- ')) {
      break;
    }
    const token = line.content.slice(2).trim();
    if (token === '') {
      const [value, newIndex] = parseBlock(entries, i + 1, indent + 2);
      items.push(value);
      i = newIndex;
      continue;
    }
    if ((token.startsWith('{') && token.endsWith('}')) || (token.startsWith('[') && token.endsWith(']'))) {
      items.push(parseValue(token));
      i += 1;
      continue;
    }
    items.push(parseValue(token));
    i += 1;
  }
  return [items, i];
}

export function safeLoad(input: string | { read(): string }): YAMLValue {
  const text = typeof input === 'string' ? input : input.read();
  const lines = iterLines(text);
  if (lines.length === 0) {
    return {};
  }
  const [result, index] = parseBlock(lines, 0, lines[0]?.indent ?? 0);
  if (index < lines.length) {
    const nextIndent = lines[index]?.indent ?? 0;
    const [extra] = parseBlock(lines, index, nextIndent);
    if (typeof result === 'object' && result !== null && !Array.isArray(result)) {
      Object.assign(result, extra as Record<string, YAMLValue>);
    }
  }
  return result;
}

export default { safeLoad };
