import { forwardRef, useRef, useEffect, useCallback, useState } from 'react'
import type { AIOperationResult } from '../../core/types'
import { InlineDiff } from './InlineDiff'

interface EditorProps {
  content: string
  onChange: (content: string) => void
  onSelectionChange: (start: number, end: number) => void
  selectionStart: number
  selectionEnd: number
  activeOperation: AIOperationResult | null
  onAcceptHunk: (id: string) => void
  onRejectHunk: (id: string) => void
  onAcceptAll: () => void
  onRejectAll: () => void
  onRewrite: (instruction: string) => void
  loading: boolean
}

function getCaretCoords(textarea: HTMLTextAreaElement, pos: number): { top: number; left: number } {
  const mirror = document.createElement('div')
  const cs = getComputedStyle(textarea)

  ;[
    'fontFamily', 'fontSize', 'fontWeight', 'fontStyle', 'lineHeight',
    'letterSpacing', 'wordSpacing', 'textTransform',
    'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft',
    'borderTopWidth', 'borderRightWidth', 'borderBottomWidth', 'borderLeftWidth',
    'boxSizing', 'tabSize',
  ].forEach(p => {
    (mirror.style as unknown as Record<string, string>)[p] = (cs as unknown as Record<string, string>)[p]
  })

  const rect = textarea.getBoundingClientRect()
  mirror.style.position = 'fixed'
  mirror.style.top = `${rect.top}px`
  mirror.style.left = `${rect.left}px`
  mirror.style.width = `${rect.width}px`
  mirror.style.visibility = 'hidden'
  mirror.style.overflow = 'hidden'
  mirror.style.whiteSpace = 'pre-wrap'
  mirror.style.wordBreak = 'break-word'
  mirror.style.overflowWrap = 'break-word'
  mirror.style.pointerEvents = 'none'

  mirror.textContent = textarea.value.substring(0, pos)
  const span = document.createElement('span')
  span.textContent = '​'
  mirror.appendChild(span)

  document.body.appendChild(mirror)

  // Simulate textarea scroll
  mirror.scrollTop = textarea.scrollTop

  const spanBottom = span.offsetTop + span.offsetHeight
  const spanLeft = span.offsetLeft

  document.body.removeChild(mirror)

  const containerRect = textarea.parentElement!.getBoundingClientRect()

  return {
    top: (rect.top - containerRect.top) + spanBottom - textarea.scrollTop,
    left: (rect.left - containerRect.left) + spanLeft,
  }
}

export const Editor = forwardRef<HTMLTextAreaElement, EditorProps>(
  function Editor({
    content,
    onChange,
    onSelectionChange,
    selectionStart,
    selectionEnd,
    activeOperation,
    onAcceptHunk,
    onRejectHunk,
    onAcceptAll,
    onRejectAll,
    onRewrite,
    loading,
  }, ref) {
    const localRef = useRef<HTMLTextAreaElement>(null)
    const editorRef = (ref || localRef) as React.RefObject<HTMLTextAreaElement>
    const containerRef = useRef<HTMLDivElement>(null)
    const inputRef = useRef<HTMLInputElement>(null)

    const [instruction, setInstruction] = useState('')
    const [popupPos, setPopupPos] = useState<{ top: number; left: number } | null>(null)

    const hasSelection = selectionStart !== selectionEnd

    const handleSelect = useCallback(() => {
      const el = editorRef.current
      if (!el) return
      onSelectionChange(el.selectionStart, el.selectionEnd)
    }, [editorRef, onSelectionChange])

    useEffect(() => {
      const el = editorRef.current
      if (!el) return
      el.addEventListener('select', handleSelect)
      el.addEventListener('mouseup', handleSelect)
      el.addEventListener('keyup', handleSelect)
      return () => {
        el.removeEventListener('select', handleSelect)
        el.removeEventListener('mouseup', handleSelect)
        el.removeEventListener('keyup', handleSelect)
      }
    }, [editorRef, handleSelect])

    // Recalculate popup position when selection changes
    useEffect(() => {
      if (!hasSelection || activeOperation || !editorRef.current) {
        setPopupPos(null)
        return
      }
      const coords = getCaretCoords(editorRef.current, selectionEnd)
      const container = containerRef.current
      if (container) {
        const maxLeft = container.clientWidth - 340
        coords.left = Math.max(8, Math.min(coords.left, maxLeft))
      }
      setPopupPos(coords)
    }, [selectionStart, selectionEnd, hasSelection, activeOperation, editorRef])

    const handleRewrite = useCallback(() => {
      if (!instruction.trim() || loading) return
      onRewrite(instruction)
      setInstruction('')
    }, [instruction, loading, onRewrite])

    const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        handleRewrite()
      }
    }, [handleRewrite])

    const selectedText = content.slice(selectionStart, selectionEnd)
    const preview = selectedText.length > 80
      ? selectedText.slice(0, 80).replace(/\n/g, ' ') + '…'
      : selectedText.replace(/\n/g, ' ')

    return (
      <div ref={containerRef} className="editor-container">
        {activeOperation ? (
          <InlineDiff
            operation={activeOperation}
            fullContent={content}
            onAcceptHunk={onAcceptHunk}
            onRejectHunk={onRejectHunk}
            onAcceptAll={onAcceptAll}
            onRejectAll={onRejectAll}
          />
        ) : (
          <textarea
            ref={editorRef}
            className="editor-textarea"
            value={content}
            onChange={e => onChange(e.target.value)}
            onSelect={handleSelect}
            onMouseUp={handleSelect}
            onKeyUp={handleSelect}
            placeholder="Type or paste your text here..."
            spellCheck={false}
          />
        )}

        {hasSelection && !activeOperation && popupPos && (
          <div
            className="selection-popup"
            style={{ top: popupPos.top + 6, left: popupPos.left }}
            onMouseDown={e => e.preventDefault()}
          >
            {preview && (
              <div className="selection-popup-preview">&ldquo;{preview}&rdquo;</div>
            )}
            <div className="selection-popup-row">
              <input
                ref={inputRef}
                type="text"
                value={instruction}
                onChange={e => setInstruction(e.target.value)}
                onKeyDown={handleKeyDown}
                onMouseDown={e => e.stopPropagation()}
                placeholder="Rewrite instruction…"
                disabled={loading}
                className="selection-popup-input"
              />
              <button
                onClick={handleRewrite}
                onMouseDown={e => e.stopPropagation()}
                disabled={!instruction.trim() || loading}
                className="selection-popup-btn"
              >
                Rewrite
              </button>
            </div>
          </div>
        )}
      </div>
    )
  }
)
