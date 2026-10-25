import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { Mic, Square, X } from 'lucide-react';
import { createVoiceSession, type VoiceSession, type VoiceState } from '../../voice/voice-client';
import { apiRequest } from '../api';

export function VoiceReply({ sessionId, disabled, answer, onTranscript, children }: { sessionId: string; disabled: boolean; answer: string; onTranscript: (text: string) => void; children: ReactNode }) {
  const [state, setState] = useState<VoiceState>({ phase: 'idle', message: '' });
  const disclosureId = useId();
  const voice = useRef<VoiceSession | null>(null);
  const latest = useRef({ answer, onTranscript }); latest.current = { answer, onTranscript };
  const initialAnswer = useRef(answer);
  useEffect(() => {
    const controller = createVoiceSession({
      question: signal => apiRequest('/voice/question', { sessionId }, signal),
      transcribe: (audioDataUrl, signal) => apiRequest('/voice/transcribe', { sessionId, audioDataUrl }, signal),
    }, setState, text => {
      // A recording must not replace text the shopper edited while it was running.
      if (latest.current.answer === initialAnswer.current) latest.current.onTranscript(text);
    });
    voice.current = controller;
    const stop = () => controller.cancel(); window.addEventListener('pagehide', stop);
    return () => { controller.dispose(); voice.current = null; window.removeEventListener('pagehide', stop); };
  }, [sessionId]);
  useEffect(() => { if (disabled) voice.current?.cancel(); }, [disabled]);
  useEffect(() => { if (answer !== initialAnswer.current) voice.current?.cancel(); }, [answer]);
  const recording = state.phase === 'recording';
  const active = state.phase !== 'idle';
  const label = recording ? 'Stop recording' : active ? 'Cancel voice' : 'Answer by voice';
  return <div className="voice-reply">
    <div className="clarification-input">
      {children}
      <button className="voice-mic" type="button" disabled={disabled} aria-label={label} aria-describedby={disclosureId} title={`${label}. Microphone audio is sent to OpenAI.`} aria-pressed={recording} onClick={() => {
        if (recording) voice.current?.stopRecording();
        else if (active) voice.current?.cancel();
        else { initialAnswer.current = latest.current.answer; void voice.current?.record(); }
      }}>{recording ? <Square size={14} aria-hidden="true" /> : active ? <X size={16} aria-hidden="true" /> : <Mic size={17} aria-hidden="true" />}</button>
    </div>
    <span className="voice-description" id={disclosureId}>Microphone audio is sent to OpenAI. Review the transcript before sending.</span>
    {state.message && <p className="voice-status" role="status">{state.message}</p>}
  </div>;
}
