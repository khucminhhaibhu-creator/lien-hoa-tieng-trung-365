export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', 'https://khucminhhaibhu-creator.github.io');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'Chưa cấu hình GEMINI_API_KEY trên máy chủ.' });

  try {
    const { message, history = [] } = req.body || {};
    if (!message || typeof message !== 'string') return res.status(400).json({ error: 'Thiếu message.' });

    const safeHistory = Array.isArray(history) ? history.slice(-12) : [];
    const contents = safeHistory
      .filter(item => item && item.text)
      .map(item => ({
        role: item.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: String(item.text) }]
      }));

    contents.push({ role: 'user', parts: [{ text: message }] });

    const systemInstruction = `Bạn là AI Giáo viên tiếng Trung của Liên Hoa Global Education.
Trả lời đầy đủ câu hỏi của học viên, không cắt giữa chừng và không giới hạn câu trả lời ở hai từ.
Ưu tiên tiếng Việt, kèm tiếng Trung giản thể và pinyin khi hữu ích.
Nếu học viên viết tiếng Việt: dịch sang tiếng Trung tự nhiên, cho pinyin và giải thích ngắn.
Nếu học viên viết tiếng Trung: sửa câu, chỉ ra lỗi, đưa câu tự nhiên hơn, pinyin và nghĩa tiếng Việt.
Nếu học viên nói về tuổi, tên, công việc, gia đình hoặc đời sống: trả lời đúng ngữ cảnh và tiếp tục hội thoại.
Nếu đang luyện hội thoại: đóng vai người đối thoại, hỏi lại một câu phù hợp để học viên tiếp tục.
Không trả lời kiểu mẫu cố định, không nói rằng bạn là demo.
Mỗi câu trả lời nên có đủ thông tin cần thiết nhưng dễ đọc đối với người Việt học tiếng Trung.`;

    // Gemini 2.5 Flash is the stable price/performance model and is broadly available.
    // Keep the API key server-side in Vercel; never expose it to GitHub Pages.
    const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey
      },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: systemInstruction }] },
        contents,
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 1200
        }
      })
    });

    const data = await response.json();
    if (!response.ok) {
      const message = data?.error?.message || 'Gemini API lỗi.';
      return res.status(response.status).json({ error: message });
    }

    const text = data?.candidates?.[0]?.content?.parts
      ?.map(part => part.text || '')
      .join('')
      .trim();

    return res.status(200).json({
      reply: text || 'AI chưa tạo được câu trả lời. Vui lòng thử lại.',
      text: text || 'AI chưa tạo được câu trả lời. Vui lòng thử lại.'
    });
  } catch (error) {
    console.error('Gemini backend error:', error);
    return res.status(500).json({ error: 'Không kết nối được AI. Vui lòng thử lại.' });
  }
}
