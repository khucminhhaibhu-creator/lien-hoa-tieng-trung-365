export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'Chưa cấu hình GEMINI_API_KEY trên Vercel.' });

  try {
    const body = req.body || {};
    const text = typeof body.text === 'string' ? body.text.trim() : '';
    if (!text) return res.status(400).json({ error: 'Thiếu text.' });
    if (text.length > 500) return res.status(400).json({ error: 'Đoạn phát âm quá dài.' });

    // Use the stable Gemini 2.5 Flash TTS model through generateContent.
    // This is deliberately kept as the primary path because it returns the
    // PCM bytes in candidates[0].content.parts[].inlineData, which is easy
    // to convert into a browser-playable WAV file on both Android and iPhone.
    const url = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent';
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey
      },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: `Read the following Mandarin Chinese text naturally and clearly for a Vietnamese learner. Only read the Chinese text. Do not translate or add words. Text: ${text}`
          }]
        }],
        generationConfig: {
          responseModalities: ['AUDIO'],
          speechConfig: {
            languageCode: 'cmn-CN',
            voiceConfig: {
              prebuiltVoiceConfig: {
                voiceName: 'Kore'
              }
            }
          }
        }
      })
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const message = data?.error?.message || data?.message || 'Gemini TTS API lỗi.';
      console.error('Gemini TTS:', response.status, message);
      return res.status(response.status).json({ error: message });
    }

    // Gemini 2.5 TTS returns raw PCM in inlineData.data.
    const parts = data?.candidates?.[0]?.content?.parts || [];
    const audioPart = parts.find(p => p?.inlineData?.data);
    const pcmBase64 = audioPart?.inlineData?.data;
    const sourceMime = audioPart?.inlineData?.mimeType || 'audio/pcm';

    if (!pcmBase64) {
      console.error('Gemini TTS response did not contain inline audio:', JSON.stringify(data).slice(0, 2000));
      return res.status(502).json({ error: 'Gemini không trả về dữ liệu âm thanh. Vui lòng thử lại.' });
    }

    // Gemini TTS PCM is 24 kHz, mono, 16-bit. Wrap it in a WAV container so
    // HTMLAudioElement can play it reliably on Android Chrome and iOS Safari.
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

    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.status(200).json({
      audioBase64: wav.toString('base64'),
      mimeType: 'audio/wav',
      sourceMime
    });
  } catch (error) {
    console.error('TTS backend error:', error);
    return res.status(500).json({ error: 'Không tạo được âm thanh. Vui lòng thử lại.' });
  }
}
