import { forwardRef, useRef, useEffect, useCallback, useState } from 'react'
import type { AIOperationResult } from '../../core/types'
import { InlineDiff } from './InlineDiff'

const TRANSCRIBE_URL = import.meta.env.DEV
  ? '/transcribe'
  : 'http://localhost:8000/transcribe'

function encodeWav(samples: Float32Array, sampleRate: number): Blob {
  const len = samples.length
  const buffer = new ArrayBuffer(44 + len * 2)
  const view = new DataView(buffer)

  const writeStr = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i))
  }

  writeStr(0, 'RIFF')
  view.setUint32(4, 36 + len * 2, true)
  writeStr(8, 'WAVE')
  writeStr(12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, 1, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * 2, true)
  view.setUint16(32, 2, true)
  view.setUint16(34, 16, true)
  writeStr(36, 'data')
  view.setUint32(40, len * 2, true)

  for (let i = 0; i < len; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]))
    view.setInt16(44 + i * 2, s < 0 ? s * 32768 : s * 32767, true)
  }

  return new Blob([buffer], { type: 'audio/wav' })
}

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
    const [isRecording, setIsRecording] = useState(false)
    const [isTranscribing, setIsTranscribing] = useState(false)

    const audioCtxRef = useRef<AudioContext | null>(null)
    const streamRef = useRef<MediaStream | null>(null)
    const scriptNodeRef = useRef<ScriptProcessorNode | null>(null)
    const pcmFramesRef = useRef<Float32Array[]>([])

    const stopRecordingAndTranscribe = useCallback(async () => {
      if (!audioCtxRef.current || !scriptNodeRef.current || !streamRef.current) return

      scriptNodeRef.current.disconnect()
      const sampleRate = audioCtxRef.current.sampleRate
      await audioCtxRef.current.close()
      streamRef.current.getTracks().forEach(t => t.stop())

      const frames = pcmFramesRef.current
      const totalLen = frames.reduce((s, f) => s + f.length, 0)
      const allSamples = new Float32Array(totalLen)
      let offset = 0
      for (const frame of frames) {
        allSamples.set(frame, offset)
        offset += frame.length
      }

      audioCtxRef.current = null
      scriptNodeRef.current = null
      streamRef.current = null
      pcmFramesRef.current = []
      setIsRecording(false)
      setIsTranscribing(true)

      try {
        const wavBlob = encodeWav(allSamples, sampleRate)
        const formData = new FormData()
        formData.append('file', wavBlob, 'recording.wav')
        const res = await fetch(TRANSCRIBE_URL, { method: 'POST', body: formData })
        const data = await res.json() as { text?: string }
        if (data.text) {
          setInstruction(prev => prev ? prev + ' ' + data.text : data.text!)
        }
      } catch (err) {
        console.error('Transcription failed:', err)
      } finally {
        setIsTranscribing(false)
      }
    }, [])

    const handleMicClick = useCallback(async () => {
      if (isTranscribing) return

      if (isRecording) {
        await stopRecordingAndTranscribe()
        return
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
        const audioCtx = new AudioContext()
        const sourceNode = audioCtx.createMediaStreamSource(stream)
        const scriptNode = audioCtx.createScriptProcessor(4096, 1, 1)

        pcmFramesRef.current = []
        scriptNode.onaudioprocess = (e) => {
          const channel = e.inputBuffer.getChannelData(0)
          pcmFramesRef.current.push(new Float32Array(channel))
        }
        sourceNode.connect(scriptNode)
        scriptNode.connect(audioCtx.destination)

        audioCtxRef.current = audioCtx
        streamRef.current = stream
        scriptNodeRef.current = scriptNode
        setIsRecording(true)
      } catch {
        // microphone access denied — ignore
      }
    }, [isRecording, isTranscribing, stopRecordingAndTranscribe])

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
                onClick={handleMicClick}
                onMouseDown={e => e.stopPropagation()}
                disabled={loading || isTranscribing}
                className={`selection-popup-mic${isRecording ? ' recording' : ''}${isTranscribing ? ' transcribing' : ''}`}
                title={isRecording ? 'Stop recording' : 'Record instruction'}
              >
                {isTranscribing ? '⏳' : isRecording ? '⏹' : '🎤'}
              </button>
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
