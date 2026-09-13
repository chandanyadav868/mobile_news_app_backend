import os
# Clamp CPU threads to prevent concurrent processes from pegging 100% CPU on Windows
os.environ["OMP_NUM_THREADS"] = "2"
os.environ["ORT_NUM_THREADS"] = "2"
os.environ["OPENBLAS_NUM_THREADS"] = "2"
os.environ["MKL_NUM_THREADS"] = "2"

import sys
import re
import json
import base64
import io
import wave
import numpy as np

try:
    import sanotts
except ImportError:
    print(json.dumps({"success": False, "error": "sanotts is not installed in Python environment"}))
    sys.exit(1)

def is_hindi(text: str) -> bool:
    # Devanagari Unicode block \u0900-\u097F
    return bool(re.search(r'[\u0900-\u097F]', text))

def clean_speech_text(text: str) -> str:
    """Clean markdown, URLs, and typographic noise while preserving all words and sentence flow."""
    cleaned = re.sub(r'https?://\S+', '', text)
    cleaned = re.sub(r'[*_#`~>•■►]', ' ', cleaned)
    cleaned = re.sub(r'[\u2018\u2019]', "'", cleaned)
    cleaned = re.sub(r'[\u201C\u201D]', '"', cleaned)
    cleaned = re.sub(r'[\u2013\u2014]', ', ', cleaned)
    cleaned = re.sub(r'\s+', ' ', cleaned).strip()
    return cleaned

def split_sentences(text: str) -> list[str]:
    """Split text into natural sentences so the acoustic model synthesizes each with natural prosodic contour."""
    raw_sentences = re.split(r'(?<=[.!?;\n])\s+', text)
    sentences = []
    for s in raw_sentences:
        clean_s = s.strip()
        if clean_s:
            sentences.append(clean_s)
    return sentences if sentences else [text.strip()]

def main():
    if len(sys.argv) < 2:
        raw_input = sys.stdin.read()
        if not raw_input:
            print(json.dumps({"success": False, "error": "No input text provided"}))
            return
        data = json.loads(raw_input)
        text = data.get("text", "")
        voice = data.get("voice", "amy")
    else:
        text = sys.argv[1]
        voice = sys.argv[2] if len(sys.argv) > 2 else "amy"

    clean_text = clean_speech_text(text)
    if not clean_text:
        print(json.dumps({"success": False, "error": "Empty text"}))
        return

    # Check for Hindi or Devanagari script (SanoTTS only contains English acoustic models)
    if is_hindi(clean_text):
        print(json.dumps({
            "success": False,
            "error": "SanoTTS is optimized for English audio. For Hindi articles, please use the native Hindi neural voice (hi-IN-SwaraNeural).",
            "isLanguageMismatch": True,
            "detectedLang": "hi"
        }))
        return

    # Normalize voice name
    if "heart" in voice.lower():
        v = "heart"
    elif "kristin" in voice.lower():
        v = "kristin"
    else:
        v = "amy"

    sentences = split_sentences(clean_text)

    try:
        # Load Synthesizer ONCE to amortize weight loading and phonemizer init
        synth = sanotts.Synthesizer(v)
        sample_rate = synth.sample_rate

        all_audio_chunks = []
        words = []
        pause_samples = np.zeros(int(sample_rate * 0.08), dtype=np.float32) # 80ms natural breath pause between sentences

        for i, sentence in enumerate(sentences):
            # Synthesize with duration_length_scale=0.94 for smooth continuous cadence (eliminates word-by-word staccato)
            res = synth.synthesize(sentence, duration_length_scale=0.94)
            all_audio_chunks.append(res.audio)
            words.extend(sentence.split())
            if i < len(sentences) - 1:
                all_audio_chunks.append(pause_samples)

        combined_samples = np.concatenate(all_audio_chunks)
    except Exception as synth_err:
        print(json.dumps({"success": False, "error": f"SanoTTS engine error: {str(synth_err)}"}))
        return

    samples = np.clip(combined_samples, -1.0, 1.0)
    int_samples = (samples * 32767).astype(np.int16)

    buf = io.BytesIO()
    with wave.open(buf, 'wb') as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(sample_rate)
        wf.writeframes(int_samples.tobytes())

    audio_bytes = buf.getvalue()
    b64 = base64.b64encode(audio_bytes).decode('ascii')

    total_duration_ms = int((len(samples) / sample_rate) * 1000)
    ms_per_word = int(total_duration_ms / max(len(words), 1))
    elapsed = 0
    word_boundaries = []
    for w in words:
        word_boundaries.append({
            "word": w,
            "start": elapsed,
            "end": elapsed + ms_per_word
        })
        elapsed += ms_per_word

    print(json.dumps({
        "success": True,
        "voice": v,
        "sampleRate": sample_rate,
        "durationMs": total_duration_ms,
        "wordBoundaries": word_boundaries,
        "audioBase64": b64,
        "totalWords": len(words)
    }))

if __name__ == "__main__":
    main()
