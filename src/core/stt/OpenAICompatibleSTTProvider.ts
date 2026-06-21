import { AudioRecorder } from '../audio/recorder'
import type { SpeechToTextProvider, STTSession } from './SpeechToTextProvider'
import { toFetchUrl } from './devProxy'

export class OpenAICompatibleSTTProvider implements SpeechToTextProvider {
  readonly label = 'OpenAI Compatible STT'
  readonly type = 'openai-compatible'

  constructor(
    private readonly baseUrl: string,
    private readonly apiKey: string,
  ) {}

  async startSession(lang: string): Promise<STTSession> {
    const recorder = new AudioRecorder()
    await recorder.start()

    const baseUrl = this.baseUrl
    const apiKey = this.apiKey

    return {
      async stop(): Promise<string> {
        const wavBlob = await recorder.stop()
        const formData = new FormData()
        formData.append('file', wavBlob, 'recording.wav')
        formData.append('model', 'whisper-1')
        formData.append('language', lang)

        const url = toFetchUrl(baseUrl + '/audio/transcriptions')
        const headers: HeadersInit = apiKey ? { Authorization: `Bearer ${apiKey}` } : {}
        const res = await fetch(url, { method: 'POST', headers, body: formData })
        const data = await res.json() as { text?: string }
        return data.text ?? ''
      },
    }
  }

  async checkAvailability(): Promise<{ available: boolean; error?: string }> {
    try {
      const url = toFetchUrl(this.baseUrl + '/models')
      const headers: HeadersInit = this.apiKey ? { Authorization: `Bearer ${this.apiKey}` } : {}
      const res = await fetch(url, { headers })
      if (res.status === 200 || res.status === 401) {
        return { available: true }
      }
      return { available: false, error: `Server returned ${res.status}` }
    } catch (err) {
      return { available: false, error: String(err) }
    }
  }
}
