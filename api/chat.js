export default async function handler(req, res) {
  const allowedOrigin = 'https://khucminhhaibhu-creator.github.io';
  res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
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
    const { message, history = [] } = req.body || {};
    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'Thiếu message.' });
    }

    const safeHistory = Array.isArray(history) ? history.slice(-12) : [];
    const contents = safeHistory
      .filter(item => item && item.text)
      .map(item => ({
        role: item.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: String(item.text) }]
      }));

    // Always end the request with the student's current question.
    contents.push({ role: 'user', parts: [{ text: message }] });

    const systemInstruction = `Bạn là AI Giáo viên tiếng Trung của Liên Hoa Global Education.
Bạn đang dạy tiếng Trung giao tiếp cho học viên Việt Nam.
Trả lời đầy đủ, tự nhiên, không dừng sau một hoặc hai từ.
Ưu tiên tiếng Việt, kèm tiếng Trung giản thể và pinyin khi hữu ích.
Nếu học viên viết tiếng Việt: dịch sang tiếng Trung tự nhiên, cho pinyin và giải thích ngắn.
Nếu học viên viết tiếng Trung: sửa câu, chỉ ra lỗi, đưa câu tự nhiên hơn, pinyin và nghĩa tiếng Việt.
Nếu học viên nói về tên, tuổi, công việc, gia đình hoặc đời sống: hiểu đúng ngữ cảnh và tiếp tục hội thoại.
Nếu đang luyện hội thoại: đóng vai người đối thoại và hỏi lại một câu phù hợp để học viên tiếp tục.
Không nói rằng bạn là demo. Không trả lời theo mẫu cố định nếu câu hỏi cần xử lý theo ngữ cảnh.
Hãy trình bày dễ đọc, phù hợp với người mới học tiếng Trung.`;

    // Gemini 3.6 Flash is the current stable production model.
    // The API key remains server-side in Vercel.
    const response = await fetch(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey
        },
        body: JSON.stringify({
          system_instruction: {
            parts: [{ text: systemInstruction }]
          },
          contents,
          generationConfig: {
            maxOutputTokens: 1200
          }
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      const apiError = data?.error?.message || 'Gemini API lỗi.';
      console.error('Gemini API:', response.status, apiError);
      return res.status(response.status).json({ error: apiError });
    }

    const text = data?.candidates?.[0]?.content?.parts
      ?.map(part => part.text || '')
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
