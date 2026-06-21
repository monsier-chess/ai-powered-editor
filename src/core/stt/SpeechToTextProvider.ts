export interface STTSession {
  stop(): Promise<string>
}

export interface SpeechToTextProvider {
  readonly label: string
  readonly type: string
  startSession(lang: string): Promise<STTSession>
  checkAvailability(): Promise<{ available: boolean; error?: string }>
}
