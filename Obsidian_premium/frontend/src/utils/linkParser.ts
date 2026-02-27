const WIKI_LINK_REGEX = /\[\[([^\]]+)\]\]/g

export function extractWikiLinks(content: string): string[] {
  const titles: string[] = []
  let match: RegExpExecArray | null
  WIKI_LINK_REGEX.lastIndex = 0
  while ((match = WIKI_LINK_REGEX.exec(content)) !== null) {
    const title = match[1].trim()
    if (title && !titles.includes(title)) titles.push(title)
  }
  return titles
}

export function parseContentWithLinks(
  content: string
): Array<{ type: 'text' | 'link'; value: string }> {
  const parts: Array<{ type: 'text' | 'link'; value: string }> = []
  let lastIndex = 0
  WIKI_LINK_REGEX.lastIndex = 0
  let match: RegExpExecArray | null
  while ((match = WIKI_LINK_REGEX.exec(content)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ type: 'text', value: content.slice(lastIndex, match.index) })
    }
    parts.push({ type: 'link', value: match[1].trim() })
    lastIndex = match.index + match[0].length
  }
  if (lastIndex < content.length) {
    parts.push({ type: 'text', value: content.slice(lastIndex) })
  }
  return parts.length ? parts : [{ type: 'text', value: content }]
}
