import { useEffect, useRef } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import TaskList from '@tiptap/extension-task-list'
import TaskItem from '@tiptap/extension-task-item'

interface CardDescriptionEditorProps {
  content: string
  onChange: (content: string) => void
  placeholder?: string
}

const MenuBar = ({ editor }: { editor: any }) => {
  if (!editor) {
    return null
  }

  const getButtonClass = (isActive: boolean) =>
    `px-2 py-1 text-xs rounded transition-colors ${
      isActive
        ? 'bg-zinc-700 text-zinc-100'
        : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200'
    }`

  return (
    <div className="flex flex-wrap gap-1 border-b border-zinc-800 p-2 bg-zinc-900">
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleBold().run()}
        disabled={!editor.can().chain().focus().toggleBold().run()}
        className={getButtonClass(editor.isActive('bold'))}
        title="Bold"
      >
        <strong className="font-bold">B</strong>
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleItalic().run()}
        disabled={!editor.can().chain().focus().toggleItalic().run()}
        className={getButtonClass(editor.isActive('italic'))}
        title="Italic"
      >
        <em className="italic font-serif">I</em>
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleStrike().run()}
        disabled={!editor.can().chain().focus().toggleStrike().run()}
        className={getButtonClass(editor.isActive('strike'))}
        title="Strikethrough"
      >
        <span className="line-through">S</span>
      </button>
      
      <div className="w-px h-5 bg-zinc-700 mx-1 self-center" />

      <button
        type="button"
        onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
        className={getButtonClass(editor.isActive('heading', { level: 1 }))}
        title="Heading 1"
      >
        H1
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        className={getButtonClass(editor.isActive('heading', { level: 2 }))}
        title="Heading 2"
      >
        H2
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        className={getButtonClass(editor.isActive('heading', { level: 3 }))}
        title="Heading 3"
      >
        H3
      </button>

      <div className="w-px h-5 bg-zinc-700 mx-1 self-center" />

      <button
        type="button"
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        className={getButtonClass(editor.isActive('bulletList'))}
        title="Bullet List"
      >
        • List
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        className={getButtonClass(editor.isActive('orderedList'))}
        title="Ordered List"
      >
        1. List
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleTaskList().run()}
        className={getButtonClass(editor.isActive('taskList'))}
        title="Checklist"
      >
        ☑ Checklist
      </button>

      <div className="w-px h-5 bg-zinc-700 mx-1 self-center" />

      <button
        type="button"
        onClick={() => editor.chain().focus().toggleCodeBlock().run()}
        className={getButtonClass(editor.isActive('codeBlock'))}
        title="Code Block"
      >
        {'</>'}
      </button>

    </div>
  )
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
      TaskList.configure({
        HTMLAttributes: {
          class: 'notion-task-list',
        },
      }),
      TaskItem.configure({
        nested: true,
        HTMLAttributes: {
          class: 'notion-task-item',
        },
      }),
    ],
    content: content?.trim() ? content : '<p></p>',
    editorProps: {
      attributes: {
        class: 'card-description-editor prose prose-invert max-w-none',
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
    <div className="rounded-md border border-zinc-700 bg-zinc-950 overflow-hidden flex flex-col">
      <MenuBar editor={editor} />
      <EditorContent editor={editor} />
      <style>{`
        .card-description-editor {
          min-height: 320px;
          max-height: 60vh;
          overflow-y: auto;
          padding: 12px;
          font-size: 0.875rem;
          color: #f4f4f5;
        }
        
        .card-description-editor p.is-editor-empty:first-child::before,
        .card-description-editor p.is-empty:first-child::before {
          content: attr(data-placeholder);
          float: left;
          color: #71717a;
          pointer-events: none;
          height: 0;
        }

        .card-description-editor p { margin: 0.5em 0; }
        
        .card-description-editor h1 { font-size: 1.5rem; font-weight: 700; margin: 1em 0 0.5em; color: #ffffff; }
        .card-description-editor h2 { font-size: 1.25rem; font-weight: 600; margin: 1em 0 0.5em; color: #f4f4f5; }
        .card-description-editor h3 { font-size: 1.125rem; font-weight: 600; margin: 1em 0 0.5em; color: #e4e4e7; }
        
        .card-description-editor ul, .card-description-editor ol { padding-left: 1.5em; margin: 0.5em 0; }
        .card-description-editor ul { list-style-type: disc; }
        .card-description-editor ol { list-style-type: decimal; }
        
        .card-description-editor pre {
          background: #18181b; /* zinc-900 */
          color: #e4e4e7;
          padding: 0.75rem 1rem;
          border-radius: 0.5rem;
          margin: 1em 0;
          overflow-x: auto;
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
          border: 1px solid #27272a; /* zinc-800 */
        }
        
        .card-description-editor code {
          background: #27272a;
          padding: 0.2em 0.4em;
          border-radius: 0.25em;
          font-size: 0.85em;
        }
        
        .card-description-editor pre code {
          background: transparent;
          padding: 0;
          font-size: 0.875rem;
        }

        /* Task List Styles */
        ul[data-type="taskList"] {
          list-style: none;
          padding: 0;
        }

        ul[data-type="taskList"] li {
          display: flex;
          align-items: flex-start;
          margin-bottom: 0.5rem;
        }

        ul[data-type="taskList"] li > label {
          flex: 0 0 auto;
          margin-right: 0.5rem;
          user-select: none;
          margin-top: 0.2rem;
        }

        ul[data-type="taskList"] li > label input[type="checkbox"] {
          cursor: pointer;
          accent-color: #6366f1; /* accent color */
          width: 1rem;
          height: 1rem;
          border-radius: 0.25rem;
          border: 1px solid #52525b; /* zinc-600 */
        }

        ul[data-type="taskList"] li > div {
          flex: 1 1 auto;
        }

        ul[data-type="taskList"] li[data-checked="true"] > div {
          color: #a1a1aa; /* zinc-400 */
          text-decoration: line-through;
        }

        .card-description-editor:focus { outline: none; }
      `}</style>
    </div>
  )
}
