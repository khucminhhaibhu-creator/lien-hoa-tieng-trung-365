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

    const contents = history.slice(-12).map(item => ({
      role: item.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: String(item.text || '') }]
    }));
    contents.push({ role: 'user', parts: [{ text: message }] });

    const systemInstruction = `Bạn là AI Giáo viên tiếng Trung của Liên Hoa Global Education.\n- Trả lời ưu tiên bằng tiếng Việt, kèm tiếng Trung giản thể khi hữu ích.\n- Dạy tiếng Trung giao tiếp thực tế, dễ hiểu.\n- Khi học viên viết câu tiếng Trung: sửa lỗi, đưa câu tự nhiên hơn, pinyin và nghĩa tiếng Việt nếu phù hợp.\n- Khi học viên viết tiếng Việt và muốn dịch: đưa bản dịch tiếng Trung tự nhiên, pinyin và giải thích ngắn.\n- Có thể đóng vai hội thoại theo tình huống và đặt câu hỏi tiếp theo.\n- Không nói rằng bạn là demo hay trả lời mẫu.\n- Giữ câu trả lời ngắn gọn, phù hợp người học.`;

    const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: systemInstruction }] },
        contents,
        generationConfig: { temperature: 0.7, maxOutputTokens: 700 }
      })
    });

    const data = await response.json();
    if (!response.ok) return res.status(response.status).json({ error: data?.error?.message || 'Gemini API lỗi.' });
    const text = data?.candidates?.[0]?.content?.parts?.map(p => p.text || '').join('') || 'AI chưa tạo được câu trả lời.';
    return res.status(200).json({ text });
  } catch (error) {
    return res.status(500).json({ error: 'Không kết nối được AI. Vui lòng thử lại.' });
  }
}
