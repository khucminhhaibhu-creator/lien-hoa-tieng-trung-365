/* Liên Hoa 365 — real AI client. The API key is NEVER stored in this file. */
(() => {
  const DEFAULT_API_URL = localStorage.getItem('lienhoa_ai_api_url') || '';
  let apiUrl = DEFAULT_API_URL;
  const history = [];

  function addMessage(text, cls) {
    const box = document.getElementById('messages');
    if (!box) return;
    const div = document.createElement('div');
    div.className = 'bubble ' + cls;
    div.textContent = text;
    box.appendChild(div);
    box.scrollTop = box.scrollHeight;
    return div;
  }

  async function realSendChat() {
    const input = document.getElementById('chatInput');
    if (!input) return;
    const text = input.value.trim();
    if (!text) return;

    if (!apiUrl) {
      const entered = prompt('Nhập URL AI backend của Liên Hoa (ví dụ: https://ten-app.vercel.app/api/chat):');
      if (!entered) return;
      apiUrl = entered.trim().replace(/\/$/, '');
      localStorage.setItem('lienhoa_ai_api_url', apiUrl);
    }

    addMessage(text, 'me');
    input.value = '';
    const loading = addMessage('🤖 AI đang suy nghĩ…', 'bot');

    try {
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, history })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'AI backend lỗi');
      loading.textContent = data.text || 'AI chưa có câu trả lời.';
      history.push({ role: 'user', text }, { role: 'assistant', text: data.text || '' });
      if (typeof addPoints === 'function') addPoints(5);
    } catch (err) {
      loading.textContent = '⚠️ ' + (err.message || 'Không kết nối được AI.');
    }
  }

  window.sendChat = realSendChat;
  const send = document.getElementById('sendBtn');
  const input = document.getElementById('chatInput');
  if (send) send.onclick = realSendChat;
  if (input) input.onkeydown = e => { if (e.key === 'Enter') realSendChat(); };
})();
