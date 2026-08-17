const state={page:'home',points:Number(localStorage.getItem('lh_points')||0),learned:new Set(JSON.parse(localStorage.getItem('lh_learned')||'[]')),vocabIndex:0,chatHistory:JSON.parse(localStorage.getItem('lh_chat')||'[]')};
const pages={home:'Trang chủ',courses:'Lộ trình học',speak:'Luyện nói',chat:'AI Giáo viên',vocab:'Từ vựng',progress:'Tiến độ',admin:'Quản trị'};
const $=s=>document.querySelector(s);
function save(){localStorage.setItem('lh_points',state.points);localStorage.setItem('lh_learned',JSON.stringify([...state.learned]));localStorage.setItem('lh_chat',JSON.stringify(state.chatHistory.slice(-20)))}
function toast(t){const x=$('#toast');if(!x)return;x.textContent=t;x.classList.add('show');setTimeout(()=>x.classList.remove('show'),2200)}
function go(page){state.page=page;document.querySelectorAll('.page').forEach(x=>x.classList.toggle('active',x.id===page));document.querySelectorAll('.nav button').forEach(x=>x.classList.toggle('active',x.dataset.page===page));$('#pageTitle').textContent=pages[page];if(page==='vocab')renderVocab();if(page==='speak')renderFlash();if(page==='progress')renderProgress();if(page==='chat')restoreChat();$('#sidebar').classList.remove('open');window.scrollTo({top:0,behavior:'smooth'})}window.go=go;window.toast=toast;
function addPoints(n){state.points+=n;save();if($('#points'))$('#points').textContent=state.points.toLocaleString('vi-VN');toast(`+${n} điểm học tập`)}

// Chinese pronunciation: use the phone's native TTS first. If the mobile
// browser does not expose speechSynthesis/Chinese voices, automatically fall
// back to Gemini TTS through our secure Vercel backend.
let ttsAudio=null;
function getChineseVoice(){
  if(!('speechSynthesis' in window))return null;
  const voices=speechSynthesis.getVoices()||[];
  return voices.find(v=>/^(zh|cmn)(-|_|$)/i.test(v.lang)) || voices.find(v=>/chinese|mandarin|中文|普通话/i.test(v.name)) || null;
}
async function speakWithGemini(text){
  const r=await fetch('/api/tts',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text})});
  const data=await r.json().catch(()=>({}));
  if(!r.ok)throw new Error(data.error||`TTS server lỗi (${r.status})`);
  if(!data.audioBase64)throw new Error('Không nhận được dữ liệu âm thanh');
  if(ttsAudio){try{ttsAudio.pause()}catch(_){};ttsAudio=null}
  ttsAudio=new Audio(`data:${data.mimeType||'audio/wav'};base64,${data.audioBase64}`);
  ttsAudio.setAttribute('playsinline','true');
  await ttsAudio.play();
}
async function speak(text){
  if(!text||text==='—')return;
  try{
    const voice=getChineseVoice();
    if(voice){
      speechSynthesis.cancel();
      const u=new SpeechSynthesisUtterance(text);
      u.voice=voice;u.lang=voice.lang||'zh-CN';u.rate=.78;u.pitch=1;
      speechSynthesis.speak(u);
      return;
    }
    // Some Android/iOS browsers expose speechSynthesis but no Chinese voice.
    // In that case use the server-side Gemini TTS fallback.
    await speakWithGemini(text);
  }catch(e){
    try{await speakWithGemini(text)}catch(e2){toast('Không phát được âm thanh. Hãy kiểm tra âm lượng và thử lại.')} 
  }
}
window.speak=speak;
if('speechSynthesis'in window){speechSynthesis.onvoiceschanged=()=>{};setTimeout(()=>speechSynthesis.getVoices(),300)}

function renderFlash(){const w=window.ALL_VOCAB[state.vocabIndex%window.ALL_VOCAB.length];$('#flash').innerHTML=`<div class="word">${w.hanzi}</div><div class="pinyin">${w.pinyin}</div><div class="meaning">${w.meaning}</div><button class="mic" id="tts">🔊 Nghe phát âm</button><div style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap"><button class="btn soft" id="prevWord">← Trước</button><button class="btn green" id="knowWord">Tôi đã nhớ ✓</button><button class="btn soft" id="nextWord">Tiếp →</button></div><div class="notice" style="margin-top:15px">Chủ đề: ${w.topic} · HSK ${w.hsk}</div>`;$('#tts').onclick=()=>speak(w.hanzi);$('#nextWord').onclick=()=>{state.vocabIndex++;renderFlash()};$('#prevWord').onclick=()=>{state.vocabIndex=Math.max(0,state.vocabIndex-1);renderFlash()};$('#knowWord').onclick=()=>{state.learned.add(w.hanzi);addPoints(10);state.vocabIndex++;renderFlash();updateStats()}}
function updateStats(){const n=state.learned.size;if($('#wordsCount'))$('#wordsCount').textContent=n.toLocaleString('vi-VN')}
function renderVocab(){const q=($('#vocabSearch')?.value||'').trim().toLowerCase(),h=$('#hskFilter')?.value||'all',topic=$('#topicFilter')?.value||'all';const rows=window.ALL_VOCAB.filter(w=>(h==='all'||String(w.hsk)===h)&&(topic==='all'||w.topic===topic)&&(!q||`${w.hanzi} ${w.pinyin} ${w.meaning}`.toLowerCase().includes(q))).slice(0,500);$('#vocabBody').innerHTML=rows.map(w=>`<tr><td class="hanzi">${w.hanzi}</td><td>${w.pinyin}</td><td>${w.meaning}</td><td>HSK ${w.hsk}</td><td><button class="btn soft" onclick="speak('${w.hanzi}')">🔊</button><button class="btn green" onclick="learnWord('${w.hanzi}')">✓</button></td></tr>`).join('')||'<tr><td colspan="5">Không tìm thấy từ phù hợp.</td></tr>';$('#vocabCount').textContent=`Hiển thị ${rows.length} từ`}
window.learnWord=h=>{state.learned.add(h);addPoints(5);updateStats();renderVocab()};
function buildFilters(){const topics=[...new Set(window.ALL_VOCAB.map(w=>w.topic))];$('#topicFilter').innerHTML='<option value="all">Tất cả chủ đề</option>'+topics.map(t=>`<option value="${t}">${t}</option>`).join('')}
function newQuiz(){const base=window.ALL_VOCAB[Math.floor(Math.random()*window.ALL_VOCAB.length)],choices=[base,...window.ALL_VOCAB.filter(x=>x.hanzi!==base.hanzi).sort(()=>Math.random()-.5).slice(0,3)].sort(()=>Math.random()-.5);$('#quizWord').textContent=base.hanzi;$('#quizPinyin').textContent=base.pinyin;$('#quizOptions').innerHTML=choices.map(x=>`<button data-answer="${x.hanzi}">${x.meaning}</button>`).join('');document.querySelectorAll('#quizOptions button').forEach(b=>b.onclick=()=>{if(b.dataset.answer===base.hanzi){b.style.border='2px solid #28a66a';addPoints(15);toast('Chính xác!')}else{b.style.border='2px solid #d95b5b';toast('Chưa đúng, hãy thử lại')}setTimeout(newQuiz,650)})}
function renderProgress(){const total=window.ALL_VOCAB.length,learned=state.learned.size,pct=Math.min(100,Math.round(learned/total*100));$('#progressPct').textContent=pct+'%';$('#progressBar').style.width=pct+'%';$('#learnedTotal').textContent=learned;$('#totalWords').textContent=total;$('#pointsProgress').textContent=state.points.toLocaleString('vi-VN')}
const AI_API_URL='/api/chat';
function restoreChat(){const box=$('#messages');if(!box)return;box.innerHTML='';if(!state.chatHistory.length){addBubble('你好！我是莲花中文老师。 Tôi là AI Giáo viên tiếng Trung của Liên Hoa. Hãy nhập câu bất kỳ bằng tiếng Việt hoặc tiếng Trung.',false);return}state.chatHistory.slice(-20).forEach(m=>addBubble(m.text,m.role==='user'))}
async function sendChat(){
  const input=$('#chatInput'),text=input.value.trim();
  if(!text)return;
  addBubble(text,true);
  const previousHistory=state.chatHistory.slice(-6);
  state.chatHistory.push({role:'user',text});
  input.value='';
  const loading=addBubble('🤖 ',false);
  $('#chatSend').disabled=true;
  const started=performance.now();
  try{
    const r=await fetch(AI_API_URL,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({message:text,history:previousHistory,mode:'chinese-teacher'})});
    if(!r.ok){const data=await r.json().catch(()=>({}));throw new Error(data.error||`AI server lỗi (${r.status})`)}
    if(!r.body)throw new Error('Trình duyệt không hỗ trợ streaming');
    const reader=r.body.getReader(),decoder=new TextDecoder();
    let buffer='',reply='',firstToken=false,done=false;
    while(!done){
      const {value,done:readerDone}=await reader.read();
      if(readerDone)break;
      buffer+=decoder.decode(value,{stream:true});
      const events=buffer.split('\n\n');
      buffer=events.pop()||'';
      for(const event of events){
        const line=event.split('\n').find(x=>x.startsWith('data:'));
        if(!line)continue;
        const raw=line.slice(5).trim();
        if(!raw)continue;
        let data;try{data=JSON.parse(raw)}catch(_){continue}
        if(data.error)throw new Error(data.error);
        if(data.text){reply+=data.text;loading.textContent=reply;$('#messages').scrollTop=$('#messages').scrollHeight;if(!firstToken){firstToken=true;loading.dataset.firstTokenMs=Math.round(performance.now()-started)}}
        if(data.done)done=true;
      }
    }
    if(!reply)throw new Error('AI không trả về nội dung');
    state.chatHistory.push({role:'assistant',text:reply});save();
  }catch(e){loading.textContent='⚠️ Không kết nối được Gemini: '+e.message;state.chatHistory.push({role:'assistant',text:loading.textContent});save()}
  finally{$('#chatSend').disabled=false;input.focus()}
}
function addBubble(text,me){const b=document.createElement('div');b.className='bubble '+(me?'me':'bot');b.textContent=text;$('#messages').appendChild(b);$('#messages').scrollTop=$('#messages').scrollHeight;return b}
function setupSpeech(){const SR=window.SpeechRecognition||window.webkitSpeechRecognition;if(!SR){$('#speechStatus').textContent='Trình duyệt chưa hỗ trợ nhận diện giọng nói.';return}const r=new SR();r.lang='zh-CN';r.interimResults=true;r.continuous=false;r.onstart=()=>$('#speechStatus').textContent='Đang nghe… hãy nói trọn câu rồi dừng';r.onresult=e=>{let s='';for(let i=e.resultIndex;i<e.results.length;i++)s+=e.results[i][0].transcript;$('#speechResult').textContent=s};r.onerror=e=>$('#speechStatus').textContent='Lỗi nhận diện: '+e.error;r.onend=()=>{const s=$('#speechResult').textContent.trim();$('#speechStatus').textContent=s?'Đã nhận đủ câu.':'Sẵn sàng luyện nói';if(s)addPoints(5)};$('#recordBtn').onclick=()=>{try{r.start()}catch(e){r.stop()}}}
document.addEventListener('DOMContentLoaded',()=>{document.querySelectorAll('.nav button').forEach(b=>b.onclick=()=>go(b.dataset.page));$('#menuBtn').onclick=()=>$('#sidebar').classList.toggle('open');$('#chatSend').onclick=sendChat;$('#chatInput').addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();sendChat()}});$('#vocabSearch').oninput=renderVocab;$('#hskFilter').onchange=renderVocab;$('#topicFilter').onchange=renderVocab;buildFilters();updateStats();$('#points').textContent=state.points.toLocaleString('vi-VN');renderFlash();newQuiz();setupSpeech();renderProgress();restoreChat();go('home')});