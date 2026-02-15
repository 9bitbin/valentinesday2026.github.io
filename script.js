// script.js — core interactivity: starfield, lock screen validation (hashed), carousel, audio controls
// Use modern APIs (Web Crypto, requestAnimationFrame). Keep code modular and commented.

(async function(){
  // ---- Utilities ----
  async function sha256(text){
    const enc = new TextEncoder();
    const data = enc.encode(text);
    const hash = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(hash)).map(b=>b.toString(16).padStart(2,'0')).join('');
  }

  // ---- Starfield Canvas ----
  const canvas = document.getElementById('starfield');
  const ctx = canvas && canvas.getContext('2d');
  let stars = [];
  function resize(){
    if(!canvas) return; canvas.width = innerWidth; canvas.height = innerHeight;
  }
  function initStars(){
    stars = [];
    const count = Math.round((canvas.width*canvas.height)/80000);
    for(let i=0;i<count;i++){
      stars.push({x:Math.random()*canvas.width,y:Math.random()*canvas.height,z:Math.random()*1,rad:Math.random()*1.2+0.2,dx:(Math.random()-0.5)*0.02});
    }
  }
  function drawStars(){
    if(!ctx) return; ctx.clearRect(0,0,canvas.width,canvas.height);
    ctx.fillStyle = 'rgba(6,6,12,0.4)'; ctx.fillRect(0,0,canvas.width,canvas.height);
    for(const s of stars){
      s.x += s.dx; if(s.x<0) s.x=canvas.width; if(s.x>canvas.width) s.x=0;
      const g = ctx.createRadialGradient(s.x,s.y,0,s.x,s.y,s.rad*4);
      g.addColorStop(0,'rgba(255,255,255,'+(0.8*s.z)+')'); g.addColorStop(1,'rgba(255,255,255,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(s.x,s.y,s.rad,0,Math.PI*2); ctx.fill();
    }
  }
  function animateStars(){ drawStars(); requestAnimationFrame(animateStars); }
  window.addEventListener('resize',()=>{ resize(); initStars(); });

  // ---- Floating hearts (subtle) ----
  function spawnHeart(){
    const container = document.getElementById('hearts'); if(!container) return;
    const h = document.createElement('div'); h.className='heart';
    h.style.left = Math.random()*100+'%'; h.style.top = (50+Math.random()*30)+'%'; h.style.opacity = (0.3+Math.random()*0.7);
    container.appendChild(h);
    const life = 6000+Math.random()*6000; const start = performance.now();
    function step(t){
      const p = (t-start)/life; h.style.transform = `translateY(${ -p*200 }px) scale(${1-p*0.4}) rotate(${p*30}deg)`;
      if(p<1) requestAnimationFrame(step); else h.remove();
    }
    requestAnimationFrame(step);
  }

  // ---- Lock-screen validation (hash compare) ----
  const form = document.getElementById('unlockForm');
  const lockScreen = document.getElementById('lockScreen');
  const main = document.getElementById('main');
  const sinceDateEl = document.getElementById('sinceDate');

  // Precomputed SHA-256 hashes for correct answers (keep values hidden):
  // You may provide plaintext answers below; they will be hashed at runtime.
  let answersHash = {
    date: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', // empty placeholder
    color: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    place: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'
  };

  // --- Provide any plaintext answers you want to set here ---
  // The value for `color` below comes from your message: "blue"
  const answersPlain = {
    date: '6/22/22',
    color: 'Purple',
    place: 'Penn Station'
  };

  // Hash any provided plaintext answers and store into answersHash
  for (const k of Object.keys(answersPlain)) {
    const val = answersPlain[k];
    if (val === null || val === undefined) continue;
    if (k === 'date') {
      // Accept multiple date formats: try to parse and generate common variants
      const raw = String(val).trim();
      const candidates = new Set();
      candidates.add(raw);
      // also try replace '-'/' ' variants
      candidates.add(raw.replace(/-/g,'/'));
      try {
        const dt = new Date(raw);
        if (!isNaN(dt)) {
          const yyyy = dt.getFullYear();
          const mm = String(dt.getMonth()+1).padStart(2,'0');
          const dd = String(dt.getDate()).padStart(2,'0');
          candidates.add(`${yyyy}-${mm}-${dd}`); // ISO
          candidates.add(`${mm}/${dd}/${String(yyyy).slice(-2)}`); // m/d/yy
          candidates.add(`${mm}/${dd}/${yyyy}`); // mm/dd/yyyy
        }
      } catch(e){}
      // compute hashes for all candidates
      answersHash.date = Array.from(candidates).map(s=>sha256(String(s).trim())).map(p=>p);
      // resolve promises to actual hashes
      answersHash.date = await Promise.all(answersHash.date);
    } else {
      // text answers normalized to lowercase
      answersHash[k] = await sha256(String(val).trim().toLowerCase());
      // store as array for uniformity
      answersHash[k] = [answersHash[k]];
    }
  }

  async function verifyAnswers(date,color,place){
    const d = await sha256(String(date||'').trim());
    const c = await sha256(String(color||'').trim().toLowerCase());
    const p = await sha256(String(place||'').trim().toLowerCase());
    const okDate = Array.isArray(answersHash.date) ? answersHash.date.includes(d) : answersHash.date === d;
    const okColor = Array.isArray(answersHash.color) ? answersHash.color.includes(c) : answersHash.color === c;
    const okPlace = Array.isArray(answersHash.place) ? answersHash.place.includes(p) : answersHash.place === p;
    return okDate && okColor && okPlace;
  }

  // If you want to quickly demo, allow demo button to bypass
  document.getElementById('demoBtn').addEventListener('click', unlockEntry);

  form.addEventListener('submit', async function(e){
    e.preventDefault();
    const date = document.getElementById('q-date').value;
    const color = document.getElementById('q-color').value;
    const place = document.getElementById('q-place').value;
    const ok = await verifyAnswers(date||'', color||'', place||'');
    const unlockBtn = document.getElementById('unlockBtn');
    if(ok){
      unlockBtn.textContent='Unlocked ✓';
      unlockAnimation().then(unlockEntry);
    } else {
      // shake
      lockScreen.animate([{transform:'translate(-50%,-50%)'},{transform:'translate(calc(-50% -8px),-50%)'},{transform:'translate(calc(-50% +8px),-50%)'},{transform:'translate(-50%,-50%)'}],{duration:600});
    }
  });

  // Unlock animation sequence (simple dissolve)
  function unlockAnimation(){
    return new Promise(res=>{
      gsap.to(lockScreen,{duration:0.9,opacity:0,scale:1.06,ease:'power2.inOut',onComplete:res});
      for(let i=0;i<24;i++) setTimeout(spawnHeart, i*120);
    });
  }
  function unlockEntry(){
    lockScreen.style.display='none'; main.classList.remove('hidden');
    // set since date from first slide metadata
    const first = document.querySelector('.slide'); if(first) sinceDateEl.textContent = first.dataset.date || '—';
    // ensure carousel auto-advances when user unlocks
    startAuto();
    // auto-start music on unlock (user gesture from Unlock/Demo click allows autoplay)
    music.play().then(()=> updatePlay()).catch(()=> {});
  }

  // ---- Carousel core ----
  const carousel = document.getElementById('carousel');
  let slides = [];
  let idx = 0;
  let autoTimer = null;
  function loadSlideImage(i){
    const s = slides[i]; if(!s) return; const img = s.querySelector('img'); if(img && img.dataset.src && !img.src){ img.src = img.dataset.src; }
  }

  function setupCarousel(){
    slides = Array.from(document.querySelectorAll('.slide'));
    slides.forEach((s,i)=>{
      // initial transform
      const offset = i-idx; applyTransform(s, offset);
    });
    // lazy load current and neighbors
    loadSlideImage(idx); loadSlideImage(idx+1); loadSlideImage(idx-1);
    createDots(); startAuto();
  }
  function applyTransform(el, offset){
    const abs = Math.abs(offset);
    const z = 100 - abs*40; const scale = Math.max(0.86, 1 - abs*0.06);
    el.style.zIndex = 100 - abs;
    el.style.transform = `translateX(${offset*55}%) translateZ(${z}px) scale(${scale}) rotateY(${offset*-8}deg)`;
    el.style.opacity = abs>2?0:1;
  }
  function goto(i){ idx = (i+slides.length)%slides.length; slides.forEach((s,j)=>applyTransform(s,j-idx));
    // lazy load neighbor images when navigating
    loadSlideImage(idx); loadSlideImage(idx+1); loadSlideImage(idx-1);
    updateDots(); }
  function next(){ goto(idx+1); }
  function prev(){ goto(idx-1); }
  function startAuto(){ stopAuto(); autoTimer = setInterval(next,5000); }
  function stopAuto(){ if(autoTimer) clearInterval(autoTimer); autoTimer=null; }

  // nav buttons
  document.querySelectorAll('.nav.left').forEach(b=>b.addEventListener('click', ()=>{ prev(); resetAuto(); }));
  document.querySelectorAll('.nav.right').forEach(b=>b.addEventListener('click', ()=>{ next(); resetAuto(); }));
  function resetAuto(){ stopAuto(); setTimeout(startAuto,6000); }

  // dots
  function createDots(){ const dots = document.getElementById('dots'); dots.innerHTML=''; slides.forEach((s,i)=>{ const b=document.createElement('button'); b.addEventListener('click', ()=>{ goto(i); resetAuto(); }); dots.appendChild(b); }); updateDots(); }
  function updateDots(){ const buttons = document.querySelectorAll('#dots button'); buttons.forEach((b,i)=>b.classList.toggle('active', i===idx)); }

  // swipe support
  let startX=0, deltaX=0; carousel.addEventListener('touchstart',e=>{ stopAuto(); startX=e.touches[0].clientX; });
  carousel.addEventListener('touchmove',e=>{ deltaX=e.touches[0].clientX - startX; });
  carousel.addEventListener('touchend',e=>{ if(Math.abs(deltaX)>40){ if(deltaX<0) next(); else prev(); } deltaX=0; startAuto(); });

  // pause on hover
  carousel.addEventListener('mouseenter', stopAuto); carousel.addEventListener('mouseleave', startAuto);

  // ---- Audio controls & visitor counter ----
  const audio = document.getElementById('bgMusic');
  // create audio element dynamically to avoid autoplay before interaction
  const music = document.createElement('audio'); music.id='bgMusic'; music.loop=true; const src = document.createElement('source'); src.src='song.mp3'; src.type='audio/mpeg'; music.appendChild(src); document.body.appendChild(music);

  const playBtn = document.getElementById('playPause'); const vol = document.getElementById('volumeSlider'); const title = document.getElementById('songTitle');
  playBtn.addEventListener('click', ()=>{ if(music.paused) music.play(); else music.pause(); updatePlay(); });
  vol.addEventListener('input', ()=>{ music.volume = vol.value/100; });

  // GSAP tween for rotating CD — start paused and play/resume when audio plays
  let cdTween = null;
  try{
    cdTween = gsap.to('.cd',{rotation:360,duration:6,repeat:-1,ease:'none',paused:true});
  }catch(e){ cdTween = null; }

  function updatePlay(){
    playBtn.textContent = music.paused? 'Play' : 'Pause';
    if(cdTween){ if(music.paused) cdTween.pause(); else cdTween.play(); }
    else { document.querySelector('.cd').style.transform = music.paused? 'rotate(0deg)' : 'rotate(360deg)'; }
  }
  music.addEventListener('play', updatePlay); music.addEventListener('pause', updatePlay);

  // Keyboard shortcuts: Space toggles play/pause (when not typing), arrows navigate carousel, M toggles mute
  document.addEventListener('keydown', (ev)=>{
    const tag = (document.activeElement && document.activeElement.tagName) || '';
    if(tag === 'INPUT' || tag === 'TEXTAREA') return; // don't hijack typing
    if(ev.code === 'Space' || ev.key === ' '){ ev.preventDefault(); if(music.paused) music.play(); else music.pause(); updatePlay(); }
    if(ev.code === 'ArrowRight') { ev.preventDefault(); next(); resetAuto(); }
    if(ev.code === 'ArrowLeft') { ev.preventDefault(); prev(); resetAuto(); }
    if(ev.key && ev.key.toLowerCase() === 'm'){ music.muted = !music.muted; vol.value = music.muted ? 0 : Math.round(music.volume*100); }
  });

  // visitor counter (simple localStorage increment)
  const vc = document.getElementById('visitorCount'); const key='vcount'; const cur = Number(localStorage.getItem(key)||0)+1; localStorage.setItem(key,cur); vc.textContent = cur;

  // countdown to next Valentine's Day
  function updateCountdown(){ const now=new Date(); let year=now.getFullYear(); const vDay=new Date(`${year}-02-14T00:00:00`); if(vDay<=now) vDay.setFullYear(year+1); const diff=(vDay-now); const d=Math.floor(diff/86400000); const h=Math.floor((diff%86400000)/3600000); const m=Math.floor((diff%3600000)/60000); document.getElementById('countdown').textContent = `${d}d ${h}h ${m}m`; }

  // ---- Timeline & Polaroid section ----
  const timelineData = [
    {date:'2006-02-14', title:'We met', text:'That unforgettable first meeting.'},
    {date:'2006-03-01', title:'First Kiss', text:'Under the streetlight.'},
    {date:'2007-06-21', title:'Roadtrip', text:'Windows down, music up.'},
    {date:'2010-12-24', title:'Snowy Dinner', text:'Cozy and bright.'}
  ];

  function renderTimeline(){
    const list = document.getElementById('timelineList'); if(!list) return; list.innerHTML='';
    timelineData.forEach(ev=>{
      const li = document.createElement('li');
      li.innerHTML = `<div class="date">${ev.date}</div><div class="title">${ev.title}</div><div class="desc">${ev.text}</div>`;
      list.appendChild(li);
    });
  }

  function createPolaroids(){
    const container = document.getElementById('polaroids'); if(!container) return; container.innerHTML='';
    const images = [
      {src:'photo1.jpg',label:'First Kiss'},
      {src:'photo2.jpg',label:'Roadtrip'},
      {src:'photo3.jpg',label:'Concert'},
      {src:'photo4.jpg',label:'Snow Dinner'},
      {src:'photo5.jpg',label:'City Lights'}
    ];
    const w = container.clientWidth || window.innerWidth;
    const h = 260;
    images.forEach((it,i)=>{
      const p = document.createElement('div'); p.className='polaroid';
      const left = Math.random()*(w-160); const top = Math.random()*(h-120);
      const rot = (Math.random()*30)-15;
      p.style.left = left+'px'; p.style.top = top+'px'; p.style.transform = `rotate(${rot}deg)`;
      p.innerHTML = `<img data-src="${it.src}" alt="${it.label}"><div class="label">${it.label}</div>`;
      p.addEventListener('click', ()=>{ openModal(it.label, `<img src="${it.src}" style="max-width:90%;height:auto;border-radius:8px">`); });
      container.appendChild(p);
    });
    // lazy load polaroid images
    document.querySelectorAll('.polaroid img').forEach(img=>{ if(img.dataset.src) img.src = img.dataset.src; });
  }

  // Modal helpers
  const modal = document.getElementById('modal'); const modalClose = document.getElementById('modalClose');
  function openModal(title, html){ if(!modal) return; modal.classList.remove('hidden'); modal.setAttribute('aria-hidden','false'); document.getElementById('modalTitle').textContent = title; document.getElementById('modalContent').innerHTML = html; }
  function closeModal(){ if(!modal) return; modal.classList.add('hidden'); modal.setAttribute('aria-hidden','true'); }
  if(modalClose) modalClose.addEventListener('click', closeModal);
  modal && modal.addEventListener('click', (e)=>{ if(e.target===modal) closeModal(); });

  // ---- Photo Upload Feature ----
  const uploadModal = document.getElementById('uploadModal');
  const uploadModalClose = document.getElementById('uploadModalClose');
  const addPhotoBtn = document.getElementById('addPhotoBtn');
  const uploadForm = document.getElementById('uploadForm');
  const uploadPasswordInput = document.getElementById('uploadPassword');
  const uploadFileInput = document.getElementById('uploadFile');
  const uploadCaptionInput = document.getElementById('uploadCaption');

  // Upload password (simple hash for protection)
  const uploadPassword = 'love2026'; // Change this to your desired password

  function openUploadModal(){ if(!uploadModal) return; uploadModal.classList.remove('hidden'); uploadModal.setAttribute('aria-hidden','false'); }
  function closeUploadModal(){ if(!uploadModal) return; uploadModal.classList.add('hidden'); uploadModal.setAttribute('aria-hidden','true'); uploadForm.reset(); }

  if(addPhotoBtn) addPhotoBtn.addEventListener('click', openUploadModal);
  if(uploadModalClose) uploadModalClose.addEventListener('click', closeUploadModal);
  if(uploadModal) uploadModal.addEventListener('click', (e)=>{ if(e.target===uploadModal) closeUploadModal(); });

  // Photo storage in localStorage
  const PHOTO_STORAGE_KEY = 'valentinePhotos';
  function savePhotosToStorage(photos){ localStorage.setItem(PHOTO_STORAGE_KEY, JSON.stringify(photos)); }
  function loadPhotosFromStorage(){ const stored = localStorage.getItem(PHOTO_STORAGE_KEY); return stored ? JSON.parse(stored) : []; }

  function loadSavedPhotosIntoCarousel(){
    const savedPhotos = loadPhotosFromStorage();
    const carousel = document.getElementById('carousel'); if(!carousel) return;
    savedPhotos.forEach(photo=>{
      const slide = document.createElement('div'); slide.className='slide'; slide.dataset.date = new Date().toISOString().split('T')[0];
      slide.innerHTML = `<div style="width:100%;height:100%;background:url('${photo.data}') center/cover;border-radius:14px;"></div><figcaption><div class="caption">${photo.caption || 'Uploaded Photo'}</div></figcaption>`;
      carousel.appendChild(slide);
    });
    // reinitialize carousel to include new slides
    if(slides && slides.length) setupCarousel();
  }

  if(uploadForm){
    uploadForm.addEventListener('submit', async (e)=>{
      e.preventDefault();
      const pwd = uploadPasswordInput.value;
      const file = uploadFileInput.files[0];
      const caption = uploadCaptionInput.value || 'Uploaded Photo';

      if(pwd !== uploadPassword){ alert('Incorrect password'); return; }
      if(!file) { alert('Please select a photo'); return; }

      // convert file to base64
      const reader = new FileReader();
      reader.onload = function(evt){
        const base64 = evt.target.result;
        const savedPhotos = loadPhotosFromStorage();
        savedPhotos.push({data: base64, caption: caption, date: new Date().toISOString()});
        savePhotosToStorage(savedPhotos);

        // add new slide to carousel
        const carousel = document.getElementById('carousel'); if(carousel){
          const slide = document.createElement('div'); slide.className='slide'; slide.dataset.date = new Date().toISOString().split('T')[0];
          slide.innerHTML = `<div style="width:100%;height:100%;background:url('${base64}') center/cover;border-radius:14px;"></div><figcaption><div class="caption">${caption}</div></figcaption>`;
          carousel.appendChild(slide);
          // refresh carousel layout
          setupCarousel();
        }

        closeUploadModal();
        alert('Photo added! 📸');
      };
      reader.readAsDataURL(file);
    });
  }


  // init everything on DOMContentLoaded
  function init(){
    resize(); initStars(); animateStars();
    // spawn subtle hearts periodically
    setInterval(spawnHeart,3000);
    loadSavedPhotosIntoCarousel();
    setupCarousel();
    renderTimeline();
    createPolaroids();
    updateCountdown(); setInterval(updateCountdown,60000);
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', init); else init();

})();
