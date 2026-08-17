document.addEventListener('DOMContentLoaded',()=>{
  const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
  const btn=document.getElementById('recordBtn'),result=document.getElementById('speechResult'),status=document.getElementById('speechStatus');
  if(!SR||!btn)return;
  let recognition=null,busy=false;
  function start(){
    if(busy)return;
    recognition=new SR();
    recognition.lang='zh-CN';
    recognition.continuous=false;
    recognition.interimResults=true;
    recognition.maxAlternatives=3;
    let finalText='';
    recognition.onstart=()=>{busy=true;finalText='';result.textContent='';status.textContent='Đang nghe… hãy nói cả câu, không cần dừng giữa các từ';btn.classList.add('recording')};
    recognition.onresult=e=>{
      let live=finalText;
      for(let i=e.resultIndex;i<e.results.length;i++){
        const part=e.results[i][0]?.transcript||'';
        if(e.results[i].isFinal) finalText+=part; else live+=part;
      }
      result.textContent=(live||finalText).trim()||'—';
    };
    recognition.onerror=e=>{status.textContent=e.error==='no-speech'?'Không nghe thấy tiếng nói. Hãy thử lại.':'Lỗi nhận diện: '+e.error};
    recognition.onend=()=>{
      busy=false;btn.classList.remove('recording');
      result.textContent=finalText.trim()||result.textContent.trim()||'—';
      status.textContent=result.textContent!=='—'?'Đã nhận đủ câu. Bạn có thể nghe lại.':'Sẵn sàng luyện nói';
      if(result.textContent!=='—'&&typeof addPoints==='function')addPoints(5);
    };
    try{recognition.start()}catch(e){busy=false}
  }
  btn.onclick=start;
});
