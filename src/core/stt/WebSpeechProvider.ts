import type { SpeechToTextProvider, STTSession } from './SpeechToTextProvider'

// ISO 639-1 → BCP 47 mapping
const LANG_MAP: Record<string, string> = {
  ru: 'ru-RU',
  en: 'en-US',
  de: 'de-DE',
  fr: 'fr-FR',
  es: 'es-ES',
  it: 'it-IT',
  pt: 'pt-PT',
  nl: 'nl-NL',
  pl: 'pl-PL',
  ja: 'ja-JP',
  zh: 'zh-CN',
  ko: 'ko-KR',
  ar: 'ar-SA',
  tr: 'tr-TR',
  uk: 'uk-UA',
}

function toBcp47(lang: string): string {
  return LANG_MAP[lang] ?? lang
}

interface SpeechRecognitionLike extends EventTarget {
  lang: string
  interimResults: boolean
  continuous: boolean
  onstart: (() => void) | null
  onend: (() => void) | null
  onerror: ((e: { error: string }) => void) | null
  onresult: ((e: {
    resultIndex: number
    results: { isFinal: boolean; [index: number]: { transcript: string } }[]
  }) => void) | null
  start(): void
  stop(): void
}

function getSpeechRecognitionCtor(): (new () => SpeechRecognitionLike) | null {
  const w = window as unknown as Record<string, unknown>
  return (w['SpeechRecognition'] ?? w['webkitSpeechRecognition'] ?? null) as (new () => SpeechRecognitionLike) | null
}

export class WebSpeechProvider implements SpeechToTextProvider {
  readonly label = 'Web Speech (built-in)'
  readonly type = 'web-speech'

  async startSession(lang: string): Promise<STTSession> {
    const Ctor = getSpeechRecognitionCtor()
    if (!Ctor) {
      throw new Error('SpeechRecognition API is not available in this browser')
    }

    const recognition = new Ctor()
    recognition.lang = toBcp47(lang)
    recognition.interimResults = false
    recognition.continuous = true

    const transcripts: string[] = []

    await new Promise<void>((resolve, reject) => {
      recognition.onstart = () => resolve()
      recognition.onerror = (e) => reject(new Error(e.error))
      recognition.onresult = (e) => {
        for (let i = e.resultIndex; i < e.results.length; i++) {
          if (e.results[i].isFinal) {
            transcripts.push(e.results[i][0].transcript)
          }
        }
      }
      recognition.start()
    })

    return {
      stop(): Promise<string> {
        return new Promise<string>((resolve) => {
          recognition.onend = () => {
            resolve(transcripts.join(' ').trim())
          }
          recognition.stop()
        })
      },
    }
  }

  async checkAvailability(): Promise<{ available: boolean; error?: string }> {
    const ctor = getSpeechRecognitionCtor()
    if (ctor) {
      return { available: true }
    }
    return { available: false, error: 'SpeechRecognition API not found in this browser' }
  }
}
