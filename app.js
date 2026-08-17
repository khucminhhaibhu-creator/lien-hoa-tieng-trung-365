const state={page:'home',points:Number(localStorage.getItem('lh_points')||0),learned:new Set(JSON.parse(localStorage.getItem('lh_learned')||'[]')),vocabIndex:0,chatHistory:JSON.parse(localStorage.getItem('lh_chat')||'[]')};
const pages={home:'Trang chủ',courses:'Lộ trình học',speak:'Luyện nói',chat:'AI Giáo viên',vocab:'Từ vựng',progress:'Tiến độ',admin:'Quản trị'};
const $=s=>document.querySelector(s);
function save(){localStorage.setItem('lh_points',state.points);localStorage.setItem('lh_learned',JSON.stringify([...state.learned]));localStorage.setItem('lh_chat',JSON.stringify(state.chatHistory.slice(-20)))}
function toast(t){const x=$('#toast');if(!x)return;x.textContent=t;x.classList.add('show');setTimeout(()=>x.classList.remove('show'),2600)}
function go(page){state.page=page;document.querySelectorAll('.page').forEach(x=>x.classList.toggle('active',x.id===page));document.querySelectorAll('.nav button').forEach(x=>x.classList.toggle('active',x.dataset.page===page));$('#pageTitle').textContent=pages[page];if(page==='vocab')renderVocab();if(page==='speak')renderFlash();if(page==='progress')renderProgress();if(page==='chat')restoreChat();$('#sidebar').classList.remove('open');window.scrollTo({top:0,behavior:'smooth'})}window.go=go;window.toast=toast;
function addPoints(n){state.points+=n;save();if($('#points'))$('#points').textContent=state.points.toLocaleString('vi-VN');toast(`+${n} điểm học tập`)}

// One-tap Chinese pronunciation that does NOT depend on a Chinese TTS voice
// being installed on the phone. The server asks Gemini TTS for Mandarin audio,
// then Web Audio plays the returned WAV. The AudioContext is created/resumed
// directly from the user's tap so Android/iPhone autoplay restrictions are
// respected. Audio is cached in memory, so repeated taps are instant.
let audioCtx=null;
let currentSource=null;
const audioCache=new Map();
async function speak(text,button){
  if(!text||text==='—')return;
  const original=button?.textContent||'🔊';
  try{
    // Create/resume the audio context synchronously from the tap.
    if(!audioCtx)audioCtx=new (window.AudioContext||window.webkitAudioContext)();
    if(audioCtx.state==='suspended')await audioCtx.resume();
    if(currentSource){try{currentSource.stop()}catch(_){}currentSource=null}
    if(button){button.disabled=true;button.classList.add('speaking');button.textContent='⏳'}

    let buffer=audioCache.get(text);
    if(!buffer){
      const r=await fetch('/api/tts',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text})});
      const data=await r.json().catch(()=>({}));
      if(!r.ok)throw new Error(data.error||`TTS server lỗi (${r.status})`);
      if(!data.audioBase64)throw new Error('Máy chủ không trả về âm thanh');
      const binary=atob(data.audioBase64);
      const bytes=new Uint8Array(binary.length);
      for(let i=0;i<binary.length;i++)bytes[i]=binary.charCodeAt(i);
      buffer=await audioCtx.decodeAudioData(bytes.buffer.slice(0));
      audioCache.set(text,buffer);
    }

    const source=audioCtx.createBufferSource();
    source.buffer=buffer;
    source.connect(audioCtx.destination);
    currentSource=source;
    source.onended=()=>{if(currentSource===source)currentSource=null;if(button){button.disabled=false;button.classList.remove('speaking');button.textContent=original}};
    source.start(0);
  }catch(e){
    if(button){button.disabled=false;button.classList.remove('speaking');button.textContent=original}
    toast(`Không phát được âm thanh: ${e.message}`);
  }
}
window.speak=speak;

function renderFlash(){const w=window.ALL_VOCAB[state.vocabIndex%window.ALL_VOCAB.length];$('#flash').innerHTML=`<div class="word">${w.hanzi}</div><div class="pinyin">${w.pinyin}</div><div class="meaning">${w.meaning}</div><button class="mic" id="tts" aria-label="Phát âm tiếng Trung" title="Bấm để nghe">🔊</button><div style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap"><button class="btn soft" id="prevWord">← Trước</button><button class="btn green" id="knowWord">Tôi đã nhớ ✓</button><button class="btn soft" id="nextWord">Tiếp →</button></div><div class="notice" style="margin-top:15px">Chủ đề: ${w.topic} · HSK ${w.hsk}</div>`;$('#tts').onclick=()=>speak(w.hanzi,$('#tts'));$('#nextWord').onclick=()=>{state.vocabIndex++;renderFlash()};$('#prevWord').onclick=()=>{state.vocabIndex=Math.max(0,state.vocabIndex-1);renderFlash()};$('#knowWord').onclick=()=>{state.learned.add(w.hanzi);addPoints(10);state.vocabIndex++;renderFlash();updateStats()}}
function updateStats(){const n=state.learned.size;if($('#wordsCount'))$('#wordsCount').textContent=n.toLocaleString('vi-VN')}
function renderVocab(){const q=($('#vocabSearch')?.value||'').trim().toLowerCase(),h=$('#hskFilter')?.value||'all',topic=$('#topicFilter')?.value||'all';const rows=window.ALL_VOCAB.filter(w=>(h==='all'||String(w.hsk)===h)&&(topic==='all'||w.topic===topic)&&(!q||`${w.hanzi} ${w.pinyin} ${w.meaning}`.toLowerCase().includes(q))).slice(0,500);$('#vocabBody').innerHTML=rows.map(w=>`<tr><td class="hanzi">${w.hanzi}</td><td>${w.pinyin}</td><td>${w.meaning}</td><td>HSK ${w.hsk}</td><td><button class="btn soft" aria-label="Phát âm ${w.hanzi}" title="Phát âm ${w.hanzi}" onclick="speak('${w.hanzi}',this)">🔊</button><button class="btn green" onclick="learnWord('${w.hanzi}')">✓</button></td></tr>`).join('')||'<tr><td colspan="5">Không tìm thấy từ phù hợp.</td></tr>';$('#vocabCount').textContent=`Hiển thị ${rows.length} từ`}
window.learnWord=h=>{state.learned.add(h);addPoints(5);updateStats();renderVocab()};
function buildFilters(){const topics=[...new Set(window.ALL_VOCAB.map(w=>w.topic))];$('#topicFilter').innerHTML='<option value="all">Tất cả chủ đề</option>'+topics.map(t=>`<option value="${t}">${t}</option>`).join('')}
function newQuiz(){const base=window.ALL_VOCAB[Math.floor(Math.random()*window.ALL_VOCAB.length)],choices=[base,...window.ALL_VOCAB.filter(x=>x.hanzi!==base.hanzi).sort(()=>Math.random()-.5).slice(0,3)].sort(()=>Math.random()-.5);$('#quizWord').textContent=base.hanzi;$('#quizPinyin').textContent=base.pinyin;$('#quizOptions').innerHTML=choices.map(x=>`<button data-answer="${x.hanzi}">${x.meaning}</button>`).join('');document.querySelectorAll('#quizOptions button').forEach(b=>b.onclick=()=>{if(b.dataset.answer===base.hanzi){b.style.border='2px solid #28a66a';addPoints(15);toast('Chính xác!')}else{b.style.border='2px solid #d95b5b';toast('Chưa đúng, hãy thử lại')}setTimeout(newQuiz,650)})}
function renderProgress(){const total=window.ALL_VOCAB.length,learned=state.learned.size,pct=Math.min(100,Math.round(learned/total*100));$('#progressPct').textContent=pct+'%';$('#progressBar').style.width=pct+'%';$('#learnedTotal').textContent=learned;$('#totalWords').textContent=total;$('#pointsProgress').textContent=state.points.toLocaleString('vi-VN')}
const AI_API_URL='/api/chat';
function restoreChat(){const box=$('#messages');if(!box)return;box.innerHTML='';if(!state.chatHistory.length){addBubble('你好！我是莲花中文老师。 Tôi là AI Giáo viên tiếng Trung của Liên Hoa. Hãy nhập câu bất kỳ bằng tiếng Việt hoặc tiếng Trung.',false);return}state.chatHistory.slice(-20).forEach(m=>addBubble(m.text,m.role==='user'))}
async function sendChat(){const input=$('#chatInput'),text=input.value.trim();if(!text)return;addBubble(text,true);const previousHistory=state.chatHistory.slice(-6);state.chatHistory.push({role:'user',text});input.value='';const loading=addBubble('🤖 ',false);$('#chatSend').disabled=true;try{const r=await fetch(AI_API_URL,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({message:text,history:previousHistory,mode:'chinese-teacher'})});if(!r.ok){const data=await r.json().catch(()=>({}));throw new Error(data.error||`AI server lỗi (${r.status})`)}const data=await r.json();const reply=data.reply||data.text;if(!reply)throw new Error('AI không trả về nội dung');loading.textContent=reply;state.chatHistory.push({role:'assistant',text:reply});save()}catch(e){loading.textContent='⚠️ Không kết nối được Gemini: '+e.message;state.chatHistory.push({role:'assistant',text:loading.textContent});save()}finally{$('#chatSend').disabled=false;input.focus()}}
function addBubble(text,me){const b=document.createElement('div');b.className='bubble '+(me?'me':'bot');b.textContent=text;$('#messages').appendChild(b);$('#messages').scrollTop=$('#messages').scrollHeight;return b}
function setupSpeech(){const SR=window.SpeechRecognition||window.webkitSpeechRecognition;if(!SR){$('#speechStatus').textContent='Trình duyệt chưa hỗ trợ nhận diện giọng nói.';return}const r=new SR();r.lang='zh-CN';r.interimResults=true;r.continuous=false;r.onstart=()=>$('#speechStatus').textContent='Đang nghe… hãy nói trọn câu rồi dừng';r.onresult=e=>{let s='';for(let i=e.resultIndex;i<e.results.length;i++)s+=e.results[i][0].transcript;$('#speechResult').textContent=s};r.onerror=e=>$('#speechStatus').textContent='Lỗi nhận diện: '+e.error;r.onend=()=>{const s=$('#speechResult').textContent.trim();$('#speechStatus').textContent=s?'Đã nhận đủ câu.':'Sẵn sàng luyện nói';if(s)addPoints(5)};$('#recordBtn').onclick=()=>{try{r.start()}catch(e){r.stop()}}}
document.addEventListener('DOMContentLoaded',()=>{document.querySelectorAll('.nav button').forEach(b=>b.onclick=()=>go(b.dataset.page));$('#menuBtn').onclick=()=>$('#sidebar').classList.toggle('open');$('#chatSend').onclick=sendChat;$('#chatInput').addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();sendChat()}});$('#vocabSearch').oninput=renderVocab;$('#hskFilter').onchange=renderVocab;$('#topicFilter').onchange=renderVocab;buildFilters();updateStats();$('#points').textContent=state.points.toLocaleString('vi-VN');renderFlash();newQuiz();setupSpeech();renderProgress();restoreChat();go('home')});