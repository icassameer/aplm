import OpenAI, { toFile } from "openai";
import { Buffer } from "node:buffer";
import { spawn } from "child_process";
import { writeFile, unlink, readFile } from "fs/promises";
import { randomUUID } from "crypto";
import { tmpdir } from "os";
import { join } from "path";

export const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export type AudioFormat = "wav" | "mp3" | "webm" | "mp4" | "ogg" | "unknown";

/**
 * Detect audio format from buffer magic bytes.
 * Supports: WAV, MP3, WebM (Chrome/Firefox), MP4/M4A/MOV (Safari/iOS), OGG
 */
export function detectAudioFormat(buffer: Buffer): AudioFormat {
  if (buffer.length < 12) return "unknown";

  // WAV: RIFF....WAVE
  if (buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46) {
    return "wav";
  }
  // WebM: EBML header
  if (buffer[0] === 0x1a && buffer[1] === 0x45 && buffer[2] === 0xdf && buffer[3] === 0xa3) {
    return "webm";
  }
  // MP3: ID3 tag or frame sync
  if (
    (buffer[0] === 0xff && (buffer[1] === 0xfb || buffer[1] === 0xfa || buffer[1] === 0xf3)) ||
    (buffer[0] === 0x49 && buffer[1] === 0x44 && buffer[2] === 0x33)
  ) {
    return "mp3";
  }
  // MP4/M4A/MOV: ....ftyp (Safari/iOS records in these containers)
  if (buffer[4] === 0x66 && buffer[5] === 0x74 && buffer[6] === 0x79 && buffer[7] === 0x70) {
    return "mp4";
  }
  // OGG: OggS
  if (buffer[0] === 0x4f && buffer[1] === 0x67 && buffer[2] === 0x67 && buffer[3] === 0x53) {
    return "ogg";
  }
  return "unknown";
}

/**
 * Convert any audio/video format to WAV using ffmpeg.
 * Uses temp files instead of pipes because video containers (MP4/MOV)
 * require seeking to find the audio track.
 */
export async function convertToWav(audioBuffer: Buffer): Promise<Buffer> {
  const inputPath = join(tmpdir(), `input-${randomUUID()}`);
  const outputPath = join(tmpdir(), `output-${randomUUID()}.wav`);

  try {
    // Write input to temp file (required for video containers that need seeking)
    await writeFile(inputPath, audioBuffer);

    // Run ffmpeg with file paths
    await new Promise<void>((resolve, reject) => {
      const ffmpeg = spawn("ffmpeg", [
        "-i", inputPath,
        "-vn",                    // Extract audio only
        "-f", "wav",
        "-ar", "16000",           // 16kHz — optimal for Whisper
        "-ac", "1",               // Mono
        "-acodec", "pcm_s16le",   // 16-bit PCM
        // No audio filters — keep original audio intact for best Whisper accuracy
        "-y",                     // Overwrite output
        outputPath,
      ]);

      ffmpeg.stderr.on("data", () => {}); // Suppress logs
      ffmpeg.on("close", (code) => {
        if (code === 0) resolve();
        else reject(new Error(`ffmpeg exited with code ${code}`));
      });
      ffmpeg.on("error", reject);
    });

    // Read converted audio
    return await readFile(outputPath);
  } finally {
    // Clean up temp files
    await unlink(inputPath).catch(() => {});
    await unlink(outputPath).catch(() => {});
  }
}

/**
 * Auto-detect and convert audio to OpenAI-compatible format.
 * - WAV/MP3: Pass through (already compatible)
 * - WebM/MP4/OGG: Convert to WAV via ffmpeg
 */
export async function ensureCompatibleFormat(
  audioBuffer: Buffer
): Promise<{ buffer: Buffer; format: "wav" | "mp3" }> {
  const detected = detectAudioFormat(audioBuffer);
  // MP3 and WAV — pass directly to Whisper, no conversion needed
  if (detected === "mp3") return { buffer: audioBuffer, format: "mp3" };
  if (detected === "wav") return { buffer: audioBuffer, format: "wav" };
  // WebM, MP4, OGG, unknown — convert to WAV via ffmpeg
  try {
    const wavBuffer = await convertToWav(audioBuffer);
    return { buffer: wavBuffer, format: "wav" };
  } catch (err) {
    return { buffer: audioBuffer, format: "wav" };
  }
}

/**
 * Voice Chat: User speaks, LLM responds with audio (audio-in, audio-out).
 * Uses gpt-4o-audio-preview model via OpenAI API.
 * Note: Browser records WebM/opus - convert to WAV using ffmpeg before calling this.
 */
export async function voiceChat(
  audioBuffer: Buffer,
  voice: "alloy" | "echo" | "fable" | "onyx" | "nova" | "shimmer" = "alloy",
  inputFormat: "wav" | "mp3" = "wav",
  outputFormat: "wav" | "mp3" = "mp3"
): Promise<{ transcript: string; audioResponse: Buffer }> {
  const audioBase64 = audioBuffer.toString("base64");
  const response = await openai.chat.completions.create({
    model: "gpt-4o-audio-preview",
    modalities: ["text", "audio"],
    audio: { voice, format: outputFormat },
    messages: [{
      role: "user",
      content: [
        { type: "input_audio", input_audio: { data: audioBase64, format: inputFormat } },
      ],
    }],
  });
  const message = response.choices[0]?.message as any;
  const transcript = message?.audio?.transcript || message?.content || "";
  const audioData = message?.audio?.data ?? "";
  return {
    transcript,
    audioResponse: Buffer.from(audioData, "base64"),
  };
}

/**
 * Streaming Voice Chat: For real-time audio responses.
 * Note: Streaming only supports pcm16 output format.
 *
 * @example
 * // Converting browser WebM to WAV before calling:
 * const webmBuffer = Buffer.from(req.body.audio, "base64");
 * const wavBuffer = await convertWebmToWav(webmBuffer);
 * for await (const chunk of voiceChatStream(wavBuffer)) { ... }
 */
export async function voiceChatStream(
  audioBuffer: Buffer,
  voice: "alloy" | "echo" | "fable" | "onyx" | "nova" | "shimmer" = "alloy",
  inputFormat: "wav" | "mp3" = "wav"
): Promise<AsyncIterable<{ type: "transcript" | "audio"; data: string }>> {
  const audioBase64 = audioBuffer.toString("base64");
  const stream = await openai.chat.completions.create({
    model: "gpt-4o-audio-preview",
    modalities: ["text", "audio"],
    audio: { voice, format: "pcm16" },
    messages: [{
      role: "user",
      content: [
        { type: "input_audio", input_audio: { data: audioBase64, format: inputFormat } },
      ],
    }],
    stream: true,
  });

  return (async function* () {
    for await (const chunk of stream) {
      const delta = chunk.choices?.[0]?.delta as any;
      if (!delta) continue;
      if (delta?.audio?.transcript) {
        yield { type: "transcript", data: delta.audio.transcript };
      }
      if (delta?.audio?.data) {
        yield { type: "audio", data: delta.audio.data };
      }
    }
  })();
}

/**
 * Text-to-Speech: Converts text to speech verbatim.
 * Uses gpt-4o-audio-preview model via OpenAI API.
 */
export async function textToSpeech(
  text: string,
  voice: "alloy" | "echo" | "fable" | "onyx" | "nova" | "shimmer" = "alloy",
  format: "wav" | "mp3" | "flac" | "opus" | "pcm16" = "wav"
): Promise<Buffer> {
  const response = await openai.chat.completions.create({
    model: "gpt-4o-audio-preview",
    modalities: ["text", "audio"],
    audio: { voice, format },
    messages: [
      { role: "system", content: "You are an assistant that performs text-to-speech." },
      { role: "user", content: `Repeat the following text verbatim: ${text}` },
    ],
  });
  const audioData = (response.choices[0]?.message as any)?.audio?.data ?? "";
  return Buffer.from(audioData, "base64");
}

/**
 * Streaming Text-to-Speech: Converts text to speech with real-time streaming.
 * Uses gpt-4o-audio-preview model via OpenAI API.
 * Note: Streaming only supports pcm16 output format.
 */
export async function textToSpeechStream(
  text: string,
  voice: "alloy" | "echo" | "fable" | "onyx" | "nova" | "shimmer" = "alloy"
): Promise<AsyncIterable<string>> {
  const stream = await openai.chat.completions.create({
    model: "gpt-4o-audio-preview",
    modalities: ["text", "audio"],
    audio: { voice, format: "pcm16" },
    messages: [
      { role: "system", content: "You are an assistant that performs text-to-speech." },
      { role: "user", content: `Repeat the following text verbatim: ${text}` },
    ],
    stream: true,
  });

  return (async function* () {
    for await (const chunk of stream) {
      const delta = chunk.choices?.[0]?.delta as any;
      if (!delta) continue;
      if (delta?.audio?.data) {
        yield delta.audio.data;
      }
    }
  })();
}

/**
 * Speech-to-Text: Transcribes audio using dedicated transcription model.
 * Uses whisper-1 for accurate transcription.
 */

/**
 * Sarvam AI Speech-to-Text — optimized for Indian languages
 * Supports Marathi (mr-IN), Hindi (hi-IN), and other Indian languages
 * Much better accuracy than Whisper for Indian languages
 */
async function transcribeWithSarvam(
  audioBuffer: Buffer,
  format: string,
  languageCode: string
): Promise<string> {
  const sarvamKey = process.env.SARVAM_API_KEY;
  if (!sarvamKey) throw new Error("SARVAM_API_KEY not set");

  // Sarvam free tier limit: 30 seconds per request
  // Split audio into 25-second chunks and transcribe each
  const inputPath = join(tmpdir(), `sarvam-input-${randomUUID()}.mp3`);
  const chunkDir = join(tmpdir(), `sarvam-chunks-${randomUUID()}`);

  try {
    await writeFile(inputPath, audioBuffer);

    // Get duration
    const duration = await new Promise<number>((resolve) => {
      const ffprobe = spawn("ffprobe", ["-v", "quiet", "-print_format", "json", "-show_format", inputPath]);
      let out = "";
      ffprobe.stdout.on("data", (d: Buffer) => out += d.toString());
      ffprobe.on("close", () => {
        try { resolve(parseFloat(JSON.parse(out).format?.duration || "0")); }
        catch { resolve(0); }
      });
    });

    // If under 25 seconds — send directly
    if (duration <= 25) {
      return await callSarvamAPI(audioBuffer, format, languageCode, sarvamKey);
    }

    // Split into 25-second chunks
    const { mkdir } = await import("fs/promises");
    await mkdir(chunkDir, { recursive: true });
    const chunkPattern = join(chunkDir, "chunk_%03d.mp3");

    await new Promise<void>((resolve, reject) => {
      const ffmpeg = spawn("ffmpeg", [
        "-i", inputPath,
        "-f", "segment",
        "-segment_time", "25",
        "-c:a", "libmp3lame",
        "-b:a", "128k",
        "-ar", "16000",
        "-ac", "1",
        "-reset_timestamps", "1",
        "-y", chunkPattern,
      ]);
      ffmpeg.stderr.on("data", () => {});
      ffmpeg.on("close", (code) => code === 0 ? resolve() : reject(new Error(`ffmpeg failed: ${code}`)));
      ffmpeg.on("error", reject);
    });

    const { readdirSync } = await import("fs");
    const chunkFiles = readdirSync(chunkDir)
      .filter(f => f.startsWith("chunk_") && f.endsWith(".mp3"))
      .sort()
      .map(f => join(chunkDir, f));

    console.log(`Sarvam: splitting ${Math.round(duration)}s audio into ${chunkFiles.length} chunks`);

    const transcripts: string[] = [];
    for (let i = 0; i < chunkFiles.length; i++) {
      const chunkBuffer = await readFile(chunkFiles[i]);
      console.log(`Sarvam chunk ${i+1}/${chunkFiles.length}...`);
      try {
        const chunkTranscript = await callSarvamAPI(chunkBuffer, "mp3", languageCode, sarvamKey);
        if (chunkTranscript.trim()) transcripts.push(chunkTranscript.trim());
      } catch (err: any) {
        console.error(`Sarvam chunk ${i+1} failed: ${err.message}`);
      }
      // Small delay to avoid rate limiting
      await new Promise(r => setTimeout(r, 300));
    }

    const merged = transcripts.join(" ");
    console.log(`Sarvam transcription complete: ${merged.length} chars from ${chunkFiles.length} chunks`);
    return merged;

  } finally {
    await unlink(inputPath).catch(() => {});
    try {
      const { readdirSync, unlinkSync, rmdirSync } = await import("fs") as any;
      const files = readdirSync(chunkDir);
      for (const f of files) unlinkSync(join(chunkDir, f));
      rmdirSync(chunkDir);
    } catch {}
  }
}

async function callSarvamAPI(
  audioBuffer: Buffer,
  format: string,
  languageCode: string,
  sarvamKey: string
): Promise<string> {
  const formData = new FormData();
  const blob = new Blob([audioBuffer], { type: `audio/${format}` });
  formData.append("file", blob, `audio.${format}`);
  formData.append("model", "saaras:v3");
  formData.append("language_code", languageCode);
  formData.append("with_diarization", "false");

  const response = await fetch("https://api.sarvam.ai/speech-to-text", {
    method: "POST",
    headers: { "api-subscription-key": sarvamKey },
    body: formData,
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Sarvam API error ${response.status}: ${err}`);
  }

  const result = await response.json() as any;
  const transcript = result.transcript || result.text || "";
  return transcript;
}

// Map Whisper language codes to Sarvam language codes
const SARVAM_LANGUAGE_MAP: Record<string, string> = {
  "mr": "mr-IN",   // Marathi
  "hi": "hi-IN",   // Hindi
  "gu": "gu-IN",   // Gujarati
  "ta": "ta-IN",   // Tamil
  "te": "te-IN",   // Telugu
  "kn": "kn-IN",   // Kannada
  "bn": "bn-IN",   // Bengali
  "pa": "pa-IN",   // Punjabi
  "ur": "ur-IN",   // Urdu
  "or": "od-IN",   // Odia
};


/**
 * Sarvam AI Speech-to-Text — optimized for Indian languages
 * Supports Marathi (mr-IN), Hindi (hi-IN), and other Indian languages
 * Much better accuracy than Whisper for Indian languages
 */

export async function speechToText(
  audioBuffer: Buffer,
  format: "wav" | "mp3" | "webm" = "wav",
  language?: string
): Promise<string> {
  // Route Indian languages to Sarvam AI for much better accuracy
  if (language && language !== "auto" && SARVAM_LANGUAGE_MAP[language]) {
    try {
      const sarvamLang = SARVAM_LANGUAGE_MAP[language];
      const transcript = await transcribeWithSarvam(audioBuffer, format, sarvamLang);
      if (transcript && transcript.trim().length > 0) {
        return removeRepetitions(transcript);
      }
      console.log("Sarvam returned empty — falling back to Whisper");
    } catch (err: any) {
      console.error(`Sarvam failed (${err.message}) — falling back to Whisper`);
    }
  }
  // Whisper — used for English and auto-detect
  const file = await toFile(audioBuffer, `audio.${format}`);
  const whisperParams: any = {
    file,
    model: "whisper-1",
    response_format: "verbose_json",
    temperature: 0,
  };
  if (language && language !== "auto") {
    whisperParams.language = language;
  }
  const response = await openai.audio.transcriptions.create(whisperParams);
  const result = response as any;
  let transcript = result.text || "";
  transcript = removeRepetitions(transcript);
  if (transcript) {
    console.log(`Whisper language: ${result.language || language || "auto"}, chars: ${transcript.length}`);
  }
  return transcript;
}

/**
 * Remove repeated phrases from Whisper output.
 * Whisper commonly hallucinates by repeating the same phrase dozens of times
 * especially for Marathi/Hindi audio with silence or low-quality sections.
 */
function removeRepetitions(text: string): string {
  if (!text) return text;

  // Step 1: Remove exact duplicate sentences
  const sentences = text.split(/[.?!]+/).map(l => l.trim()).filter(l => l.length > 3);
  const seen = new Set<string>();
  const deduped: string[] = [];
  for (const sentence of sentences) {
    const normalized = sentence.toLowerCase().replace(/\s+/g, " ").trim();
    if (!seen.has(normalized)) {
      seen.add(normalized);
      deduped.push(sentence);
    }
  }
  let result = deduped.join(" ");

  // Step 2: Remove any phrase (4+ words) repeated 2+ times consecutively
  result = result.replace(/(\S+(?:\s+\S+){3,})(?:\s+)+/g, "$1");

  // Step 3: Remove any phrase (3+ words) repeated 3+ times anywhere
  result = result.replace(/(\S+(?:\s+\S+){2,})(?:\s+){2,}/g, "$1");

  // Step 4: Truncate if still too long after dedup (likely hallucination)
  const words = result.split(/\s+/);
  if (words.length > 800) {
    // Find where repetition likely started by checking word density
    result = words.slice(0, 600).join(" ") + " [transcript truncated — audio may contain silence or noise at end]";
  }

  return result.trim();
}


/**
 * Streaming Speech-to-Text: Transcribes audio with real-time streaming.
 * Uses whisper-1 for accurate transcription.
 */

/**
 * Transcribe large audio files by splitting into chunks.
 * Supports unlimited file size — splits into 10-min segments, transcribes each, merges.
 * Uses ffprobe to get duration, ffmpeg to split into chunks.
 */
export async function transcribeLargeAudio(
  audioBuffer: Buffer,
  language?: string
): Promise<string> {
  const inputPath = join(tmpdir(), `input-${randomUUID()}.mp3`);
  const chunkDir = join(tmpdir(), `chunks-${randomUUID()}`);

  try {
    // Write input file
    await writeFile(inputPath, audioBuffer);

    // Get audio duration using ffprobe
    const duration = await new Promise<number>((resolve, reject) => {
      const ffprobe = spawn("ffprobe", [
        "-v", "quiet",
        "-print_format", "json",
        "-show_format",
        inputPath,
      ]);
      let output = "";
      ffprobe.stdout.on("data", (d: Buffer) => output += d.toString());
      ffprobe.on("close", (code) => {
        if (code !== 0) return reject(new Error("ffprobe failed"));
        try {
          const info = JSON.parse(output);
          resolve(parseFloat(info.format?.duration || "0"));
        } catch { reject(new Error("ffprobe parse failed")); }
      });
      ffprobe.on("error", reject);
    });

    console.log(`Audio duration: ${Math.round(duration)}s (${Math.round(duration/60)}min)`);

    // If under 10 minutes — transcribe directly without chunking
    if (duration <= 600) {
      const { buffer, format } = await ensureCompatibleFormat(audioBuffer);
      return await speechToText(buffer, format, language);
    }

    // Create chunk directory
    const { mkdir } = await import("fs/promises");
    await mkdir(chunkDir, { recursive: true });

    // Split into 10-minute chunks using ffmpeg segment
    const chunkPattern = join(chunkDir, "chunk_%03d.mp3");
    await new Promise<void>((resolve, reject) => {
      const ffmpeg = spawn("ffmpeg", [
        "-i", inputPath,
        "-f", "segment",
        "-segment_time", "600",       // 10 minutes per chunk
        "-c:a", "libmp3lame",
        "-b:a", "128k",
        "-ar", "16000",               // 16kHz for Whisper
        "-ac", "1",                   // Mono
        // No audio filters — keep original audio intact for best Whisper accuracy
        "-reset_timestamps", "1",
        "-y",
        chunkPattern,
      ]);
      ffmpeg.stderr.on("data", () => {});
      ffmpeg.on("close", (code) => {
        if (code === 0) resolve();
        else reject(new Error(`ffmpeg chunk split failed with code ${code}`));
      });
      ffmpeg.on("error", reject);
    });

    // Read all chunk files in order
    const { readdirSync } = await import("fs");
    const chunkFiles = readdirSync(chunkDir)
      .filter(f => f.startsWith("chunk_") && f.endsWith(".mp3"))
      .sort()
      .map(f => join(chunkDir, f));

    console.log(`Split into ${chunkFiles.length} chunks for transcription`);

    // Transcribe each chunk and merge
    const transcripts: string[] = [];
    for (let i = 0; i < chunkFiles.length; i++) {
      const chunkBuffer = await readFile(chunkFiles[i]);
      console.log(`Transcribing chunk ${i + 1}/${chunkFiles.length} (${Math.round(chunkBuffer.length / 1024)}KB)`);
      const chunkTranscript = await speechToText(chunkBuffer, "mp3", language);
      if (chunkTranscript.trim()) {
        transcripts.push(chunkTranscript.trim());
      }
      // Small delay between chunks to avoid rate limiting
      await new Promise(r => setTimeout(r, 500));
    }

    const merged = transcripts.join(" ");
    console.log(`Transcription complete: ${merged.length} chars from ${chunkFiles.length} chunks`);
    return merged;

  } finally {
    // Cleanup
    await unlink(inputPath).catch(() => {});
    try {
      const { readdirSync, unlinkSync, rmdirSync } = await import("fs") as any;
      const files = readdirSync(chunkDir);
      for (const f of files) unlinkSync(join(chunkDir, f));
      rmdirSync(chunkDir);
    } catch {}
  }
}

export async function speechToTextStream(
  audioBuffer: Buffer,
  format: "wav" | "mp3" | "webm" = "wav"
): Promise<AsyncIterable<string>> {
  const file = await toFile(audioBuffer, `audio.${format}`);
  const stream = await openai.audio.transcriptions.create({
    file,
    model: "whisper-1",
    stream: true,
  });

  return (async function* () {
    for await (const event of stream) {
      if (event.type === "transcript.text.delta") {
        yield event.delta;
      }
    }
  })();
}
