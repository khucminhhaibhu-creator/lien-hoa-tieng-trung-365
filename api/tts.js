export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'Chưa cấu hình GEMINI_API_KEY trên Vercel.' });

  try {
    const body = req.body || {};
    const text = typeof body.text === 'string' ? body.text.trim() : '';
    if (!text) return res.status(400).json({ error: 'Thiếu text.' });
    if (text.length > 500) return res.status(400).json({ error: 'Đoạn phát âm quá dài.' });

    const response = await fetch('https://generativelanguage.googleapis.com/v1beta/interactions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey,
        'Api-Revision': '2026-05-20'
      },
      body: JSON.stringify({
        model: 'gemini-3.1-flash-tts-preview',
        input: `Read this Mandarin Chinese text naturally and clearly for a Vietnamese learner. Do not translate or add words: ${text}`,
        response_format: { type: 'audio' },
        generation_config: {
          speech_config: [{ voice: 'Kore' }]
        }
      })
    });

    const data = await response.json();
    if (!response.ok) {
      const message = data?.error?.message || data?.message || 'Gemini TTS API lỗi.';
      console.error('Gemini TTS:', response.status, message);
      return res.status(response.status).json({ error: message });
    }

    const pcmBase64 = data?.output_audio?.data;
    if (!pcmBase64) return res.status(502).json({ error: 'Gemini không trả về dữ liệu âm thanh.' });

    // Gemini TTS returns raw PCM. Wrap it as a browser-playable WAV file.
    const pcm = Buffer.from(pcmBase64, 'base64');
    const sampleRate = 24000;
    const channels = 1;
    const bitsPerSample = 16;
    const blockAlign = channels * bitsPerSample / 8;
    const byteRate = sampleRate * blockAlign;
    const wav = Buffer.alloc(44 + pcm.length);

    wav.write('RIFF', 0);
    wav.writeUInt32LE(36 + pcm.length, 4);
    wav.write('WAVE', 8);
    wav.write('fmt ', 12);
    wav.writeUInt32LE(16, 16);
    wav.writeUInt16LE(1, 20);
    wav.writeUInt16LE(channels, 22);
    wav.writeUInt32LE(sampleRate, 24);
    wav.writeUInt32LE(byteRate, 28);
    wav.writeUInt16LE(blockAlign, 32);
    wav.writeUInt16LE(bitsPerSample, 34);
    wav.write('data', 36);
    wav.writeUInt32LE(pcm.length, 40);
    pcm.copy(wav, 44);

    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({ audioBase64: wav.toString('base64'), mimeType: 'audio/wav' });
  } catch (error) {
    console.error('TTS backend error:', error);
    return res.status(500).json({ error: 'Không tạo được âm thanh. Vui lòng thử lại.' });
  }
}
