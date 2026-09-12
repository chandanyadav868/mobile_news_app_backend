import sys
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

    clean_text = text.strip()
    if not clean_text:
        print(json.dumps({"success": False, "error": "Empty text"}))
        return

    # Normalize voice name
    if "heart" in voice.lower():
        v = "heart"
    elif "kristin" in voice.lower():
        v = "kristin"
    else:
        v = "amy"

    res = sanotts.synthesize(clean_text, voice=v)
    samples = np.clip(res.audio, -1.0, 1.0)
    int_samples = (samples * 32767).astype(np.int16)

    buf = io.BytesIO()
    with wave.open(buf, 'wb') as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(res.sample_rate)
        wf.writeframes(int_samples.tobytes())

    audio_bytes = buf.getvalue()
    b64 = base64.b64encode(audio_bytes).decode('ascii')

    words = clean_text.split()
    ms_per_word = 260
    elapsed = 0
    word_boundaries = []
    for w in words:
        word_boundaries.append({
            "word": w,
            "start": elapsed,
            "end": elapsed + ms_per_word
        })
        elapsed += ms_per_word

    total_duration_ms = max(int((len(samples) / res.sample_rate) * 1000), elapsed)

    print(json.dumps({
        "success": True,
        "voice": v,
        "sampleRate": res.sample_rate,
        "durationMs": total_duration_ms,
        "wordBoundaries": word_boundaries,
        "audioBase64": b64
    }))

if __name__ == "__main__":
    main()
