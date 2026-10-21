import { useEffect, useRef, useState, type FormEvent } from 'react';
import { createPortal } from 'react-dom';
import { createRoot } from 'react-dom/client';

declare global {
  interface Window {
    HEALTHMIND_API_URL?: string;
  }
}

type Message = { role: 'You' | 'HealthMind'; text: string };
type CallStatus = 'idle' | 'requesting' | 'connecting' | 'live';
type ToolCall = { id?: string; name: string; args?: Record<string, unknown> };
type ToolApproval = {
  name: 'book_appointment' | 'cancel_appointment' | 'add_prescribed_medication';
  args: Record<string, unknown>;
  summary: string;
  busy: boolean;
};
type AppActionResult = Record<string, unknown>;
type ApiErrorResponse = {
  error?: { message?: string };
  detail?: { error?: { message?: string } };
};
type SessionResult = {
  token?: string;
  model?: string;
  websocket_url?: string;
  config?: Record<string, unknown>;
} & ApiErrorResponse;
type SupabaseSessionModule = {
  getSupabase: () => Promise<{
    auth: {
      getSession: () => Promise<{
        data: { session: { access_token: string } | null };
      }>;
    };
  }>;
};
type LiveServerMessage = {
  setupComplete?: Record<string, never>;
  error?: { message?: string };
  toolCall?: { functionCalls?: ToolCall[] };
  serverContent?: {
    inputTranscription?: { text?: string };
    outputTranscription?: { text?: string };
    turnComplete?: boolean;
    interrupted?: boolean;
    modelTurn?: { parts?: Array<{ inlineData?: { data?: string } }> };
  };
};

const AUTH_MODULE = '/js/services/supabase-client.js';
const INPUT_SAMPLE_RATE = 16000;
const OUTPUT_SAMPLE_RATE = 24000;
const apiUrl = (path: string) => (
  window.HEALTHMIND_API_URL ? new URL(path, window.HEALTHMIND_API_URL).toString() : path
);
const EMERGENCY_TERMS =
  /\b(chest pain|pain in (?:my )?chest|can't breathe|cannot breathe|trouble breathing|difficulty breathing|severe bleeding|unconscious|stroke|overdose|severe allergic reaction|suicid(?:e|al)|self[- ]harm|douleur (?:dans la poitrine|thoracique)|difficulté à respirer|saignement abondant|perte de connaissance|avc|surdosage|réaction allergique grave|envie de me suicider|kwiyahura|sinshobora guhumeka|amaraso menshi|kubabara mu gatuza)\b/i;

function encodePcm16Base64(samples: Float32Array, sampleRate: number): string {
  const outputLength = Math.floor((samples.length * INPUT_SAMPLE_RATE) / sampleRate);
  const bytes = new Uint8Array(outputLength * 2);
  const view = new DataView(bytes.buffer);

  for (let index = 0; index < outputLength; index += 1) {
    const sourceIndex = (index * sampleRate) / INPUT_SAMPLE_RATE;
    const left = Math.floor(sourceIndex);
    const fraction = sourceIndex - left;
    const first = samples[Math.min(left, samples.length - 1)] ?? 0;
    const second = samples[Math.min(left + 1, samples.length - 1)] ?? first;
    const value = Math.max(-1, Math.min(1, first + (second - first) * fraction));
    view.setInt16(index * 2, value < 0 ? value * 0x8000 : value * 0x7fff, true);
  }

  let binary = '';
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }
  return btoa(binary);
}

function pcm24kToFloat32(base64Audio: string): Float32Array<ArrayBuffer> {
  const binary = atob(base64Audio);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  const sampleCount = Math.floor(bytes.byteLength / 2);
  const view = new DataView(bytes.buffer, bytes.byteOffset, sampleCount * 2);
  const samples = new Float32Array(sampleCount);
  for (let index = 0; index < sampleCount; index += 1) {
    samples[index] = view.getInt16(index * 2, true) / 0x8000;
  }
  return samples;
}

async function getAccessToken(): Promise<string | null> {
  const auth = (await import(AUTH_MODULE)) as SupabaseSessionModule;
  const { data } = await (await auth.getSupabase()).auth.getSession();
  return data.session?.access_token ?? null;
}

async function callAppApi(
  path: string,
  method: 'GET' | 'POST' = 'GET',
  body?: Record<string, unknown>,
): Promise<AppActionResult> {
  const accessToken = await getAccessToken();
  if (!accessToken) throw new Error('Please sign in to use HealthMind app actions.');

  const response = await fetch(apiUrl(path), {
    method,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const data = (await response.json()) as ApiErrorResponse & AppActionResult;
  if (!response.ok) {
    throw new Error(
      data.error?.message ??
      data.detail?.error?.message ??
      (typeof data.message === 'string' ? data.message : 'The requested app action failed.'),
    );
  }
  return data;
}

function VoiceAssistant() {
  const [isOpen, setIsOpen] = useState(false);
  const [callStatus, setCallStatus] = useState<CallStatus>('idle');
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [muted, setMuted] = useState(false);
  const [error, setError] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [liveCaption, setLiveCaption] = useState('');
  const [emergencyDetected, setEmergencyDetected] = useState(false);
  const [chatText, setChatText] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [conversationId, setConversationId] = useState<number | null>(null);
  const [pendingAction, setPendingAction] = useState<ToolApproval | null>(null);
  const [sectionLink, setSectionLink] = useState<{ label: string; href: string } | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const silenceGainRef = useRef<GainNode | null>(null);
  const mutedRef = useRef(false);
  const playbackSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const playbackTimeRef = useRef(0);
  const liveRef = useRef(false);
  const inputTranscriptRef = useRef('');
  const outputTranscriptRef = useRef('');
  const pendingToolResolverRef = useRef<((confirmed: boolean) => void) | null>(null);
  const captionRef = useRef<HTMLDivElement | null>(null);
  const dialogRef = useRef<HTMLElement | null>(null);

  const inspectUrgency = (text: string) => {
    if (EMERGENCY_TERMS.test(text)) {
      setEmergencyDetected(true);
    }
  };

  const appendMessage = (role: Message['role'], text: string) => {
    const clean = text.trim();
    if (!clean) return;
    inspectUrgency(clean);
    setMessages((current) => [...current, { role, text: clean }].slice(-12));
  };

  const cleanupVoice = () => {
    liveRef.current = false;
    pendingToolResolverRef.current?.(false);
    pendingToolResolverRef.current = null;
    setPendingAction(null);
    setSectionLink(null);
    if (socketRef.current && socketRef.current.readyState < WebSocket.CLOSING) {
      socketRef.current.close();
    }
    processorRef.current?.disconnect();
    sourceRef.current?.disconnect();
    silenceGainRef.current?.disconnect();
    playbackSourcesRef.current.forEach((source) => source.stop());
    playbackSourcesRef.current.clear();
    streamRef.current?.getTracks().forEach((track) => track.stop());
    const audioContext = audioContextRef.current;
    if (audioContext && audioContext.state !== 'closed') {
      void audioContext.close().catch((reason: unknown) => {
        console.warn('Could not close the voice audio context cleanly.', reason);
      });
    }
    socketRef.current = null;
    audioContextRef.current = null;
    processorRef.current = null;
    sourceRef.current = null;
    silenceGainRef.current = null;
    streamRef.current = null;
    playbackTimeRef.current = 0;
    inputTranscriptRef.current = '';
    outputTranscriptRef.current = '';
    mutedRef.current = false;
    setMuted(false);
    setLiveCaption('');
    setCallStatus('idle');
  };

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        cleanupVoice();
        setIsOpen(false);
      }
    };
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('keydown', closeOnEscape);
      cleanupVoice();
    };
  }, []);

  useEffect(() => {
    if (captionRef.current) {
      captionRef.current.scrollTop = captionRef.current.scrollHeight;
    }
  }, [messages, liveCaption]);

  useEffect(() => {
    if (isOpen && dialogRef.current) {
      dialogRef.current.scrollTop = 0;
    }
  }, [isOpen, callStatus]);

  const confirmAppAction = () => {
    if (!pendingAction || pendingAction.busy) return;
    setPendingAction({ ...pendingAction, busy: true });
    pendingToolResolverRef.current?.(true);
    pendingToolResolverRef.current = null;
  };

  const declineAppAction = () => {
    if (pendingAction?.busy) return;
    pendingToolResolverRef.current?.(false);
    pendingToolResolverRef.current = null;
    setPendingAction(null);
  };

  const requestActionApproval = (
    name: ToolApproval['name'],
    args: Record<string, unknown>,
    summary: string,
  ) => new Promise<boolean>((resolve) => {
    pendingToolResolverRef.current = resolve;
    setPendingAction({ name, args, summary, busy: false });
  });

  const handleLiveToolCall = async (socket: WebSocket, calls: ToolCall[]) => {
    for (const call of calls) {
      const args = call.args ?? {};
      let result: AppActionResult;
      try {
        switch (call.name) {
          case 'list_appointments': {
            const data = await callAppApi('/api/appointments');
            result = { appointments: data.appointments ?? [], total: data.total ?? 0 };
            break;
          }
          case 'find_doctors': {
            const specialty = typeof args.specialty === 'string' ? args.specialty.trim() : '';
            const url = new URL(apiUrl('/api/appointments/doctors'), window.location.origin);
            if (specialty) url.searchParams.set('specialty', specialty);
            const data = await callAppApi(`${url.pathname}${url.search}`);
            result = { doctors: data.doctors ?? [] };
            break;
          }
          case 'get_available_slots': {
            const doctorId = typeof args.doctor_id === 'string' ? args.doctor_id : '';
            const date = typeof args.date === 'string' ? args.date : '';
            const url = new URL(apiUrl('/api/appointments/available-slots'), window.location.origin);
            url.searchParams.set('doctor_id', doctorId);
            url.searchParams.set('date', date);
            const data = await callAppApi(`${url.pathname}${url.search}`);
            result = { slots: data.slots ?? [], message: data.message ?? null };
            break;
          }
          case 'list_medications': {
            const data = await callAppApi('/api/medications');
            result = { medications: data.medications ?? [] };
            break;
          }
          case 'list_medical_records': {
            const data = await callAppApi('/api/medical-records?page=1&page_size=20');
            const records = Array.isArray(data.records) ? data.records : [];
            result = {
              records: records.map((record) => {
                const item = record as Record<string, unknown>;
                return {
                  title: item.title,
                  record_type: item.record_type,
                  created_at: item.created_at,
                  file_name: item.file_name,
                };
              }),
              total: data.total ?? records.length,
            };
            break;
          }
          case 'book_appointment': {
            const doctorId = typeof args.doctor_id === 'string' ? args.doctor_id : '';
            const date = typeof args.date === 'string' ? args.date : '';
            const time = typeof args.time === 'string' ? args.time : '';
            if (!doctorId || !date || !time) {
              result = { error: 'Doctor, date, and time are required. Ask the user for any missing details.' };
              break;
            }
            const doctorsData = await callAppApi('/api/appointments/doctors');
            const doctors = Array.isArray(doctorsData.doctors) ? doctorsData.doctors : [];
            const doctor = doctors.find(
              (item) => (item as Record<string, unknown>).id === doctorId,
            ) as Record<string, unknown> | undefined;
            if (!doctor) {
              result = { error: 'That doctor could not be found. Find doctors and ask the user to choose one.' };
              break;
            }
            const approved = await requestActionApproval(
              'book_appointment',
              args,
              `${String(doctor.name)}${doctor.specialty ? ` — ${String(doctor.specialty)}` : ''}, ${date} at ${time}`,
            );
            if (!approved) {
              result = { cancelled: true, message: 'The user declined to book this appointment. Do not retry unless asked.' };
              break;
            }
            const booking = await callAppApi('/api/appointments', 'POST', {
              doctor_id: doctorId,
              date,
              time,
              specialty: typeof args.specialty === 'string' ? args.specialty : doctor.specialty,
              notes: typeof args.notes === 'string' ? args.notes : null,
            });
            appendMessage(
              'HealthMind',
              `Appointment booked with ${String(doctor.name)} for ${date} at ${time}.`,
            );
            result = { booked: true, appointment: booking };
            setPendingAction(null);
            break;
          }
          case 'cancel_appointment': {
            const appointmentId = Number(args.appointment_id);
            if (!Number.isInteger(appointmentId) || appointmentId <= 0) {
              result = { error: 'A valid appointment ID is required. List the appointments and ask which one to cancel.' };
              break;
            }
            const data = await callAppApi('/api/appointments');
            const appointments = Array.isArray(data.appointments) ? data.appointments : [];
            const appointment = appointments.find(
              (item) => Number((item as Record<string, unknown>).id) === appointmentId,
            ) as Record<string, unknown> | undefined;
            if (!appointment || appointment.status === 'cancelled' || appointment.status === 'completed') {
              result = { error: 'That active appointment was not found in the signed-in user’s appointments.' };
              break;
            }
            const approved = await requestActionApproval(
              'cancel_appointment',
              args,
              `${String(appointment.doctor_name ?? 'Doctor')} — ${String(appointment.date)} at ${String(appointment.time)}`,
            );
            if (!approved) {
              result = { cancelled: false, message: 'The user chose not to cancel the appointment.' };
              break;
            }
            const cancellation = await callAppApi(
              `/api/appointments/${appointmentId}/cancel`,
              'POST',
              { reason: typeof args.reason === 'string' ? args.reason : 'Cancelled by patient' },
            );
            appendMessage('HealthMind', 'Your appointment was cancelled.');
            result = { cancelled: true, appointment_id: appointmentId, ...cancellation };
            setPendingAction(null);
            break;
          }
          case 'add_prescribed_medication': {
            const name = typeof args.name === 'string' ? args.name.trim() : '';
            const dosage = typeof args.dosage === 'string' ? args.dosage.trim() : '';
            const frequency = typeof args.frequency === 'string' ? args.frequency.trim() : '';
            if (!name || !dosage || !frequency) {
              result = {
                error: 'Medication name, prescribed dosage, and frequency are required. Ask the user; do not guess.',
              };
              break;
            }
            const summary = [
              name,
              dosage,
              frequency,
              typeof args.schedule === 'string' ? args.schedule : '',
              typeof args.instructions === 'string' ? args.instructions : '',
            ].filter(Boolean).join(' — ');
            const approved = await requestActionApproval('add_prescribed_medication', args, summary);
            if (!approved) {
              result = { cancelled: true, message: 'The user declined to save this medication. Do not retry unless asked.' };
              break;
            }
            const medication = await callAppApi('/api/medications', 'POST', {
              name,
              dosage,
              frequency,
              schedule: typeof args.schedule === 'string' ? args.schedule : null,
              instructions: typeof args.instructions === 'string' ? args.instructions : null,
              start_date: typeof args.start_date === 'string' ? args.start_date : null,
              end_date: typeof args.end_date === 'string' ? args.end_date : null,
            });
            appendMessage('HealthMind', `${name} was added to your medication tracker.`);
            result = { saved: true, medication };
            setPendingAction(null);
            break;
          }
          case 'open_app_section': {
            const section = typeof args.section === 'string' ? args.section : '';
            const sections: Record<string, { label: string; href: string }> = {
              appointments: { label: 'Open Appointments', href: '/appointments.html' },
              medications: { label: 'Open Medications', href: '/medications.html' },
              records: { label: 'Open Medical Records', href: '/medical-records.html' },
              doctors: { label: 'Find Doctors', href: '/appointments.html' },
              emergency: { label: 'Emergency Help', href: '/emergency.html' },
              settings: { label: 'Open Settings', href: '/settings.html' },
            };
            const target = sections[section];
            if (!target) {
              result = { error: 'That app section is not available.' };
              break;
            }
            setSectionLink(target);
            result = { message: target.label, target: target.href };
            break;
          }
          default:
            result = { error: `Unsupported app action: ${call.name}` };
        }
      } catch (reason) {
        setPendingAction(null);
        result = {
          error: reason instanceof Error ? reason.message : 'The app action could not be completed.',
        };
      }

      if (call.id && socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({
          toolResponse: {
            functionResponses: [{ id: call.id, name: call.name, response: result }],
          },
        }));
      }
    }
  };

  const startVoice = async () => {
    setError('');
    setPermissionDenied(false);
    if (!navigator.mediaDevices?.getUserMedia) {
      setError(
        'Microphone access requires a supported browser and a secure connection (HTTPS). You can use text chat below.',
      );
      return;
    }

    setCallStatus('requesting');

    try {
      const audioContext = new AudioContext();
      audioContextRef.current = audioContext;
      const microphoneRequest = navigator.mediaDevices.getUserMedia({ audio: true });
      const audioResume = audioContext.resume();
      const stream = await microphoneRequest;
      streamRef.current = stream;
      await audioResume;
      setCallStatus('connecting');

      const accessToken = await getAccessToken();
      if (!accessToken) {
        throw new Error('Please sign in to use the private voice assistant.');
      }

      const tokenResponse = await fetch(apiUrl('/api/ai/gemini/live-token'), {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const result = (await tokenResponse.json()) as SessionResult;
      if (!tokenResponse.ok) {
        throw new Error(
          result.error?.message ?? result.detail?.error?.message ?? 'The voice session could not be started.',
        );
      }
      if (!result.token || !result.model || !result.websocket_url || !result.config) {
        throw new Error('The voice service returned an incomplete session configuration.');
      }

      const source = audioContext.createMediaStreamSource(stream);
      const processor = audioContext.createScriptProcessor(2048, 1, 1);
      const silenceGain = audioContext.createGain();
      silenceGain.gain.value = 0;
      sourceRef.current = source;
      processorRef.current = processor;
      silenceGainRef.current = silenceGain;

      const socketUrl = new URL(result.websocket_url);
      socketUrl.searchParams.set('access_token', result.token);
      const socket = new WebSocket(socketUrl);
      socketRef.current = socket;
      source.connect(processor);
      processor.connect(silenceGain);
      silenceGain.connect(audioContext.destination);

      processor.onaudioprocess = ({ inputBuffer }) => {
        if (!liveRef.current || socket.readyState !== WebSocket.OPEN || mutedRef.current) return;
        socket.send(JSON.stringify({
          realtimeInput: {
            audio: {
              mimeType: `audio/pcm;rate=${INPUT_SAMPLE_RATE}`,
              data: encodePcm16Base64(inputBuffer.getChannelData(0), inputBuffer.sampleRate),
            },
          },
        }));
      };

      await new Promise<void>((resolve, reject) => {
        let setupFinished = false;
        const setupTimeout = window.setTimeout(() => {
          if (setupFinished) return;
          setupFinished = true;
          reject(new Error('Gemini Live did not finish setting up. Please try again.'));
        }, 20000);

        const rejectSetup = (reason: Error) => {
          if (setupFinished) return;
          setupFinished = true;
          window.clearTimeout(setupTimeout);
          reject(reason);
        };

        socket.addEventListener('open', () => {
          try {
            socket.send(JSON.stringify({
              setup: { model: `models/${result.model}`, ...result.config },
            }));
          } catch (reason) {
            rejectSetup(reason instanceof Error ? reason : new Error('Could not configure the voice session.'));
          }
        });
        socket.addEventListener('message', async ({ data }) => {
          try {
            const payload = typeof data === 'string'
              ? data
              : data instanceof Blob
                ? await data.text()
                : data instanceof ArrayBuffer
                  ? new TextDecoder().decode(data)
                  : null;
            if (payload === null) {
              throw new Error('Gemini Live sent an unsupported WebSocket message.');
            }
            const message = JSON.parse(payload) as LiveServerMessage;

            if (message.error) {
              const messageText = message.error.message ?? 'The Gemini Live session encountered an error.';
              rejectSetup(new Error(messageText));
              if (setupFinished && liveRef.current) {
                cleanupVoice();
                setError(messageText);
              }
              return;
            }
            if (message.setupComplete && !setupFinished) {
              setupFinished = true;
              window.clearTimeout(setupTimeout);
              liveRef.current = true;
              setCallStatus('live');
              setError('');
              resolve();
            }

            const functionCalls = message.toolCall?.functionCalls;
            if (functionCalls?.length) {
              void handleLiveToolCall(socket, functionCalls);
            }

            const content = message.serverContent;
            if (!content) return;
            if (content.interrupted) {
              playbackSourcesRef.current.forEach((playback) => playback.stop());
              playbackSourcesRef.current.clear();
              playbackTimeRef.current = audioContextRef.current?.currentTime ?? 0;
              outputTranscriptRef.current = '';
            }
            if (content.inputTranscription?.text) {
              inputTranscriptRef.current = content.inputTranscription.text;
              setLiveCaption(content.inputTranscription.text);
              inspectUrgency(content.inputTranscription.text);
            }
            if (content.outputTranscription?.text) {
              outputTranscriptRef.current = content.outputTranscription.text;
              setLiveCaption(content.outputTranscription.text);
              inspectUrgency(content.outputTranscription.text);
            }

            for (const part of content.modelTurn?.parts ?? []) {
              const encodedAudio = part.inlineData?.data;
              const context = audioContextRef.current;
              if (!encodedAudio || !context || content.interrupted) continue;
              const samples = pcm24kToFloat32(encodedAudio);
              if (samples.length === 0) continue;
              const buffer = context.createBuffer(1, samples.length, OUTPUT_SAMPLE_RATE);
              buffer.copyToChannel(samples, 0);
              const playback = context.createBufferSource();
              playback.buffer = buffer;
              playback.connect(context.destination);
              const startAt = Math.max(context.currentTime, playbackTimeRef.current);
              playback.start(startAt);
              playbackTimeRef.current = startAt + buffer.duration;
              playbackSourcesRef.current.add(playback);
              playback.addEventListener('ended', () => playbackSourcesRef.current.delete(playback), { once: true });
            }

            if (content.turnComplete) {
              appendMessage('You', inputTranscriptRef.current);
              appendMessage('HealthMind', outputTranscriptRef.current);
              inputTranscriptRef.current = '';
              outputTranscriptRef.current = '';
              setLiveCaption('');
            }
          } catch (reason) {
            console.warn('Could not process the Gemini Live event payload.', reason);
          }
        });
        socket.addEventListener('error', () => {
          rejectSetup(new Error('Could not connect to Gemini Live. Please try again or use text chat.'));
        });
        socket.addEventListener('close', () => {
          if (!setupFinished) {
            rejectSetup(new Error('Gemini Live closed before the session was ready. Please try again.'));
            return;
          }
          if (liveRef.current) {
            cleanupVoice();
            setError('The voice session was disconnected. You can try again or use text chat.');
          }
        });
      });
    } catch (reason) {
      cleanupVoice();
      if (reason instanceof DOMException && reason.name === 'NotAllowedError') {
        setPermissionDenied(true);
        setError('Microphone permission was denied. Allow microphone access in your browser settings, then try again.');
      } else {
        setError(reason instanceof Error ? reason.message : 'Voice could not be started. Please try text chat.');
      }
    }
  };
  const toggleMute = () => {
    const nextMuted = !muted;
    mutedRef.current = nextMuted;
    streamRef.current?.getAudioTracks().forEach((track) => {
      track.enabled = !nextMuted;
    });
    setMuted(nextMuted);
  };

  const stopVoice = () => {
    cleanupVoice();
  };

  const sendText = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const message = chatText.trim();
    if (!message || chatLoading) return;

    setError('');
    inspectUrgency(message);
    setChatText('');
    appendMessage('You', message);
    setChatLoading(true);

    try {
      const accessToken = await getAccessToken();
      if (!accessToken) {
        throw new Error('Please sign in to chat with HealthMind AI.');
      }

      const response = await fetch(apiUrl('/api/ai/chat'), {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ message, conversation_id: conversationId }),
      });
      const body = (await response.json()) as { conversation_id?: number; response?: string } & ApiErrorResponse;
      if (!response.ok || !body.response) {
        throw new Error(
          body.error?.message ?? body.detail?.error?.message ?? 'Could not send your message. Please try again.',
        );
      }

      if (body.conversation_id) {
        setConversationId(body.conversation_id);
      }
      appendMessage('HealthMind', body.response);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not send your message. Please try again.');
    } finally {
      setChatLoading(false);
    }
  };

  return createPortal(
    <>
      <button
        aria-label="Open HealthMind voice assistant"
        className="voice-launch"
        onClick={() => setIsOpen(true)}
        title="Talk to HealthMind"
        type="button"
      >
        <svg aria-hidden="true" viewBox="0 0 24 24">
          <path d="M12 14a3 3 0 0 0 3-3V6a3 3 0 0 0-6 0v5a3 3 0 0 0 3 3Z" />
          <path d="M19 11a7 7 0 0 1-14 0M12 18v4m-4 0h8" />
        </svg>
        <span className="voice-sr-only">Talk to HealthMind</span>
      </button>

      {isOpen && (
        <div
          className="voice-dialog-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              stopVoice();
              setIsOpen(false);
            }
          }}
        >
          <section
            aria-labelledby="voice-title"
            aria-modal="true"
            className={`voice-dialog${callStatus === 'live' ? ' voice-dialog-live' : ''}`}
            ref={dialogRef}
            role="dialog"
          >
            <header className="voice-dialog-header">
              {callStatus !== 'live' && (
                <div>
                  <h2 id="voice-title" style={{ margin: 0 }}>HealthMind AI</h2>
                  <span aria-live="polite" className="voice-status">
                    {callStatus === 'requesting'
                      ? 'Requesting microphone permission…'
                      : callStatus === 'connecting'
                        ? 'Connecting securely…'
                        : 'General health guidance'}
                  </span>
                </div>
              )}
              <button
                aria-label="Close voice assistant"
                className="voice-close"
                onClick={() => {
                  stopVoice();
                  setIsOpen(false);
                }}
                type="button"
              >
                ×
              </button>
            </header>

            <div className="voice-avatar-wrap" data-active={callStatus === 'live'}>
              <span className="voice-orbit" />
              <span className="voice-orbit" />
              <span className="voice-orbit" />
              <div aria-label="Animated HealthMind assistant avatar" className="voice-avatar" role="img">
                ✚
              </div>
            </div>

            {callStatus === 'live' && (
              <div className="voice-live-status" aria-live="polite">
                <strong id="voice-title">HealthMind</strong>
                <span>Listening — speak naturally</span>
              </div>
            )}

            {emergencyDetected && (
              <section aria-live="assertive" className="voice-emergency">
                <h3>Get Emergency Help</h3>
                <p>
                  These symptoms may need urgent medical attention. Do not wait for this chat. If you are in Rwanda,
                  call 112 now; otherwise call your local emergency number.
                </p>
                <div className="voice-emergency-actions">
                  <a className="voice-button voice-button-danger" href="tel:112">Call 112 (Rwanda)</a>
                  <a className="voice-button" href="/emergency.html">Emergency options</a>
                </div>
              </section>
            )}

            <div aria-live="polite" className="voice-captions" ref={captionRef} role="log">
              {messages.length === 0 && !liveCaption && (
                <p className="voice-caption">Ask a health question in English, français, or Kinyarwanda.</p>
              )}
              {messages.map((message, index) => (
                <p className="voice-caption" key={`${index}-${message.role}`}>
                  <strong>{message.role}: </strong>
                  {message.text}
                </p>
              ))}
              {liveCaption && (
                <p className="voice-caption voice-caption-live">
                  <strong>{callStatus === 'live' ? 'Live caption: ' : ''}</strong>
                  {liveCaption}
                </p>
              )}
              {chatLoading && <p className="voice-caption">HealthMind is responding…</p>}
            </div>

            {pendingAction && (
              <section aria-live="assertive" className="voice-action-confirmation">
                <h3>
                  {pendingAction.name === 'book_appointment'
                    ? 'Confirm appointment booking'
                    : pendingAction.name === 'cancel_appointment'
                      ? 'Confirm appointment cancellation'
                      : 'Confirm medication entry'}
                </h3>
                <p>{pendingAction.summary}</p>
                {pendingAction.name === 'add_prescribed_medication' && (
                  <p className="voice-action-safety">
                    Only save this if these exact details were prescribed by your clinician. HealthMind cannot
                    prescribe or recommend medication or dosage.
                  </p>
                )}
                <div className="voice-controls">
                  <button
                    className="voice-button"
                    disabled={pendingAction.busy}
                    onClick={declineAppAction}
                    type="button"
                  >
                    No, cancel
                  </button>
                  <button
                    className="voice-button voice-button-primary"
                    disabled={pendingAction.busy}
                    onClick={confirmAppAction}
                    type="button"
                  >
                    {pendingAction.busy
                      ? pendingAction.name === 'cancel_appointment' ? 'Cancelling…' : 'Saving…'
                      : pendingAction.name === 'cancel_appointment' ? 'Confirm cancellation' : 'Confirm and save'}
                  </button>
                </div>
              </section>
            )}

            {sectionLink && (
              <a className="voice-button voice-section-link" href={sectionLink.href}>
                {sectionLink.label}
              </a>
            )}

            <div className="voice-controls">
              {callStatus === 'live' ? (
                <>
                  <button className="voice-button" onClick={toggleMute} type="button">
                    {muted ? 'Unmute microphone' : 'Mute microphone'}
                  </button>
                  <button className="voice-button voice-button-danger" onClick={stopVoice} type="button">
                    End call
                  </button>
                </>
              ) : (
                <button
                  className="voice-button voice-button-primary"
                  disabled={callStatus === 'requesting' || callStatus === 'connecting'}
                  onClick={() => void startVoice()}
                  type="button"
                >
                  {callStatus === 'requesting'
                    ? 'Allow microphone…'
                    : callStatus === 'connecting'
                      ? 'Connecting…'
                      : permissionDenied
                        ? 'Try Again'
                        : 'Start voice conversation'}
                </button>
              )}
            </div>

            {permissionDenied && (
              <details className="voice-permission-help" open>
                <summary>How to allow microphone access</summary>
                <p>
                  In your browser settings, allow Microphone for this site, then choose “Try Again.” On iPhone or
                  iPad, open Settings → your browser → Microphone. Voice requires an HTTPS connection or localhost.
                </p>
              </details>
            )}

            {error && (
              <p className="voice-error" role="alert">
                {error}{' '}
                {error.toLowerCase().includes('sign in') && (
                  <a className="voice-sign-in" href="/login.html">Log in</a>
                )}
              </p>
            )}

            <div className="voice-divider">Or use text chat</div>
            <p className="voice-tool-hint">
              During live voice, you can ask about appointments, doctors, available times, medications, and record
              titles. Booking, cancellations, and medication changes always need your confirmation. Use the full AI
              Assistant for its text-based tools and conversation history.
            </p>
            <form className="voice-chat-form" onSubmit={(event) => void sendText(event)}>
              <input
                aria-label="Message HealthMind AI"
                maxLength={2000}
                onChange={(event) => setChatText(event.target.value)}
                placeholder="Ask a health question…"
                value={chatText}
              />
              <button className="voice-button voice-button-primary" disabled={!chatText.trim() || chatLoading} type="submit">
                Send
              </button>
            </form>
            <a className="voice-full-assistant" href="/ai-assistant.html">Open the full AI Assistant</a>

            <p className="voice-disclaimer">
              General information only — not a diagnosis or a substitute for a clinician. The app does not save the
              voice conversation. Text chat follows the existing AI conversation flow and your account permissions.
            </p>
          </section>
        </div>
      )}
    </>,
    document.body,
  );
}

const rootElement = document.getElementById('healthmind-voice-root');
if (rootElement) {
  createRoot(rootElement).render(<VoiceAssistant />);
}
