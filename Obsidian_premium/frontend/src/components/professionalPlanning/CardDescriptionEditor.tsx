import { useEffect, useRef } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'

interface CardDescriptionEditorProps {
  content: string
  onChange: (content: string) => void
  placeholder?: string
}

export function CardDescriptionEditor({
  content,
  onChange,
  placeholder = 'Adicione uma descrição...',
}: CardDescriptionEditorProps) {
  const contentRef = useRef(content)

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      Placeholder.configure({ placeholder }),
    ],
    content: content?.trim() ? content : '<p></p>',
    editorProps: {
      attributes: {
        class: 'card-description-editor',
      },
    },
  })

  useEffect(() => {
    if (!editor) return
    if (contentRef.current !== content) {
      contentRef.current = content
      const html = content?.trim() ? content : '<p></p>'
      if (editor.getHTML() !== html) {
        editor.commands.setContent(html, { emitUpdate: false })
      }
    }
  }, [editor, content])

  useEffect(() => {
    if (!editor) return
    const handleUpdate = () => {
      const html = editor.getHTML()
      contentRef.current = html
      onChange(html === '<p></p>' ? '' : html)
    }
    editor.on('update', handleUpdate)
    return () => {
      editor.off('update', handleUpdate)
    }
  }, [editor, onChange])

  return (
    <div className="rounded-md border border-zinc-700 bg-zinc-950 overflow-hidden [&_.ProseMirror]:min-h-[120px] [&_.ProseMirror]:max-h-[300px] [&_.ProseMirror]:overflow-y-auto [&_.ProseMirror]:px-3 [&_.ProseMirror]:py-2 [&_.ProseMirror]:text-sm [&_.ProseMirror]:text-zinc-100">
      <EditorContent editor={editor} />
      <style>{`
        .card-description-editor p.is-editor-empty:first-child::before,
        .card-description-editor p.is-empty:first-child::before {
          content: attr(data-placeholder);
          float: left;
          color: #71717a;
          pointer-events: none;
          height: 0;
        }
        .card-description-editor p { margin: 0.25em 0; }
        .card-description-editor h1 { font-size: 1.25rem; font-weight: 600; margin: 0.5em 0; color: #f4f4f5; }
        .card-description-editor h2 { font-size: 1.125rem; font-weight: 600; margin: 0.5em 0; color: #e4e4e7; }
        .card-description-editor h3 { font-size: 1rem; font-weight: 500; margin: 0.5em 0; color: #d4d4d8; }
        .card-description-editor ul, .card-description-editor ol { padding-left: 1.5em; margin: 0.25em 0; }
        .card-description-editor:focus { outline: none; }
      `}</style>
    </div>
  )
}
