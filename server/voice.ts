import { createOpenAI } from '@ai-sdk/openai';
import { generateSpeech, transcribe } from 'ai';
import type { Express, Request, Response } from 'express';
import { z } from 'zod';
import type { ServerConfig } from './config.js';
import type { NeedleDatabase } from './database.js';
import { ApiError } from './errors.js';

const questionSchema = z.object({ sessionId: z.string().uuid() }).strict();
const transcriptionSchema = questionSchema.extend({ audioDataUrl: z.string().max(4_000_000) }).strict();
const audioPattern = /^data:(audio\/(?:webm|wav|mp4|mpeg))(?:;codecs=(?:opus|pcm|aac))?;base64,([A-Za-z0-9+/]+={0,2})$/;

/** Client recordings are bounded to 30 seconds; bytes stay in memory for this request only. */
function recordingBytes(dataUrl: string): Buffer {
  const match = audioPattern.exec(dataUrl);
  if (!match) throw new ApiError(400, 'INVALID_AUDIO', 'Record your answer as WebM, WAV, MP4, or MP3 audio.');
  const bytes = Buffer.from(match[2], 'base64');
  if (bytes.length < 12 || bytes.toString('base64') !== match[2]) throw new ApiError(400, 'INVALID_AUDIO', 'The recording could not be read. Record your answer again.');
  if (bytes.length > 3_000_000) throw new ApiError(413, 'AUDIO_TOO_LARGE', 'Keep your voice answer under 30 seconds.');
  const kind = match[1];
  const validHeader = kind === 'audio/webm' ? bytes.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]))
    : kind === 'audio/wav' ? bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WAVE'
    : kind === 'audio/mp4' ? bytes.toString('ascii', 4, 8) === 'ftyp'
    : bytes.toString('ascii', 0, 3) === 'ID3' || (bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0);
  if (!validHeader) throw new ApiError(400, 'INVALID_AUDIO', 'The recording format does not match its contents. Record your answer again.');
  return bytes;
}

function pendingQuestion(database: NeedleDatabase, sessionId: string): string {
  const session = database.session(sessionId);
  if (!session.interpretation.needsClarification) throw new ApiError(409, 'NO_QUESTION_PENDING', 'There is no question to answer for this selection.');
  return (session.interpretation.clarification?.trim() || 'Which object do you want to find?').slice(0, 500);
}

function voiceProvider(config: ServerConfig) {
  if (!config.openAiKey) throw new ApiError(503, 'VOICE_NOT_CONFIGURED', 'Voice needs OPENAI_API_KEY in .env. You can still type your answer.');
  return createOpenAI({ apiKey: config.openAiKey });
}

function voiceError(error: unknown, signal: AbortSignal): never {
  if (error instanceof ApiError) throw error;
  if (signal.aborted) throw new ApiError(504, 'VOICE_TIMEOUT', 'Voice took too long. Try again or type your answer.');
  const status = typeof error === 'object' && error !== null && 'statusCode' in error ? Number(error.statusCode) : 0;
  if (status === 401 || status === 403) throw new ApiError(503, 'VOICE_CREDENTIALS', 'OpenAI rejected the voice key. Check OPENAI_API_KEY in .env, or type your answer.');
  if (status === 429) throw new ApiError(429, 'VOICE_LIMIT', 'Voice is at its request limit. Wait briefly or type your answer.');
  // Provider bodies can contain submitted text, audio metadata, or credentials.
  throw new ApiError(502, 'VOICE_UNAVAILABLE', 'OpenAI voice could not finish. Try again or type your answer.');
}

async function boundedVoice<T>(req: Request, res: Response, timeoutMs: number, work: (signal: AbortSignal) => Promise<T>): Promise<T> {
  const controller = new AbortController();
  const disconnect = () => controller.abort();
  const closed = () => { if (!res.writableEnded) controller.abort(); };
  req.on('aborted', disconnect); res.on('close', closed);
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      work(controller.signal).catch(error => voiceError(error, controller.signal)),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          controller.abort();
          reject(new ApiError(504, 'VOICE_TIMEOUT', 'Voice took too long. Try again or type your answer.'));
        }, Math.min(timeoutMs, 25_000));
      }),
    ]);
  } finally { if (timer) clearTimeout(timer); req.removeListener('aborted', disconnect); res.removeListener('close', closed); }
}

/** Register behind the app's loopback/origin checks and JSON body limit. */
export function installVoiceRoutes(app: Express, config: ServerConfig, database: NeedleDatabase): void {
  app.post('/voice/question', async (req, res, next) => {
    try {
      const { sessionId } = questionSchema.parse(req.body);
      const text = pendingQuestion(database, sessionId);
      const provider = voiceProvider(config);
      const result = await boundedVoice(req, res, config.timeoutMs, async signal => {
        // Speech API remains supported until Jan 6, 2027; its replacement uses
        // Realtime, not a drop-in model name. Keep this local-demo model configurable.
        const { audio } = await generateSpeech({
          model: provider.speech(config.speechModel || 'gpt-4o-mini-tts'),
          text, voice: config.speechVoice || 'coral', outputFormat: 'mp3', maxRetries: 0, abortSignal: signal,
          instructions: 'Read the question exactly as written, warmly and clearly. Do not add an introduction or answer it.',
        });
        if (!audio.uint8Array.length || audio.uint8Array.length > 3_000_000) throw new ApiError(502, 'INVALID_SPEECH', 'The spoken question could not be played. You can read it and type your answer.');
        return { audioDataUrl: `data:audio/mpeg;base64,${audio.base64}` };
      });
      res.json(result);
    } catch (error) { next(error); }
  });

  app.post('/voice/transcribe', async (req, res, next) => {
    try {
      const { sessionId, audioDataUrl } = transcriptionSchema.parse(req.body);
      pendingQuestion(database, sessionId);
      const bytes = recordingBytes(audioDataUrl);
      const provider = voiceProvider(config);
      const result = await boundedVoice(req, res, config.timeoutMs, async signal => {
        const transcript = await transcribe({
          model: provider.transcription(config.transcriptionModel || 'gpt-transcribe'),
          audio: bytes, maxRetries: 0, abortSignal: signal,
        });
        const text = transcript.text.trim();
        if (!text) throw new ApiError(422, 'NO_SPEECH', 'No speech was heard. Try recording again or type your answer.');
        if (text.length > 1000 || (transcript.durationInSeconds !== undefined && transcript.durationInSeconds > 31)) throw new ApiError(422, 'ANSWER_TOO_LONG', 'Keep your voice answer under 30 seconds and 1,000 characters.');
        // Return text for review; this endpoint never submits an answer or buys anything.
        return { text };
      });
      res.json(result);
    } catch (error) { next(error); }
  });
}
