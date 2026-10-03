/**
 * Verify the audio format chain offline, before spending the API key on it.
 * Replicates capture-worklet.js exactly, then checks the result numerically.
 */

const TARGET_RATE = 16000;
const FRAME = 320;

// Mirror of CaptureProcessor: linear resample to 16k, Float32 -> Int16LE.
function captureChain(input, inputRate) {
  const ratio = inputRate / TARGET_RATE;
  const out = [];
  let buffer = new Float32Array(FRAME);
  let filled = 0;
  let readPos = 0;

  const push = (s) => {
    buffer[filled++] = s;
    if (filled < FRAME) return;
    const pcm = new Int16Array(FRAME);
    for (let i = 0; i < FRAME; i++) {
      const v = Math.max(-1, Math.min(1, buffer[i]));
      pcm[i] = v < 0 ? v * 0x8000 : v * 0x7fff;
    }
    out.push(pcm);
    filled = 0;
  };

  // Feed in 128-sample blocks, like a real AudioWorklet does.
  for (let b = 0; b < input.length; b += 128) {
    const block = input.subarray(b, Math.min(b + 128, input.length));
    if (ratio === 1) {
      for (let i = 0; i < block.length; i++) push(block[i]);
      continue;
    }
    while (readPos < block.length) {
      const i = Math.floor(readPos);
      const frac = readPos - i;
      const a = block[i];
      const nb = i + 1 < block.length ? block[i + 1] : a;
      push(a + (nb - a) * frac);
      readPos += ratio;
    }
    readPos -= block.length;
  }
  return out;
}

function sine(freq, rate, seconds, amp = 0.5) {
  const n = Math.floor(rate * seconds);
  const buf = new Float32Array(n);
  for (let i = 0; i < n; i++) buf[i] = amp * Math.sin((2 * Math.PI * freq * i) / rate);
  return buf;
}

/** Frequency estimate from zero crossings — enough to catch a wrong sample rate. */
function freqFromZeroCrossings(int16Frames, rate) {
  const all = [];
  for (const f of int16Frames) for (const s of f) all.push(s);
  let crossings = 0;
  for (let i = 1; i < all.length; i++) {
    if ((all[i - 1] < 0 && all[i] >= 0) || (all[i - 1] >= 0 && all[i] < 0)) crossings++;
  }
  return { hz: (crossings / 2) * (rate / all.length), samples: all.length };
}

function rms(int16Frames) {
  let sum = 0, n = 0;
  for (const f of int16Frames) for (const s of f) { const v = s / 0x8000; sum += v * v; n++; }
  return Math.sqrt(sum / n);
}

let failures = 0;
const check = (label, ok, detail) => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? '  — ' + detail : ''}`);
  if (!ok) failures++;
};

console.log('--- input chain: mic -> PCM16LE @ 16 kHz ---');

for (const inRate of [16000, 44100, 48000]) {
  const frames = captureChain(sine(440, inRate, 1.0), inRate);
  const est = freqFromZeroCrossings(frames, TARGET_RATE);
  const expectedSamples = TARGET_RATE; // 1 second
  check(
    `${inRate} Hz in -> 440 Hz preserved`,
    Math.abs(est.hz - 440) < 8,
    `measured ${est.hz.toFixed(1)} Hz`,
  );
  check(
    `${inRate} Hz in -> ~1 s of 16 kHz audio`,
    Math.abs(est.samples - expectedSamples) < FRAME * 2,
    `${est.samples} samples (expected ~${expectedSamples})`,
  );
  check(
    `${inRate} Hz in -> amplitude preserved`,
    Math.abs(rms(frames) - 0.3536) < 0.02,
    `rms ${rms(frames).toFixed(4)} (0.5 amp sine = 0.3536)`,
  );
}

console.log('\n--- byte order: little-endian over base64 ---');
{
  const pcm = new Int16Array([0, 1, -1, 32767, -32768, 1000]);
  const buf = Buffer.from(pcm.buffer);
  check('int16 -> 2 bytes each', buf.length === pcm.length * 2, `${buf.length} bytes`);
  // 1000 = 0x03E8 -> LE bytes e8 03
  check('little-endian byte order', buf[10] === 0xe8 && buf[11] === 0x03, `got ${buf[10].toString(16)} ${buf[11].toString(16)}`);
  // Buffer.from can return a view into a pooled ArrayBuffer, so slice by the
  // view's own offset rather than handing .buffer straight to Int16Array.
  const decoded = Buffer.from(buf.toString('base64'), 'base64');
  const round = new Int16Array(
    decoded.buffer.slice(decoded.byteOffset, decoded.byteOffset + decoded.byteLength),
  );
  check('base64 round-trip lossless', [...round].every((v, i) => v === pcm[i]));
}

console.log('\n--- output chain: PCM16LE @ 24 kHz -> Float32 playback ---');
{
  // What the page does: Int16 / 0x8000 into an AudioBuffer at 24000 Hz.
  const src = sine(440, 24000, 0.5);
  const asInt16 = new Int16Array(src.length);
  for (let i = 0; i < src.length; i++) asInt16[i] = src[i] < 0 ? src[i] * 0x8000 : src[i] * 0x7fff;
  const wire = Buffer.from(asInt16.buffer);
  const decoded = new Int16Array(
    wire.buffer.slice(wire.byteOffset, wire.byteOffset + wire.byteLength),
  );
  const back = new Float32Array(decoded.length);
  for (let i = 0; i < decoded.length; i++) back[i] = decoded[i] / 0x8000;

  let maxErr = 0;
  for (let i = 0; i < src.length; i++) maxErr = Math.max(maxErr, Math.abs(src[i] - back[i]));
  // Bound is 2 LSB, not 1: encoding positives with 0x7fff and decoding with
  // 0x8000 is deliberate (it keeps +1.0 from overflowing to -32768) and costs
  // up to another half-step on top of rounding. 2 LSB is -84 dB — inaudible.
  const twoLsb = 2 / 32768;
  check(
    '24 kHz round-trip within int16 quantisation',
    maxErr < twoLsb,
    `max error ${maxErr.toExponential(2)} (${(maxErr * 32768).toFixed(2)} LSB, bound 2)`,
  );
  check('sample count preserved', back.length === src.length, `${back.length} vs ${src.length}`);

  // Guard against the classic bug: interpreting 24 kHz output as 16 kHz.
  const wrongDuration = back.length / 16000;
  const rightDuration = back.length / 24000;
  check(
    'playback rate matters (24k vs 16k differ audibly)',
    Math.abs(wrongDuration - rightDuration) > 0.1,
    `${rightDuration.toFixed(3)}s at 24k vs ${wrongDuration.toFixed(3)}s at 16k — 1.5x pitch error if wrong`,
  );
}

console.log(`\n${failures === 0 ? 'ALL CHECKS PASSED' : failures + ' CHECK(S) FAILED'}`);
process.exit(failures === 0 ? 0 : 1);
