import { useState, useRef, useCallback, useEffect } from 'react'
import type { SpeechToTextProvider, STTSession } from '../core/stt/SpeechToTextProvider'

export type STTStatus = 'idle' | 'recording' | 'transcribing' | 'error'

export function useSpeechToText(
  provider: SpeechToTextProvider,
  lang: string,
): {
  status: STTStatus
  error: string | null
  start(): Promise<void>
  stop(): Promise<string | null>
  cancel(): void
} {
  const [status, setStatus] = useState<STTStatus>('idle')
  const [error, setError] = useState<string | null>(null)
  const sessionRef = useRef<STTSession | null>(null)

  const start = useCallback(async () => {
    setError(null)
    try {
      const session = await provider.startSession(lang)
      sessionRef.current = session
      setStatus('recording')
    } catch (err) {
      setError(String(err))
      setStatus('error')
    }
  }, [provider, lang])

  const stop = useCallback(async (): Promise<string | null> => {
    const session = sessionRef.current
    if (!session) return null
    sessionRef.current = null
    setStatus('transcribing')
    try {
      const text = await session.stop()
      setStatus('idle')
      return text || null
    } catch (err) {
      setError(String(err))
      setStatus('error')
      return null
    }
  }, [])

  const cancel = useCallback(() => {
    const session = sessionRef.current
    sessionRef.current = null
    if (session) {
      session.stop().catch(() => {})
    }
    setStatus('idle')
  }, [])

  useEffect(() => {
    return () => {
      const session = sessionRef.current
      sessionRef.current = null
      if (session) {
        session.stop().catch(() => {})
      }
    }
  }, [])

  return { status, error, start, stop, cancel }
}
