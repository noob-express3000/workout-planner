// AssemblyAI expects 16-bit little-endian PCM. The AudioContext runs at 16 kHz.
class LedgerPCM extends AudioWorkletProcessor {
  constructor() {
    super(); this.buffer = new Int16Array(1600); this.offset = 0;
    this.port.onmessage = event => {
      if (event.data === 'flush') {
        if (this.offset) {
          // Pad the final fragment to the minimum 50 ms frame length.
          const tail = new Int16Array(Math.max(800, this.offset));
          tail.set(this.buffer.subarray(0, this.offset));
          this.port.postMessage(tail.buffer, [tail.buffer]); this.offset = 0;
        }
        this.port.postMessage({ flushed: true });
      }
    };
  }
  process(inputs) {
    const samples = inputs[0]?.[0];
    if (samples) for (const value of samples) {
      const clipped = Math.max(-1, Math.min(1, value));
      this.buffer[this.offset++] = clipped < 0 ? clipped * 32768 : clipped * 32767;
      if (this.offset === this.buffer.length) {
        this.port.postMessage(this.buffer.buffer, [this.buffer.buffer]);
        this.buffer = new Int16Array(1600); this.offset = 0;
      }
    }
    return true;
  }
}
registerProcessor('ledger-pcm', LedgerPCM);
