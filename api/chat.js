export default async function handler(req, res) {
  const origin = req.headers.origin || '';
  const allowedOrigins = new Set([
    'https://khucminhhaibhu-creator.github.io',
    'https://lien-hoa-tieng-trung-365.vercel.app'
  ]);

  if (allowedOrigins.has(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-cache, no-transform');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'Chưa cấu hình GEMINI_API_KEY trên Vercel.' });

  try {
    const body = req.body || {};
    const message = typeof body.message === 'string' ? body.message.trim() : '';
    const history = Array.isArray(body.history) ? body.history : [];
    if (!message) return res.status(400).json({ error: 'Thiếu message.' });

    // Keep the prompt small so every turn stays fast. The browser already stores
    // the full chat; the model only needs the latest few turns for normal teaching.
    const safeHistory = history
      .filter(item => item && typeof item.text === 'string' && item.text.trim())
      .slice(-6);

    const contents = [
      ...safeHistory.map(item => ({
        role: item.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: item.text.trim() }]
      })),
      { role: 'user', parts: [{ text: message }] }
    ];

    const systemInstruction = `Bạn là AI Giáo viên tiếng Trung của Liên Hoa Global Education.
Dạy tiếng Trung giao tiếp cho người Việt. Trả lời ngay, ngắn gọn nhưng đủ ý.
Nếu câu Việt: đưa tiếng Trung tự nhiên + pinyin + nghĩa/giải thích ngắn.
Nếu câu Trung: sửa lỗi + câu tự nhiên hơn + pinyin + nghĩa Việt.
Nếu học viên muốn học từ đầu: dạy từng bước và cho 1 câu luyện tập.
Nếu hội thoại: trả lời như người đối thoại và hỏi lại 1 câu.
Không dừng sau 1-2 từ. Không nói đây là demo.`;

    // Streaming makes the first words appear as soon as Gemini generates them.
    // Gemini 2.5 Flash is a stable low-latency model; thinkingBudget=0 avoids
    // unnecessary reasoning for this simple conversational teaching workload.
    const url = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:streamGenerateContent?alt=sse';
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey
      },
      body: JSON.stringify({
        contents,
        systemInstruction: { parts: [{ text: systemInstruction }] },
        generationConfig: {
          maxOutputTokens: 700,
          thinkingConfig: { thinkingBudget: 0 }
        }
      })
    });

    if (!response.ok || !response.body) {
      const raw = await response.text();
      let apiError = raw || 'Gemini API lỗi.';
      try { apiError = JSON.parse(raw)?.error?.message || apiError; } catch (_) {}
      console.error('Gemini stream:', response.status, apiError);
      return res.status(response.status || 502).json({ error: apiError });
    }

    res.statusCode = 200;
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    if (typeof res.flushHeaders === 'function') res.flushHeaders();

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    const send = (payload) => res.write(`data: ${JSON.stringify(payload)}\n\n`);

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const events = buffer.split('\n\n');
      buffer = events.pop() || '';

      for (const event of events) {
        const line = event.split('\n').find(x => x.startsWith('data:'));
        if (!line) continue;
        const raw = line.slice(5).trim();
        if (!raw || raw === '[DONE]') continue;
        try {
          const data = JSON.parse(raw);
          const text = data?.candidates?.[0]?.content?.parts
            ?.filter(part => typeof part?.text === 'string')
            .map(part => part.text)
            .join('') || '';
          if (text) send({ text });
        } catch (_) {
          // Ignore malformed/incomplete SSE frames; the next frame completes them.
        }
      }
    }

    res.write('data: {"done":true}\n\n');
    res.end();
  } catch (error) {
    console.error('Gemini backend error:', error);
    if (!res.headersSent) return res.status(500).json({ error: 'Không kết nối được AI. Vui lòng thử lại.' });
    try { res.write(`data: ${JSON.stringify({ error: 'Không kết nối được AI. Vui lòng thử lại.' })}\n\n`); } catch (_) {}
    try { res.end(); } catch (_) {}
  }
}
