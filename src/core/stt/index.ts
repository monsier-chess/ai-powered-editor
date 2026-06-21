import type { STTSettings } from '../types'
import type { SpeechToTextProvider } from './SpeechToTextProvider'
import { WebSpeechProvider } from './WebSpeechProvider'
import { LocalWhisperProvider } from './LocalWhisperProvider'
import { OpenAICompatibleSTTProvider } from './OpenAICompatibleSTTProvider'

export { WebSpeechProvider } from './WebSpeechProvider'
export { LocalWhisperProvider } from './LocalWhisperProvider'
export { OpenAICompatibleSTTProvider } from './OpenAICompatibleSTTProvider'
export type { SpeechToTextProvider, STTSession } from './SpeechToTextProvider'

export function createSTTProvider(settings: STTSettings): SpeechToTextProvider {
  switch (settings.provider) {
    case 'web-speech':
      return new WebSpeechProvider()
    case 'local-whisper':
      return new LocalWhisperProvider(settings.localWhisperUrl)
    case 'openai-compatible':
      return new OpenAICompatibleSTTProvider(settings.openAIBaseUrl, settings.openAIApiKey)
    default:
      return new WebSpeechProvider()
  }
}
