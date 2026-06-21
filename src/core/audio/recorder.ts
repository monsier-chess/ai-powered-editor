import { encodeWav } from './wavEncoder'

export class AudioRecorder {
  private audioCtx: AudioContext | null = null
  private stream: MediaStream | null = null
  private scriptNode: ScriptProcessorNode | null = null
  private pcmFrames: Float32Array[] = []

  async start(): Promise<void> {
    this.stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    this.audioCtx = new AudioContext()
    const sourceNode = this.audioCtx.createMediaStreamSource(this.stream)
    this.scriptNode = this.audioCtx.createScriptProcessor(4096, 1, 1)

    this.pcmFrames = []
    this.scriptNode.onaudioprocess = (e) => {
      const channel = e.inputBuffer.getChannelData(0)
      this.pcmFrames.push(new Float32Array(channel))
    }

    sourceNode.connect(this.scriptNode)
    this.scriptNode.connect(this.audioCtx.destination)
  }

  async stop(): Promise<Blob> {
    if (!this.audioCtx || !this.scriptNode || !this.stream) {
      return new Blob([], { type: 'audio/wav' })
    }

    this.scriptNode.disconnect()
    const sampleRate = this.audioCtx.sampleRate
    await this.audioCtx.close()
    this.stream.getTracks().forEach(t => t.stop())

    const frames = this.pcmFrames
    const totalLen = frames.reduce((s, f) => s + f.length, 0)
    const allSamples = new Float32Array(totalLen)
    let offset = 0
    for (const frame of frames) {
      allSamples.set(frame, offset)
      offset += frame.length
    }

    this.audioCtx = null
    this.scriptNode = null
    this.stream = null
    this.pcmFrames = []

    return encodeWav(allSamples, sampleRate)
  }
}
