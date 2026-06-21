import { AudioRecorder } from '../audio/recorder'
import type { SpeechToTextProvider, STTSession } from './SpeechToTextProvider'
import { toFetchUrl } from './devProxy'

export class LocalWhisperProvider implements SpeechToTextProvider {
  readonly label = 'Local Whisper'
  readonly type = 'local-whisper'

  constructor(private readonly baseUrl: string) {}

  async startSession(lang: string): Promise<STTSession> {
    const recorder = new AudioRecorder()
    await recorder.start()

    const baseUrl = this.baseUrl

    return {
      async stop(): Promise<string> {
        const wavBlob = await recorder.stop()
        const formData = new FormData()
        formData.append('file', wavBlob, 'recording.wav')

        const url = toFetchUrl(baseUrl + '/transcribe')
        const res = await fetch(url, { method: 'POST', body: formData })
        const data = await res.json() as { text?: string }
        return data.text ?? ''
      },
    }
  }

  async checkAvailability(): Promise<{ available: boolean; error?: string }> {
    try {
      await fetch(toFetchUrl(this.baseUrl + '/'), {
        mode: 'no-cors',
        signal: AbortSignal.timeout(3000),
      })
      return { available: true }
    } catch (err) {
      return { available: false, error: String(err) }
    }
  }
}
