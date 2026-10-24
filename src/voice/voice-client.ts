export type VoicePhase = 'idle' | 'loading' | 'playing' | 'requesting' | 'recording' | 'transcribing';
export interface VoiceState { phase: VoicePhase; message: string }
export interface VoiceTransport {
  question(signal: AbortSignal): Promise<{ audioDataUrl: string }>;
  transcribe(audioDataUrl: string, signal: AbortSignal): Promise<{ text: string }>;
  cancel?(): void;
}
const MAX_AUDIO_BYTES = 2_000_000;
const MAX_RECORDING_MS = 30_000;

/** Explicit, short voice interactions. Recordings are only held in memory. */
export function createVoiceSession(transport: VoiceTransport, onState: (state: VoiceState) => void, onTranscript: (text: string) => void) {
  let generation = 0, disposed = false;
  let phase: VoicePhase = 'idle';
  let controller: AbortController | undefined;
  let stream: MediaStream | undefined;
  let recorder: MediaRecorder | undefined;
  let audio: HTMLAudioElement | undefined;
  let audioUrl: string | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const update = (next: VoicePhase, message = '') => { phase = next; if (!disposed) onState({ phase, message }); };
  const live = (id: number) => !disposed && generation === id;
  function release() {
    if (timer !== undefined) clearTimeout(timer); timer = undefined;
    controller?.abort(); controller = undefined;
    if (recorder) {
      recorder.ondataavailable = null; recorder.onstop = null; recorder.onerror = null;
      if (recorder.state !== 'inactive') recorder.stop(); recorder = undefined;
    }
    stream?.getTracks().forEach(track => track.stop()); stream = undefined;
    if (audio) { audio.onended = null; audio.onerror = null; audio.pause(); audio.removeAttribute('src'); audio.load(); audio = undefined; }
    if (audioUrl) URL.revokeObjectURL(audioUrl); audioUrl = undefined;
  }
  function cancel() {
    const busy = phase !== 'idle'; generation++; release();
    if (busy) transport.cancel?.();
    update('idle');
  }
  function failure(id: number, message: string) { if (live(id)) { release(); update('idle', message); } }
  async function speak() {
    if (disposed) return;
    cancel(); const id = generation; controller = new AbortController();
    update('loading', 'Preparing the question…');
    try {
      const reply = await transport.question(controller.signal);
      if (!live(id)) return;
      if (!/^data:audio\/(?:mpeg|mp3|wav);base64,[A-Za-z0-9+/]+=*$/.test(reply.audioDataUrl) || reply.audioDataUrl.length > 8_000_000) throw new Error('The spoken question could not be played. You can read it above.');
      const [header, encoded] = reply.audioDataUrl.split(',');
      const bytes = Uint8Array.from(atob(encoded), char => char.charCodeAt(0));
      audioUrl = URL.createObjectURL(new Blob([bytes], { type: header.slice(5, header.indexOf(';')) }));
      audio = new Audio(audioUrl);
      audio.onended = () => { if (live(id)) { release(); update('idle'); } };
      audio.onerror = () => failure(id, 'This page blocked audio playback. Read the question or open Needle’s panel.');
      await audio.play();
      if (live(id) && audio) update('playing', 'Reading the question…');
    } catch (error) { failure(id, error instanceof Error ? error.message : 'Audio could not play. You can read the question above.'); }
  }
  function stopRecording() {
    if (phase === 'recording' && recorder?.state !== 'inactive') {
      if (timer !== undefined) clearTimeout(timer); timer = undefined;
      update('transcribing', 'Turning your answer into text…');
      recorder?.stop();
      stream?.getTracks().forEach(track => track.stop()); stream = undefined;
    }
  }
  async function record() {
    if (disposed) return;
    cancel(); const id = generation;
    if (!globalThis.isSecureContext || !globalThis.navigator?.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      update('idle', 'Microphone access is unavailable here. Type your answer, or use Needle’s panel.'); return;
    }
    update('requesting', 'Allow microphone access to answer.');
    try {
      const captured = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (!live(id)) { captured.getTracks().forEach(track => track.stop()); return; }
      stream = captured;
      const mimeType = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'].find(type => MediaRecorder.isTypeSupported(type));
      if (!mimeType) throw new Error('This browser cannot record a supported audio format. Type your answer instead.');
      const currentRecorder = new MediaRecorder(captured, { mimeType, audioBitsPerSecond: 64_000 }); recorder = currentRecorder;
      const chunks: Blob[] = []; let byteCount = 0, tooLarge = false;
      currentRecorder.ondataavailable = event => {
        if (!live(id) || !event.data.size) return;
        byteCount += event.data.size;
        if (byteCount > MAX_AUDIO_BYTES) { tooLarge = true; stopRecording(); return; }
        chunks.push(event.data);
      };
      currentRecorder.onerror = () => failure(id, 'Recording failed. Type your answer or try the microphone again.');
      currentRecorder.onstop = () => {
        if (!live(id)) return;
        if (timer !== undefined) clearTimeout(timer); timer = undefined;
        stream?.getTracks().forEach(track => track.stop()); stream = undefined; recorder = undefined;
        if (tooLarge || !byteCount) { failure(id, tooLarge ? 'That recording is too large. Try a shorter answer.' : 'No audio was recorded. Try again or type your answer.'); return; }
        update('transcribing', 'Turning your answer into text…'); controller = new AbortController();
        void (async () => {
          const bytes = new Uint8Array(await new Blob(chunks, { type: mimeType }).arrayBuffer());
          if (!live(id)) return;
          let binary = ''; for (let i = 0; i < bytes.length; i += 8192) binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
          const { text } = await transport.transcribe(`data:${mimeType.split(';')[0]};base64,${btoa(binary)}`, controller!.signal);
          if (!live(id)) return;
          if (!text?.trim()) throw new Error('No speech was understood. Try again or type your answer.');
          release(); onTranscript(text.trim().slice(0, 1000)); update('idle', 'Review your answer, then send it.');
        })().catch(error => failure(id, error instanceof Error ? error.message : 'Could not transcribe the recording. Type your answer or try again.'));
      };
      currentRecorder.start(250);
      update('recording', 'Listening… Stop when you’re done (30 seconds maximum).');
      timer = setTimeout(stopRecording, MAX_RECORDING_MS);
    } catch (error) {
      const denied = error instanceof DOMException && ['NotAllowedError', 'SecurityError', 'NotFoundError'].includes(error.name);
      failure(id, denied ? 'Microphone access was denied or is unavailable. Type your answer, or use Needle’s panel.' : error instanceof Error ? error.message : 'Could not start the microphone. Type your answer instead.');
    }
  }
  return { speak, record, stopRecording, cancel, dispose() { disposed = true; cancel(); } };
}
export type VoiceSession = ReturnType<typeof createVoiceSession>;
