import { useMemo } from 'react'

interface MarkdownViewerProps {
  content: string
}

interface ParsedLine {
  type: 'h1' | 'h2' | 'h3' | 'paragraph' | 'empty'
  content: string
}

function parseMarkdown(content: string): ParsedLine[] {
  const lines = content.split('\n')

  return lines.map((line) => {
    const trimmed = line.trim()

    if (trimmed === '') {
      return { type: 'empty', content: '' }
    }

    if (trimmed.startsWith('### ')) {
      return { type: 'h3', content: trimmed.slice(4) }
    }

    if (trimmed.startsWith('## ')) {
      return { type: 'h2', content: trimmed.slice(3) }
    }

    if (trimmed.startsWith('# ')) {
      return { type: 'h1', content: trimmed.slice(2) }
    }

    return { type: 'paragraph', content: line }
  })
}

function renderLinks(text: string): JSX.Element {
  const linkRegex = /\[\[([^\]]+)\]\]/g
  const parts: (string | JSX.Element)[] = []
  let lastIndex = 0
  let match

  while ((match = linkRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index))
    }

    const linkText = match[1]
    parts.push(
      <span
        key={match.index}
        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-accent/10 text-accent text-sm font-medium cursor-pointer hover:bg-accent/20 transition-colors"
      >
        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        {linkText}
      </span>
    )

    lastIndex = match.index + match[0].length
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex))
  }

  return <>{parts}</>
}

export function MarkdownViewer({ content }: MarkdownViewerProps) {
  const parsedLines = useMemo(() => parseMarkdown(content), [content])

  const elements: JSX.Element[] = []
  let currentParagraph: string[] = []

  const flushParagraph = () => {
    if (currentParagraph.length > 0) {
      const paragraphContent = currentParagraph.join('\n')
      elements.push(
        <p key={`p-${elements.length}`} className="text-zinc-300 text-sm leading-relaxed mb-3">
          {renderLinks(paragraphContent)}
        </p>
      )
      currentParagraph = []
    }
  }

  parsedLines.forEach((line, index) => {
    switch (line.type) {
      case 'h1':
        flushParagraph()
        elements.push(
          <h1
            key={`h1-${index}`}
            className="text-2xl font-bold text-zinc-100 mt-6 mb-3 pb-2 border-b border-zinc-800"
          >
            {renderLinks(line.content)}
          </h1>
        )
        break

      case 'h2':
        flushParagraph()
        elements.push(
          <h2
            key={`h2-${index}`}
            className="text-xl font-semibold text-zinc-200 mt-5 mb-2"
          >
            {renderLinks(line.content)}
          </h2>
        )
        break

      case 'h3':
        flushParagraph()
        elements.push(
          <h3
            key={`h3-${index}`}
            className="text-lg font-medium text-zinc-300 mt-4 mb-2"
          >
            {renderLinks(line.content)}
          </h3>
        )
        break

      case 'empty':
        flushParagraph()
        elements.push(<div key={`empty-${index}`} className="h-3" />)
        break

      case 'paragraph':
        currentParagraph.push(line.content)
        break
    }
  })

  flushParagraph()

  if (elements.length === 0) {
    return (
      <p className="text-zinc-500 text-sm italic">Sem conteúdo</p>
    )
  }

  return <div className="markdown-content">{elements}</div>
}
