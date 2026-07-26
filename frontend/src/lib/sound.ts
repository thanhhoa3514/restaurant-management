// Web Audio API Synthesizer for Realtime Notifications
// Uses Web Audio API oscillator - zero external audio assets required, 100% reliable.

let audioCtx: AudioContext | null = null

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null
  if (!audioCtx) {
    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    if (AudioContextClass) {
      audioCtx = new AudioContextClass()
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    void audioCtx.resume()
  }
  return audioCtx
}

// Global click handler to unlock Web Audio API autoplay
if (typeof window !== 'undefined') {
  const unlockAudio = () => {
    if (audioCtx && audioCtx.state === 'suspended') {
      void audioCtx.resume()
    }
    window.removeEventListener('click', unlockAudio)
    window.removeEventListener('touchstart', unlockAudio)
  }
  window.addEventListener('click', unlockAudio)
  window.addEventListener('touchstart', unlockAudio)
}

/** Gentle chime for new order / table session (C5 -> G5) */
export function playNewOrderSound() {
  const ctx = getAudioContext()
  if (!ctx) return

  const now = ctx.currentTime
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()

  osc.type = 'sine'
  osc.frequency.setValueAtTime(523.25, now) // C5
  osc.frequency.setValueAtTime(783.99, now + 0.12) // G5

  gain.gain.setValueAtTime(0.2, now)
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4)

  osc.connect(gain)
  gain.connect(ctx.destination)

  osc.start(now)
  osc.stop(now + 0.4)
}

/** Pleasant triple bell when Kitchen marks item READY (E5 -> A5 -> C6) */
export function playKitchenReadySound() {
  const ctx = getAudioContext()
  if (!ctx) return

  const now = ctx.currentTime
  const notes = [659.25, 880.0, 1046.5] // E5, A5, C6

  notes.forEach((freq, idx) => {
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()

    const noteTime = now + idx * 0.1
    osc.type = 'triangle'
    osc.frequency.setValueAtTime(freq, noteTime)

    gain.gain.setValueAtTime(0.25, noteTime)
    gain.gain.exponentialRampToValueAtTime(0.001, noteTime + 0.35)

    osc.connect(gain)
    gain.connect(ctx.destination)

    osc.start(noteTime)
    osc.stop(noteTime + 0.35)
  })
}

/** Alert ping for Waiter Call / Bill Request (G5 -> C6 ping) */
export function playCallWaiterSound() {
  const ctx = getAudioContext()
  if (!ctx) return

  const now = ctx.currentTime
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()

  osc.type = 'sine'
  osc.frequency.setValueAtTime(783.99, now) // G5
  osc.frequency.setValueAtTime(1046.5, now + 0.15) // C6

  gain.gain.setValueAtTime(0.3, now)
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5)

  osc.connect(gain)
  gain.connect(ctx.destination)

  osc.start(now)
  osc.stop(now + 0.5)
}
