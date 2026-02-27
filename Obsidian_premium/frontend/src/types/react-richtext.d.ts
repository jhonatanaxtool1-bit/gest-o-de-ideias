declare module 'react-richtext' {
  import type { ComponentType } from 'react'

  export interface EditorValue {
    toString: (format: 'html' | 'markdown') => string
  }

  export interface RichTextEditorComponentProps {
    value: EditorValue
    onChange: (value: EditorValue) => void
    placeholder?: string
  }

  export interface RichTextEditorStatics {
    createEmptyValue: () => EditorValue
    createValueFromString: (markup: string, format: 'html' | 'markdown') => EditorValue
  }

  const RichTextEditor: ComponentType<RichTextEditorComponentProps> & RichTextEditorStatics

  export default RichTextEditor
}
