import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createVoiceSession, type VoiceSession, type VoiceState } from '../src/voice/voice-client';

class FakeRecorder {
  static instances: FakeRecorder[] = [];
  static isTypeSupported = (type: string) => type.startsWith('audio/webm');
  state = 'inactive';
  ondataavailable: ((event: { data: Blob }) => void) | null = null;
  onstop: (() => void) | null = null;
  onerror: (() => void) | null = null;
  constructor() { FakeRecorder.instances.push(this); }
  start() { this.state = 'recording'; }
  stop() { this.state = 'inactive'; queueMicrotask(() => this.onstop?.()); }
  chunk(bytes: Uint8Array = new Uint8Array([1, 2, 3])) { this.ondataavailable?.({ data: new Blob([new Uint8Array(bytes)]) }); }
}
class FakeAudio {
  static instances: FakeAudio[] = [];
  onended: (() => void) | null = null;
  onerror: (() => void) | null = null;
  pause = vi.fn(); load = vi.fn(); removeAttribute = vi.fn();
  play = vi.fn(async () => {});
  constructor(public src: string) { FakeAudio.instances.push(this); }
}
let stopTrack: ReturnType<typeof vi.fn>;
let stream: MediaStream;
let getUserMedia: ReturnType<typeof vi.fn>;
let sessions: VoiceSession[];
function setup() {
  const states: VoiceState[] = [];
  const transport = { question: vi.fn(async () => ({ audioDataUrl: 'data:audio/mpeg;base64,AQID' })), transcribe: vi.fn(async () => ({ text: 'The black instrument' })), cancel: vi.fn() };
  const transcript = vi.fn();
  const voice = createVoiceSession(transport, state => states.push(state), transcript); sessions.push(voice);
  return { voice, transport, transcript, states };
}
beforeEach(() => {
  sessions = []; FakeRecorder.instances = []; FakeAudio.instances = [];
  stopTrack = vi.fn(); stream = { getTracks: () => [{ stop: stopTrack }] } as unknown as MediaStream;
  getUserMedia = vi.fn(async () => stream);
  vi.stubGlobal('navigator', { mediaDevices: { getUserMedia } }); vi.stubGlobal('isSecureContext', true);
  vi.stubGlobal('MediaRecorder', FakeRecorder); vi.stubGlobal('Audio', FakeAudio);
  vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:question'); vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
});
afterEach(() => { sessions.forEach(session => session.dispose()); vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe('explicit voice clarification', () => {
  it('records only on request, stops the microphone, and returns editable text without submitting', async () => {
    const { voice, transport, transcript, states } = setup();
    expect(getUserMedia).not.toHaveBeenCalled();
    await voice.record(); expect(states.at(-1)?.phase).toBe('recording');
    FakeRecorder.instances[0].chunk(); voice.stopRecording();
    await vi.waitFor(() => expect(transcript).toHaveBeenCalledWith('The black instrument'));
    expect(transport.transcribe).toHaveBeenCalledWith('data:audio/webm;base64,AQID', expect.any(AbortSignal));
    expect(stopTrack).toHaveBeenCalledTimes(1);
    expect(states.at(-1)).toEqual({ phase: 'idle', message: 'Review your answer, then send it.' });
  });
  it('closes a microphone grant that arrives after cancellation and never records', async () => {
    let grant!: (stream: MediaStream) => void;
    getUserMedia.mockImplementationOnce(() => new Promise(resolve => { grant = resolve; }));
    const { voice, transport, transcript } = setup();
    const pending = voice.record(); voice.cancel(); grant(stream); await pending;
    expect(stopTrack).toHaveBeenCalledOnce(); expect(FakeRecorder.instances).toHaveLength(0);
    expect(transport.transcribe).not.toHaveBeenCalled(); expect(transcript).not.toHaveBeenCalled();
  });
  it('cancellation discards both recorded chunks and late transcription', async () => {
    const { voice, transport, transcript } = setup();
    await voice.record(); FakeRecorder.instances[0].chunk(); voice.cancel();
    await Promise.resolve(); expect(transport.transcribe).not.toHaveBeenCalled();
    let resolve!: (value: { text: string }) => void;
    transport.transcribe.mockImplementationOnce(() => new Promise(done => { resolve = done; }));
    await voice.record(); FakeRecorder.instances[1].chunk(); voice.stopRecording();
    await vi.waitFor(() => expect(transport.transcribe).toHaveBeenCalled());
    voice.dispose(); resolve({ text: 'A stale reply' }); await Promise.resolve();
    expect(transcript).not.toHaveBeenCalled(); expect(transport.cancel).toHaveBeenCalled();
    expect(stopTrack).toHaveBeenCalledTimes(2);
  });
  it('bounds recordings to thirty seconds and refuses oversized audio', async () => {
    vi.useFakeTimers(); const { voice, transport, transcript } = setup();
    await voice.record(); FakeRecorder.instances[0].chunk(); await vi.advanceTimersByTimeAsync(30_000);
    expect(transport.transcribe).toHaveBeenCalledTimes(1); expect(transcript).toHaveBeenCalledTimes(1);
    await voice.record(); FakeRecorder.instances[1].chunk(new Uint8Array(2_000_001)); await vi.advanceTimersByTimeAsync(1);
    expect(transport.transcribe).toHaveBeenCalledTimes(1); expect(stopTrack).toHaveBeenCalledTimes(2);
  });
  it('leaves typing available after denied microphone access or failed transcription', async () => {
    const { voice, transport, transcript, states } = setup();
    getUserMedia.mockRejectedValueOnce(new DOMException('Denied', 'NotAllowedError'));
    await voice.record(); expect(states.at(-1)?.message).toContain('Type your answer');
    transport.transcribe.mockRejectedValueOnce(new Error('Voice service offline. Type your answer.'));
    await voice.record(); FakeRecorder.instances[0].chunk(); voice.stopRecording();
    await vi.waitFor(() => expect(states.at(-1)?.message).toContain('Voice service offline'));
    expect(states.at(-1)?.phase).toBe('idle'); expect(transcript).not.toHaveBeenCalled();
  });
  it('uses server speech and releases playback when recording starts', async () => {
    const { voice, transport, states } = setup();
    await voice.speak(); expect(transport.question).toHaveBeenCalledWith(expect.any(AbortSignal));
    expect(states.at(-1)?.phase).toBe('playing'); expect(FakeAudio.instances[0].src).toBe('blob:question');
    await voice.record(); expect(FakeAudio.instances[0].pause).toHaveBeenCalledOnce();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:question'); expect(states.at(-1)?.phase).toBe('recording');
  });
  it('does not play speech that arrives after the popup or panel closes', async () => {
    const { voice, transport } = setup(); let resolve!: (value: { audioDataUrl: string }) => void;
    transport.question.mockImplementationOnce(() => new Promise(done => { resolve = done; }));
    const pending = voice.speak(); voice.dispose(); resolve({ audioDataUrl: 'data:audio/mpeg;base64,AQID' }); await pending;
    expect(FakeAudio.instances).toHaveLength(0); expect(URL.createObjectURL).not.toHaveBeenCalled();
  });
});
