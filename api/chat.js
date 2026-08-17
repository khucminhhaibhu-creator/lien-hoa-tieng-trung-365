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
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'Chưa cấu hình GEMINI_API_KEY trên Vercel.' });
  }

  try {
    const body = req.body || {};
    const message = typeof body.message === 'string' ? body.message.trim() : '';
    const history = Array.isArray(body.history) ? body.history : [];

    if (!message) {
      return res.status(400).json({ error: 'Thiếu message.' });
    }

    // Build a clean multi-turn transcript. The browser sends history without
    // the current message, so the current question is added exactly once.
    const safeHistory = history
      .filter(item => item && typeof item.text === 'string' && item.text.trim())
      .slice(-12);

    const transcript = safeHistory.length
      ? safeHistory.map(item => {
          const role = item.role === 'assistant' ? 'AI Giáo viên' : 'Học viên';
          return `${role}: ${item.text.trim()}`;
        }).join('\n') + `\nHọc viên: ${message}`
      : `Học viên: ${message}`;

    const systemInstruction = `Bạn là AI Giáo viên tiếng Trung của Liên Hoa Global Education.
Bạn đang dạy tiếng Trung giao tiếp cho học viên Việt Nam.
Trả lời đầy đủ, tự nhiên, không dừng sau một hoặc hai từ.
Ưu tiên tiếng Việt, kèm tiếng Trung giản thể và pinyin khi hữu ích.
Nếu học viên viết tiếng Việt: dịch sang tiếng Trung tự nhiên, cho pinyin và giải thích ngắn.
Nếu học viên viết tiếng Trung: sửa câu, chỉ ra lỗi, đưa câu tự nhiên hơn, pinyin và nghĩa tiếng Việt.
Nếu học viên nói về tên, tuổi, công việc, gia đình hoặc đời sống: hiểu đúng ngữ cảnh và tiếp tục hội thoại.
Nếu đang luyện hội thoại: đóng vai người đối thoại và hỏi lại một câu phù hợp để học viên tiếp tục.
Nếu học viên muốn bắt đầu học từ đầu, hãy chủ động dạy từng bước: câu mẫu, từ vựng, phát âm và một câu luyện tập.
Không nói rằng bạn là demo. Không trả lời theo mẫu cố định nếu câu hỏi cần xử lý theo ngữ cảnh.
Hãy trình bày dễ đọc, phù hợp với người mới học tiếng Trung.`;

    // Gemini 3.6 Flash is a current stable Gemini model. Google recommends
    // the Interactions API for new applications and it supports system
    // instructions plus multi-turn input.
    const response = await fetch(
      'https://generativelanguage.googleapis.com/v1beta/interactions',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey
        },
        body: JSON.stringify({
          model: 'gemini-3.6-flash',
          input: transcript,
          system_instruction: systemInstruction,
          store: false,
          generation_config: {
            max_output_tokens: 1200,
            thinking_level: 'low'
          }
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      const apiError = data?.error?.message || data?.message || 'Gemini API lỗi.';
      console.error('Gemini Interactions API:', response.status, apiError);
      return res.status(response.status).json({ error: apiError });
    }

    const text = (data?.steps || [])
      .filter(step => step?.type === 'model_output')
      .flatMap(step => Array.isArray(step.content) ? step.content : [])
      .filter(item => item?.type === 'text' && typeof item.text === 'string')
      .map(item => item.text)
      .join('')
      .trim();

    if (!text) {
      return res.status(502).json({ error: 'Gemini không trả về nội dung.' });
    }

    return res.status(200).json({ reply: text, text });
  } catch (error) {
    console.error('Gemini backend error:', error);
    return res.status(500).json({ error: 'Không kết nối được AI. Vui lòng thử lại.' });
  }
}
