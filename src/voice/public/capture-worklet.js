/**
 * Mic capture worklet.
 *
 * Produces exactly what the Live API wants: raw 16-bit PCM, 16 kHz,
 * little-endian, mono. Resamples if the AudioContext did not give us 16 kHz —
 * Safari in particular ignores the requested rate, and feeding the API audio at
 * the wrong rate sounds like noise rather than failing loudly.
 *
 * Also reports per-frame RMS so the page can run an energy gate for the latency
 * measurement (and, in client turn-detection mode, for turn boundaries).
 */

const TARGET_RATE = 16000;
/** 20 ms at 16 kHz. Small enough to keep latency low, big enough to be cheap. */
const FRAME_SAMPLES = 320;

class CaptureProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.buffer = new Float32Array(FRAME_SAMPLES);
    this.filled = 0;
    // Fractional read position into the input, for linear resampling.
    this.readPos = 0;
    this.ratio = sampleRate / TARGET_RATE;
    this.port.postMessage({ type: 'rate', sampleRate, ratio: this.ratio });
  }

  process(inputs) {
    const channel = inputs[0] && inputs[0][0];
    if (!channel) return true;

    if (this.ratio === 1) {
      for (let i = 0; i < channel.length; i++) this.push(channel[i]);
      return true;
    }

    // Linear resample to 16 kHz. readPos carries across blocks so there is no
    // click at the boundary.
    while (this.readPos < channel.length) {
      const i = Math.floor(this.readPos);
      const frac = this.readPos - i;
      const a = channel[i];
      const b = i + 1 < channel.length ? channel[i + 1] : a;
      this.push(a + (b - a) * frac);
      this.readPos += this.ratio;
    }
    this.readPos -= channel.length;

    return true;
  }

  push(sample) {
    this.buffer[this.filled++] = sample;
    if (this.filled < FRAME_SAMPLES) return;

    let sumSquares = 0;
    const pcm = new Int16Array(FRAME_SAMPLES);
    for (let i = 0; i < FRAME_SAMPLES; i++) {
      const s = Math.max(-1, Math.min(1, this.buffer[i]));
      sumSquares += s * s;
      // Asymmetric int16 range: -32768..32767.
      pcm[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
    }

    this.port.postMessage(
      { type: 'frame', pcm: pcm.buffer, rms: Math.sqrt(sumSquares / FRAME_SAMPLES) },
      [pcm.buffer],
    );
    this.filled = 0;
  }
}

registerProcessor('capture-processor', CaptureProcessor);
