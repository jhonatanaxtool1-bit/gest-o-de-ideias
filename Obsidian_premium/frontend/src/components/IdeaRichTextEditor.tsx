import { useState, useRef, useCallback, useEffect } from 'react'

interface Line {
  id: string
  text: string
  level: number
}

interface AutocompleteItem {
  id: string
  label: string
  type: 'idea'
}

interface RichTextEditorProps {
  content: string
  onChange: (content: string) => void
  placeholder?: string
  documents: Array<{ id: string; title: string }>
  currentDocumentId?: string
}

function generateId(): string {
  return Math.random().toString(36).substring(2, 9)
}

function detectHeadingLevel(text: string): number {
  const trimmed = text.trimStart()
  if (trimmed.startsWith('### ')) return 3
  if (trimmed.startsWith('## ')) return 2
  if (trimmed.startsWith('# ')) return 1
  return 0
}

function removeHeadingSyntax(text: string): string {
  const leadingSpaces = text.length - text.trimStart().length
  const trimmed = text.trimStart()
  if (trimmed.startsWith('### ')) return ' '.repeat(leadingSpaces) + trimmed.slice(4)
  if (trimmed.startsWith('## ')) return ' '.repeat(leadingSpaces) + trimmed.slice(3)
  if (trimmed.startsWith('# ')) return ' '.repeat(leadingSpaces) + trimmed.slice(2)
  return text
}

function addHeadingSyntax(text: string, level: number): string {
  if (level <= 0) return text
  const leadingSpaces = text.length - text.trimStart().length
  const trimmed = text.trimStart()
  if (!trimmed) return ''
  return `${' '.repeat(leadingSpaces)}${'#'.repeat(level)} ${trimmed}`
}

function getHeadingClasses(level: number): string {
  switch (level) {
    case 1:
      return 'text-3xl font-bold text-zinc-100'
    case 2:
      return 'text-2xl font-semibold text-zinc-200'
    case 3:
      return 'text-xl font-medium text-zinc-300'
    default:
      return 'text-base text-zinc-300'
  }
}

function getHeadingPlaceholder(level: number): string {
  switch (level) {
    case 1:
      return 'Título 1'
    case 2:
      return 'Título 2'
    case 3:
      return 'Título 3'
    default:
      return 'Digite algo...'
  }
}

export function RichTextEditor({
  content,
  onChange,
  placeholder = 'Comece a escrever...',
  documents,
  currentDocumentId,
}: RichTextEditorProps) {
  const parseLines = (text: string): Line[] => {
    if (!text) return [{ id: generateId(), text: '', level: 0 }]
    return text.split('\n').map((line) => {
      const level = detectHeadingLevel(line)
      return {
        id: generateId(),
        text: removeHeadingSyntax(line),
        level,
      }
    })
  }

  const [lines, setLines] = useState<Line[]>(() => parseLines(content))
  const [activeLineId, setActiveLineId] = useState<string | null>(null)
  const [showAutocomplete, setShowAutocomplete] = useState(false)
  const [autocompleteItems, setAutocompleteItems] = useState<AutocompleteItem[]>([])
  const [autocompleteIndex, setAutocompleteIndex] = useState(0)
  const lineRefs = useRef<Map<string, HTMLDivElement>>(new Map())
  const editorRef = useRef<HTMLDivElement>(null)
  const textRef = useRef<Map<string, string>>(new Map())
  const lastNotifiedContentRef = useRef(content)

  useEffect(() => {
    if (content === lastNotifiedContentRef.current) return

    const newLines = parseLines(content)
    setLines(newLines)
    lastNotifiedContentRef.current = content

    newLines.forEach((line) => {
      textRef.current.set(line.id, line.text)
    })

    setTimeout(() => {
      newLines.forEach((line) => {
        const el = lineRefs.current.get(line.id)
        if (el && el.innerText !== line.text) {
          el.innerText = line.text
        }
      })
    }, 0)
  }, [content])

  useEffect(() => {
    lines.forEach((line) => {
      if (!textRef.current.has(line.id)) {
        textRef.current.set(line.id, line.text)
      }
    })
  }, [lines])

  const notifyChange = useCallback((sourceLines?: Line[]) => {
    const linesToSerialize = sourceLines ?? lines
    const serializedLines = linesToSerialize.map((line) => {
      const text = textRef.current.get(line.id) ?? line.text
      return addHeadingSyntax(text, line.level)
    })
    const nextContent = serializedLines.join('\n')
    lastNotifiedContentRef.current = nextContent
    onChange(nextContent)
  }, [lines, onChange])

  const updateLineText = useCallback(
    (lineId: string, newText: string, forcedLevel?: number) => {
      textRef.current.set(lineId, newText)
      const oldLine = lines.find((l) => l.id === lineId)
      if (!oldLine) return

      const detectedLevel = detectHeadingLevel(newText)
      const nextText = removeHeadingSyntax(newText)
      const newLevel = forcedLevel ?? (detectedLevel > 0 ? detectedLevel : oldLine.level)

      textRef.current.set(lineId, nextText)
      setLines((prev) =>
        prev.map((l) => (l.id === lineId ? { ...l, text: nextText, level: newLevel } : l))
      )
      notifyChange()
    },
    [lines, notifyChange]
  )

  const insertIdeaLink = useCallback(
    (lineId: string, cursorPosition: number, item: AutocompleteItem) => {
      const lineEl = lineRefs.current.get(lineId)
      if (!lineEl) return

      const text = lineEl.innerText
      const textBeforeCursor = text.slice(0, cursorPosition)
      const textAfterCursor = text.slice(cursorPosition)
      const lastAtIndex = textBeforeCursor.lastIndexOf('@')
      const insertion = `[[${item.label}]] `
      const newText = textBeforeCursor.slice(0, lastAtIndex) + insertion + textAfterCursor

      lineEl.innerText = newText
      textRef.current.set(lineId, newText)
      setLines((prev) => prev.map((l) => (l.id === lineId ? { ...l, text: newText } : l)))
      setShowAutocomplete(false)
      notifyChange()

      setTimeout(() => {
        const range = document.createRange()
        const textNode = lineEl.firstChild
        if (textNode) {
          const newCursorPos = lastAtIndex + insertion.length
          const textLength = textNode.textContent?.length ?? 0
          if (newCursorPos <= textLength) {
            range.setStart(textNode, newCursorPos)
            range.collapse(true)
            const sel = window.getSelection()
            sel?.removeAllRanges()
            sel?.addRange(range)
          }
        }
      }, 0)
    },
    [notifyChange]
  )

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent, lineId: string) => {
      const lineEl = lineRefs.current.get(lineId)
      if (!lineEl) return

      const getCursorPosition = () => {
        const selection = window.getSelection()
        if (!selection || selection.rangeCount === 0) return lineEl.innerText.length
        const range = selection.getRangeAt(0)
        const preRange = range.cloneRange()
        preRange.selectNodeContents(lineEl)
        preRange.setEnd(range.startContainer, range.startOffset)
        return preRange.toString().length
      }

      const cursorPosition = getCursorPosition()

      if (e.key === 'Backspace') {
        const lineIndex = lines.findIndex((line) => line.id === lineId)
        const currentLine = lineIndex >= 0 ? lines[lineIndex] : null

        if (cursorPosition === 0) {
          if (currentLine && currentLine.level > 0) {
            e.preventDefault()
            const nextLines = lines.map((line) => (line.id === lineId ? { ...line, level: 0 } : line))
            setLines(nextLines)
            notifyChange(nextLines)
            return
          }
          if (lineIndex > 0) {
            e.preventDefault()
            const prevLine = lines[lineIndex - 1]
            const prevLineEl = lineRefs.current.get(prevLine.id)
            const prevText = textRef.current.get(prevLine.id) ?? prevLine.text
            const currentText = lineEl.innerText
            const mergedText = prevText + currentText

            textRef.current.set(prevLine.id, mergedText)
            const nextLines = [...lines.slice(0, lineIndex - 1), { ...prevLine, text: mergedText }, ...lines.slice(lineIndex + 1)]
            setLines(nextLines)
            setActiveLineId(prevLine.id)
            notifyChange(nextLines)

            requestAnimationFrame(() => {
              if (!prevLineEl) return
              prevLineEl.focus()
              prevLineEl.innerText = mergedText
              const range = document.createRange()
              const textNode = prevLineEl.firstChild
              if (textNode) {
                const offset = Math.min(prevText.length, textNode.textContent?.length ?? 0)
                range.setStart(textNode, offset)
                range.collapse(true)
                const sel = window.getSelection()
                sel?.removeAllRanges()
                sel?.addRange(range)
              }
            })
            return
          }
        }
      }

      if (e.key === 'Enter' && !showAutocomplete) {
        e.preventDefault()

        const lineIndex = lines.findIndex((line) => line.id === lineId)
        if (lineIndex === -1) return

        const currentLine = lines[lineIndex]
        const currentText = lineEl.innerText
        const textBeforeCursor = currentText.slice(0, cursorPosition)
        const textAfterCursor = currentText.slice(cursorPosition)
        const nextLineId = generateId()

        const nextLines = [
          ...lines.slice(0, lineIndex),
          { ...currentLine, text: textBeforeCursor },
          { id: nextLineId, text: textAfterCursor, level: 0 },
          ...lines.slice(lineIndex + 1),
        ]

        textRef.current.set(lineId, textBeforeCursor)
        textRef.current.set(nextLineId, textAfterCursor)
        setLines(nextLines)
        setActiveLineId(nextLineId)
        notifyChange(nextLines)

        requestAnimationFrame(() => {
          const nextEl = lineRefs.current.get(nextLineId)
          if (!nextEl) return
          nextEl.focus()
          const range = document.createRange()
          range.selectNodeContents(nextEl)
          range.collapse(true)
          const sel = window.getSelection()
          sel?.removeAllRanges()
          sel?.addRange(range)
        })
        return
      }

      if (!showAutocomplete || autocompleteItems.length === 0) return

      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setAutocompleteIndex((prev) => (prev + 1) % autocompleteItems.length)
        return
      }

      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setAutocompleteIndex((prev) => (prev - 1 + autocompleteItems.length) % autocompleteItems.length)
        return
      }

      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault()
        const item = autocompleteItems[autocompleteIndex]
        if (item) {
          insertIdeaLink(lineId, cursorPosition, item)
        }
        return
      }

      if (e.key === 'Escape') {
        e.preventDefault()
        setShowAutocomplete(false)
      }
    },
    [lines, showAutocomplete, autocompleteItems, autocompleteIndex, insertIdeaLink, notifyChange]
  )

  const handleInput = useCallback(
    (lineId: string) => {
      const lineEl = lineRefs.current.get(lineId)
      if (!lineEl) return

      const text = lineEl.innerText
      const sel = window.getSelection()
      const cursorPosition = sel?.getRangeAt(0).startOffset ?? 0
      const trimmedText = text.trimStart()
      const leadingSpaces = text.length - trimmedText.length

      if (cursorPosition === leadingSpaces + 2 && trimmedText.startsWith('# ')) {
        const newText = ' '.repeat(leadingSpaces) + trimmedText.slice(2)
        lineEl.innerText = newText
        updateLineText(lineId, newText, 1)
        return
      }

      if (cursorPosition === leadingSpaces + 3 && trimmedText.startsWith('## ')) {
        const newText = ' '.repeat(leadingSpaces) + trimmedText.slice(3)
        lineEl.innerText = newText
        updateLineText(lineId, newText, 2)
        return
      }

      if (cursorPosition === leadingSpaces + 4 && trimmedText.startsWith('### ')) {
        const newText = ' '.repeat(leadingSpaces) + trimmedText.slice(4)
        lineEl.innerText = newText
        updateLineText(lineId, newText, 3)
        return
      }

      updateLineText(lineId, text)

      const textBeforeCursor = text.slice(0, cursorPosition)
      const lastAtIndex = textBeforeCursor.lastIndexOf('@')
      const lastSpaceIndex = textBeforeCursor.lastIndexOf(' ')
      const lastNewlineIndex = textBeforeCursor.lastIndexOf('\n')
      const lastBreakIndex = Math.max(lastSpaceIndex, lastNewlineIndex)

      if (lastAtIndex > lastBreakIndex) {
        const atWord = textBeforeCursor.slice(lastAtIndex + 1)
        if (!atWord.includes(' ')) {
          const ideas: AutocompleteItem[] = documents
            .filter(
              (d) =>
                d.id !== currentDocumentId && d.title.toLowerCase().includes(atWord.toLowerCase())
            )
            .slice(0, 5)
            .map((d) => ({ id: d.id, label: d.title, type: 'idea' }))

          if (ideas.length > 0) {
            setAutocompleteItems(ideas)
            setAutocompleteIndex(0)
            setShowAutocomplete(true)
            return
          }
        }
      }

      setShowAutocomplete(false)
    },
    [documents, currentDocumentId, updateLineText]
  )

  const handleLineBlur = useCallback(() => {
    setTimeout(() => {
      const editor = editorRef.current
      const selection = window.getSelection()
      const anchorNode = selection?.anchorNode ?? null
      const focusNode = selection?.focusNode ?? null

      const selectionInsideEditor =
        !!editor &&
        ((!!anchorNode && editor.contains(anchorNode)) || (!!focusNode && editor.contains(focusNode)))

      if (selectionInsideEditor) return

      setActiveLineId(null)
      setShowAutocomplete(false)
    }, 0)
  }, [])

  return (
    <div ref={editorRef} className="relative">
      {lines.map((line, index) => {
        const isActive = activeLineId === line.id
        const isEmpty = !textRef.current.get(line.id) && !line.text

        return (
          <div key={line.id} className="relative">
            <div
              ref={(el) => {
                if (el) {
                  lineRefs.current.set(line.id, el)
                  const currentText = textRef.current.get(line.id) ?? line.text
                  if (el.innerText === '' && currentText) {
                    el.innerText = currentText
                  }
                }
              }}
              contentEditable
              suppressContentEditableWarning
              onInput={() => handleInput(line.id)}
              onKeyDown={(e) => handleKeyDown(e, line.id)}
              onFocus={() => setActiveLineId(line.id)}
              onBlur={handleLineBlur}
              className={`
                outline-none min-h-[1.5em] py-1 leading-relaxed
                ${getHeadingClasses(line.level)}
                ${isEmpty && !isActive ? 'text-zinc-600' : ''}
              `}
              style={{ whiteSpace: 'pre-wrap' }}
            />
            {isEmpty && !isActive && (
              <div
                className={`
                  absolute top-1 left-0 pointer-events-none select-none
                  ${getHeadingClasses(line.level).replace(/text-zinc-\d+/, 'text-zinc-600')}
                `}
              >
                {index === 0 ? placeholder : getHeadingPlaceholder(line.level)}
              </div>
            )}
          </div>
        )
      })}

      {showAutocomplete && activeLineId && (
        <div
          className="absolute z-10 mt-2 bg-surface-800 border border-zinc-700 rounded-xl shadow-2xl min-w-[220px] py-1"
          style={{
            top:
              (lineRefs.current.get(activeLineId)?.getBoundingClientRect().bottom ?? 0) -
              (editorRef.current?.getBoundingClientRect().top ?? 0),
            left: 0,
          }}
        >
          {autocompleteItems.map((item, index) => (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                if (activeLineId) {
                  const lineEl = lineRefs.current.get(activeLineId)
                  if (lineEl) {
                    const sel = window.getSelection()
                    const cursorPosition = sel?.getRangeAt(0).startOffset ?? 0
                    insertIdeaLink(activeLineId, cursorPosition, item)
                  }
                }
              }}
              className={`
                w-full px-4 py-2.5 text-left text-sm
                flex items-center gap-3
                transition-colors
                ${index === autocompleteIndex ? 'bg-accent/20 text-accent' : 'text-zinc-300 hover:bg-zinc-700/50'}
              `}
            >
              <svg className="w-4 h-4 text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
              <span className="truncate">{item.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
