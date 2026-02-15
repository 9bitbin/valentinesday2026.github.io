// script.js — core interactivity: starfield, lock screen validation (hashed), carousel, audio controls
// Uses Supabase for carousel uploads (Storage + Table). Keep code modular and commented.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

(async function(){
  // ---- Supabase (replace with your project URL + anon key from Supabase Dashboard) ----
  const SUPABASE_URL = 'https://ydvqlvobfisxmbcoiacp.supabase.co';
  const SUPABASE_ANON_KEY = 'sb_publishable_yMwko9VhdVVQ92lWMbFLiA_gs8_tvyd';
  const supabaseReady = SUPABASE_URL && SUPABASE_ANON_KEY && SUPABASE_URL !== 'YOUR_SUPABASE_URL';
  const supabase = supabaseReady ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

  const CAROUSEL_TABLE = 'carousel_photos';
  const CAROUSEL_BUCKET = 'carousel';
  const NOTES_TABLE = 'notes';

  // ---- Notes Functions ----
  async function fetchNotesFromSupabase() {
    if (!supabase) return [];
    const { data, error } = await supabase.from(NOTES_TABLE).select('*').order('note_date', { ascending: false });
    if (error) { console.warn('Notes fetch error', error); return []; }
    return data || [];
  }

  async function addNoteToSupabase(noteDate, noteTitle, noteDescription) {
    if (!supabase) { alert('Supabase not configured'); return null; }
    const { data, error } = await supabase.from(NOTES_TABLE).insert([{
      note_date: noteDate,
      title: noteTitle,
      description: noteDescription
    }]).select();
    if (error) { console.error('Note insert error', error); throw error; }
    return data ? data[0] : null;
  }

  async function deleteNoteFromSupabase(id) {
    if (!supabase) { alert('Supabase not configured'); return; }
    const { error } = await supabase.from(NOTES_TABLE).delete().eq('id', id);
    if (error) { console.error('Note delete error', error); throw error; }
  }

  async function deletePhotoFromSupabase(photoId, imagePath) {
    if (!supabase) { alert('Supabase not configured'); return; }
    console.log('deletePhotoFromSupabase called:', { photoId, imagePath });
    
    // Delete from storage
    console.log('Deleting from storage:', imagePath);
    const { error: storageError } = await supabase.storage.from(CAROUSEL_BUCKET).remove([imagePath]);
    if (storageError) {
      console.error('Storage delete error:', storageError);
    } else {
      console.log('Storage delete successful');
    }
    
    // Delete from database - IMPORTANT: must use `.select()` to get count of deleted rows
    console.log('Deleting from database:', photoId);
    const { data, error: dbError } = await supabase
      .from(CAROUSEL_TABLE)
      .delete()
      .eq('id', photoId)
      .select(); // This returns the deleted rows so we can verify
    
    if (dbError) { 
      console.error('Photo delete error', dbError); 
      throw dbError; 
    } else {
      console.log('Database delete result:', { deletedCount: data ? data.length : 0, data });
      if (!data || data.length === 0) {
        console.warn('WARNING: Delete query ran but no rows were deleted!');
        throw new Error('Photo not found in database');
      }
      console.log('Database delete successful - 1 row removed');
    }
  }

  function extractStoragePathFromUrl(imageUrl) {
    if (!imageUrl) return null;
    try {
      const urlObj = new URL(imageUrl);
      const marker = '/carousel/';
      const idx = urlObj.pathname.indexOf(marker);
      if (idx !== -1) return urlObj.pathname.slice(idx + marker.length);
      // Fallback: last path segment
      const parts = urlObj.pathname.split('/').filter(Boolean);
      return parts.length ? parts[parts.length - 1] : null;
    } catch (e) {
      return null;
    }
  }

  async function fetchCarouselPhotosFromSupabase() {
    if (!supabase) return [];
    const { data, error } = await supabase.from(CAROUSEL_TABLE).select('*').order('created_at', { ascending: true });
    if (error) throw error;
    return data || [];
  }

  function appendCloudSlidesToCarousel(photos) {
    const carousel = document.getElementById('carousel');
    if (!carousel) return;
    
    // Always clear first to prevent stale slides
    carousel.innerHTML = '';
    
    // If no photos, carousel stays empty
    if (!photos || !photos.length) {
      console.log('No photos to display');
      return;
    }
    
    console.log('Appending', photos.length, 'photos to carousel');
    const dateStr = new Date().toISOString().split('T')[0];
    photos.forEach(photo => {
      const slide = document.createElement('div');
      slide.className = 'slide';
      slide.dataset.date = photo.date || dateStr;
      slide.dataset.photoId = photo.id;
      slide.dataset.imageUrl = photo.image_url;
      const url = (photo.image_url || '').replace(/'/g, "\\'");
      const cap = (photo.caption || 'Uploaded Photo').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      const deleteBtn = `<button type="button" class="slide-delete-btn" aria-label="Delete this photo" style="position:absolute;top:10px;right:10px;background:rgba(255,0,0,0.7);color:white;border:none;padding:8px 12px;border-radius:8px;cursor:pointer;font-weight:bold;z-index:10;">✕</button>`;
      slide.innerHTML = `<div style="width:100%;height:100%;background:url('${url}') center/cover;border-radius:14px;position:relative;">${deleteBtn}</div><figcaption><div class="caption">${cap}</div></figcaption>`;
      carousel.appendChild(slide);
    });
  }

  async function loadCarouselFromCloudAndSetup() {
    try {
      const photos = supabaseReady && supabase ? await fetchCarouselPhotosFromSupabase() : [];
      appendCloudSlidesToCarousel(photos);
    } catch (e) { console.warn('Supabase carousel load failed', e); }
    setupCarousel();
  }

  // ---- Utilities ----
  async function sha256(text){
    const enc = new TextEncoder();
    const data = enc.encode(text);
    const hash = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(hash)).map(b=>b.toString(16).padStart(2,'0')).join('');
  }

  // ---- Starfield Canvas - Responsive sizing ----
  const canvas = document.getElementById('starfield');
  const ctx = canvas && canvas.getContext('2d');
  let stars = [];
  
  function resize(){
    if(!canvas) return; 
    canvas.width = window.innerWidth; 
    canvas.height = window.innerHeight;
  }
  
  function initStars(){
    stars = [];
    const count = Math.round((canvas.width*canvas.height)/80000);
    for(let i=0;i<count;i++){
      stars.push({x:Math.random()*canvas.width,y:Math.random()*canvas.height,z:Math.random()*1,rad:Math.random()*1.2+0.2,dx:(Math.random()-0.5)*0.02});
    }
  }
  
  function drawStars(){
    if(!ctx) return; 
    ctx.clearRect(0,0,canvas.width,canvas.height);
    ctx.fillStyle = 'rgba(6,6,12,0.4)'; 
    ctx.fillRect(0,0,canvas.width,canvas.height);
    for(const s of stars){
      s.x += s.dx; 
      if(s.x<0) s.x=canvas.width; 
      if(s.x>canvas.width) s.x=0;
      const g = ctx.createRadialGradient(s.x,s.y,0,s.x,s.y,s.rad*4);
      g.addColorStop(0,'rgba(255,255,255,'+(0.8*s.z)+')'); 
      g.addColorStop(1,'rgba(255,255,255,0)');
      ctx.fillStyle = g; 
      ctx.beginPath(); 
      ctx.arc(s.x,s.y,s.rad,0,Math.PI*2); 
      ctx.fill();
    }
  }
  
  function animateStars(){ 
    drawStars(); 
    requestAnimationFrame(animateStars); 
  }
  
  window.addEventListener('resize', () => { 
    resize(); 
    initStars();
    // Recalculate responsive layouts on resize
    recalculateLayout();
  });
  
  // Handle orientation changes for mobile
  window.addEventListener('orientationchange', () => {
    setTimeout(() => {
      resize();
      initStars();
      recalculateLayout();
    }, 100);
  });

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
    console.log('Validation:', { date, color, place, ok });
    console.log('Answer hashes:', answersHash);
    if(ok){
      unlockBtn.textContent='Unlocked ✓';
      unlockAnimation().then(unlockEntry);
    } else {
      // shake
      lockScreen.animate([{transform:'translate(-50%,-50%)'},{transform:'translate(calc(-50% -8px),-50%)'},{transform:'translate(calc(-50% +8px),-50%)'},{transform:'translate(-50%,-50%)'}],{duration:600});
      // Clear the form to allow retry
      form.reset();
      unlockBtn.textContent='Unlock';
      alert('Incorrect answers. Please try again.');
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
    // auto-start first track on unlock (user gesture allows autoplay)
    goToTrack(0);
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
    attachCarouselDeleteHandlers();
  }

  function attachCarouselDeleteHandlers() {
    document.querySelectorAll('.slide-delete-btn').forEach(btn => {
      // Remove any existing handlers by cloning
      const newBtn = btn.cloneNode(true);
      btn.parentNode.replaceChild(newBtn, btn);
      
      newBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        e.preventDefault();
        
        const slide = newBtn.closest('.slide');
        if (!slide) return;
        const photoId = slide.dataset.photoId;
        const imageUrl = slide.dataset.imageUrl;
        
        console.log('Delete clicked:', { photoId, imageUrl });
        
        if (!photoId) {
          alert('Could not identify photo ID');
          return;
        }
        
        // Extract storage path - handle Supabase public URL format
        let imagePath = null;
        if (imageUrl) {
          try {
            // Supabase URL format: https://xxx.supabase.co/storage/v1/object/public/carousel/FILENAME
            const urlObj = new URL(imageUrl);
            const pathParts = urlObj.pathname.split('/');
            const carouselIdx = pathParts.indexOf('carousel');
            if (carouselIdx !== -1 && carouselIdx < pathParts.length - 1) {
              imagePath = pathParts.slice(carouselIdx + 1).join('/');
            }
          } catch (e) {
            console.warn('URL parse error:', e);
          }
        }
        
        console.log('Extracted path:', imagePath);
        
        if (!imagePath) {
          alert('Could not extract image path');
          return;
        }
        
        const confirmed = confirm('Delete this photo? It will be removed everywhere.');
        if(!confirmed) return;
        
        try {
          if (!supabaseReady || !supabase) {
            alert('Supabase not configured');
            return;
          }
          
          console.log('Deleting photo:', photoId, imagePath);
          await deletePhotoFromSupabase(photoId, imagePath);
          console.log('Delete successful');
          
          // Reload carousel and polaroids from Supabase
          document.getElementById('carousel').innerHTML = '';
          await loadCarouselFromCloudAndSetup();
          updatePolaroidsDebounced();
          alert('Photo deleted! 🗑️');
        } catch (err) {
          console.error('Delete error', err);
          alert('Failed to delete: ' + (err.message || String(err)));
        }
      });
    });
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
  function startAuto(){ stopAuto(); autoTimer = setInterval(next,3000); }
  function stopAuto(){ if(autoTimer) clearInterval(autoTimer); autoTimer=null; }

  // nav buttons
  document.querySelectorAll('.nav.left').forEach(b=>b.addEventListener('click', ()=>{ prev(); resetAuto(); }));
  document.querySelectorAll('.nav.right').forEach(b=>b.addEventListener('click', ()=>{ next(); resetAuto(); }));
  function resetAuto(){ stopAuto(); setTimeout(startAuto,6000); }

  // dots
  function createDots(){ 
    const dots = document.getElementById('dots'); 
    if(!dots) return;
    dots.innerHTML=''; 
    slides.forEach((s,i)=>{ 
      const b=document.createElement('button'); 
      b.setAttribute('type', 'button');
      b.setAttribute('role', 'tab');
      b.setAttribute('aria-selected', i === idx ? 'true' : 'false');
      b.setAttribute('aria-label', `View photo ${i + 1} of ${slides.length}`);
      b.addEventListener('click', ()=>{ 
        goto(i); 
        resetAuto();
        // Update aria-selected for accessibility
        updateDotsAria();
      }); 
      dots.appendChild(b); 
    }); 
    updateDots(); 
  }
  
  function updateDotsAria(){
    const buttons = document.querySelectorAll('#dots button');
    buttons.forEach((b,i)=>{
      b.setAttribute('aria-selected', i === idx ? 'true' : 'false');
    });
  }
  
  function updateDots(){ 
    const buttons = document.querySelectorAll('#dots button'); 
    buttons.forEach((b,i)=>{
      b.classList.toggle('active', i===idx);
      b.setAttribute('aria-selected', i === idx ? 'true' : 'false');
    }); 
  }

  // swipe support with improved mobile touch handling
  let startX=0, startY=0, deltaX=0, deltaY=0; 
  const SWIPE_THRESHOLD = Math.max(40, window.innerWidth * 0.1); // 10% of viewport or 40px, whichever is larger
  
  carousel.addEventListener('touchstart', (e) => { 
    stopAuto(); 
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
  }, { passive: true });
  
  carousel.addEventListener('touchmove', (e) => { 
    deltaX = e.touches[0].clientX - startX;
    deltaY = e.touches[0].clientY - startY;
  }, { passive: true });
  
  carousel.addEventListener('touchend', (e) => { 
    // Only trigger swipe if horizontal movement is greater than vertical movement
    if(Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > SWIPE_THRESHOLD) { 
      if(deltaX < 0) next(); 
      else prev(); 
    } 
    deltaX = 0; 
    deltaY = 0;
    startAuto(); 
  }, { passive: true });

  // pause on hover
  carousel.addEventListener('mouseenter', stopAuto); carousel.addEventListener('mouseleave', startAuto);

  // ---- Audio controls (playlist, prev/next/stop, volume, song name) ----
  const PLAYLIST = [
    { name: 'Te Amo — Franco De Vita', src: 'Franco_De_Vita-Te_Amo.mp3' },
    { name: 'When You Say You Love Me — Josh Groban', src: 'when_you_say_you_love_me-Josh_Groban.mp3' }
  ];
  const music = document.createElement('audio');
  music.id = 'bgMusic';
  document.body.appendChild(music);
  let currentTrackIndex = 0;

  const playBtn = document.getElementById('playPause');
  const vol = document.getElementById('volumeSlider');
  const titleEl = document.getElementById('songTitle');
  const prevBtn = document.getElementById('prevBtn');
  const nextBtn = document.getElementById('nextBtn');
  const stopBtn = document.getElementById('stopBtn');

  function goToTrack(index) {
    if (!PLAYLIST.length) return;
    currentTrackIndex = (index + PLAYLIST.length) % PLAYLIST.length;
    const track = PLAYLIST[currentTrackIndex];
    music.src = track.src;
    music.load();
    if (titleEl) titleEl.textContent = track.name;
    music.play().then(() => updatePlay()).catch(() => updatePlay());
  }

  function nextTrack() {
    if (PLAYLIST.length <= 1) { music.currentTime = 0; music.play().then(() => updatePlay()).catch(() => {}); return; }
    goToTrack(currentTrackIndex + 1);
  }

  function prevTrack() {
    if (music.currentTime > 2) { music.currentTime = 0; music.play().then(() => updatePlay()).catch(() => {}); return; }
    if (PLAYLIST.length <= 1) { music.currentTime = 0; updatePlay(); return; }
    goToTrack(currentTrackIndex - 1);
  }

  function stopTrack() {
    music.pause();
    music.currentTime = 0;
    updatePlay();
  }

  playBtn.addEventListener('click', () => {
    if (music.paused) {
      if (!music.src) goToTrack(0);
      else music.play().then(() => updatePlay()).catch(() => {});
    } else music.pause();
    updatePlay();
  });
  prevBtn.addEventListener('click', prevTrack);
  nextBtn.addEventListener('click', nextTrack);
  stopBtn.addEventListener('click', stopTrack);
  vol.addEventListener('input', () => { music.volume = vol.value / 100; });

  music.volume = vol ? vol.value / 100 : 0.8;
  music.loop = false;
  music.addEventListener('ended', () => { if (PLAYLIST.length > 1) goToTrack(currentTrackIndex + 1); else music.currentTime = 0; music.play().catch(() => {}); });
  music.addEventListener('play', updatePlay);
  music.addEventListener('pause', updatePlay);

  function updateSongTitle() {
    if (titleEl && PLAYLIST[currentTrackIndex]) titleEl.textContent = PLAYLIST[currentTrackIndex].name;
  }

  function updatePlay() {
    playBtn.textContent = music.paused ? 'Play' : 'Pause';
    updateSongTitle();
    try {
      if (cdTween) { if (music.paused) cdTween.pause(); else cdTween.play(); }
      else { const cd = document.querySelector('.cd'); if (cd) cd.style.transform = music.paused ? 'rotate(0deg)' : 'rotate(360deg)'; }
    } catch (e) {}
  }

  let cdTween = null;
  try { cdTween = gsap.to('.cd', { rotation: 360, duration: 6, repeat: -1, ease: 'none', paused: true }); } catch (e) { cdTween = null; }

  // Set initial song name (no autoplay until unlock)
  if (titleEl && PLAYLIST[0]) titleEl.textContent = PLAYLIST[0].name;

  // Keyboard shortcuts: Space play/pause, arrows carousel, M mute
  document.addEventListener('keydown', (ev) => {
    const tag = (document.activeElement && document.activeElement.tagName) || '';
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;
    if (ev.code === 'Space' || ev.key === ' ') { ev.preventDefault(); if (music.paused) { if (!music.src) goToTrack(0); else music.play(); } else music.pause(); updatePlay(); }
    if (ev.code === 'ArrowRight') { ev.preventDefault(); next(); resetAuto(); }
    if (ev.code === 'ArrowLeft') { ev.preventDefault(); prev(); resetAuto(); }
    if (ev.key && ev.key.toLowerCase() === 'm') { music.muted = !music.muted; vol.value = music.muted ? 0 : Math.round(music.volume * 100); }
  });

  // visitor counter (simple localStorage increment)
  const vc = document.getElementById('visitorCount'); const key='vcount'; const cur = Number(localStorage.getItem(key)||0)+1; localStorage.setItem(key,cur); vc.textContent = cur;

  // countdown to next Valentine's Day
  function updateCountdown(){ const now=new Date(); let year=now.getFullYear(); const vDay=new Date(`${year}-02-14T00:00:00`); if(vDay<=now) vDay.setFullYear(year+1); const diff=(vDay-now); const d=Math.floor(diff/86400000); const h=Math.floor((diff%86400000)/3600000); const m=Math.floor((diff%3600000)/60000); document.getElementById('countdown').textContent = `${d}d ${h}h ${m}m`; }

  // ---- Responsive Layout Recalculation ----
  let layoutRecalcTimer = null;
  function recalculateLayout(){
    // Debounce layout recalculation to avoid performance issues
    if(layoutRecalcTimer) clearTimeout(layoutRecalcTimer);
    layoutRecalcTimer = setTimeout(() => {
      // Ensure carousel transforms are still correct
      setupCarousel();
    }, 250); // Wait for layout to stabilize before recalculation
  }

  const timelineData = [
    {date:'2006-02-14', title:'We met', text:'That unforgettable first meeting.'},
    {date:'2006-03-01', title:'First Kiss', text:'Under the streetlight.'},
    {date:'2007-06-21', title:'Roadtrip', text:'Windows down, music up.'},
    {date:'2010-12-24', title:'Snowy Dinner', text:'Cozy and bright.'}
  ];

  let notesFromSupabase = [];

  async function renderNotes() {
    try {
      notesFromSupabase = await fetchNotesFromSupabase();
    } catch (e) {
      console.warn('Failed to fetch notes', e);
      notesFromSupabase = [];
    }
    
    const list = document.getElementById('timelineList'); 
    if (!list) return; 
    
    list.innerHTML = '';
    
    // Show notes from Supabase
    if (notesFromSupabase.length > 0) {
      notesFromSupabase.forEach(note => {
        const li = document.createElement('li');
        li.dataset.noteId = note.id;
        li.innerHTML = `
          <div class="date">${note.note_date}</div>
          <div class="title">${(note.title || '').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>
          <div class="desc">${(note.description || '').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>
          <button type="button" class="note-delete-btn" data-note-id="${note.id}" style="background:rgba(255,0,0,0.7);color:white;border:none;padding:6px 10px;border-radius:6px;cursor:pointer;margin-top:8px;font-size:12px;">Delete</button>
        `;
        list.appendChild(li);
        
        // Add delete handler
        const deleteBtn = li.querySelector('.note-delete-btn');
        deleteBtn.addEventListener('click', async (e) => {
          e.preventDefault();
          const id = note.id;
          const confirmed = confirm('Delete this note?');
          if(!confirmed) return;
          
          try {
            await deleteNoteFromSupabase(id);
            li.remove();
            alert('Note deleted! 🗑️');
            await renderNotes();
          } catch (err) {
            console.error('Delete error', err);
            alert('Failed to delete: ' + (err.message || String(err)));
          }
        });
      });
    } else {
      const li = document.createElement('li');
      li.innerHTML = '<div class="desc" style="color:#999;font-style:italic;">No notes yet. Add your first note! 💑</div>';
      list.appendChild(li);
    }
  }

  function renderTimeline(){
    const list = document.getElementById('timelineList'); if(!list) return; list.innerHTML='';
    timelineData.forEach(ev=>{
      const li = document.createElement('li');
      li.innerHTML = `<div class="date">${ev.date}</div><div class="title">${ev.title}</div><div class="desc">${ev.text}</div>`;
      list.appendChild(li);
    });
  }

  // Debounce polaroid updates to prevent flashing
  let polaroidUpdateTimer = null;
  async function updatePolaroidsDebounced() {
    if (polaroidUpdateTimer) clearTimeout(polaroidUpdateTimer);
    polaroidUpdateTimer = setTimeout(() => {
      createPolaroids();
      polaroidUpdateTimer = null;
    }, 100);
  }

  async function createPolaroids(){
    const container = document.getElementById('polaroids'); 
    if(!container) return; 
    container.innerHTML='';
    
    // Fetch images from Supabase carousel
    let photos = [];
    try {
      photos = await fetchCarouselPhotosFromSupabase();
    } catch (e) {
      console.warn('Failed to fetch carousel photos for polaroids', e);
      photos = [];
    }
    
    // If no Supabase photos, show empty state
    if (photos.length === 0) {
      const empty = document.createElement('div');
      empty.style.cssText = 'color:#999;font-style:italic;padding:20px;text-align:center;width:100%;';
      empty.textContent = 'No memories pinned yet. Upload photos to see them here! 📸';
      container.appendChild(empty);
      return;
    }
    
    // Create polaroid for each photo
    photos.forEach((photo, i) => {
      const p = document.createElement('div'); 
      p.className = 'polaroid';
      p.dataset.photoId = photo.id;
      // Random slight rotation for natural scattered look
      const rotation = (Math.random() - 0.5) * 8; // -4 to 4 degrees
      p.style.transform = `rotate(${rotation}deg)`;
      
      const imageUrl = photo.image_url || '';
      const caption = (photo.caption || 'Memory').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      
      p.innerHTML = `
        <div class="polaroid-inner">
          <div class="thumbtack">📌</div>
          <img data-src="${imageUrl.replace(/"/g, '&quot;')}" alt="${caption}" loading="lazy">
          <div class="label">${caption}</div>
        </div>
      `;
      
      p.addEventListener('click', () => { 
        openModal(caption, `<img src="${imageUrl}" style="max-width:90%;height:auto;border-radius:8px" alt="${caption}">`); 
      });
      
      container.appendChild(p);
    });
    
    // lazy load polaroid images
    document.querySelectorAll('.polaroid img').forEach(img => { 
      if(img.dataset.src) img.src = img.dataset.src; 
    });
  }

  // Modal helpers
  const modal = document.getElementById('modal'); const modalClose = document.getElementById('modalClose');
  function openModal(title, html){ if(!modal) return; modal.classList.remove('hidden'); modal.setAttribute('aria-hidden','false'); document.getElementById('modalTitle').textContent = title; document.getElementById('modalContent').innerHTML = html; }
  function closeModal(){ if(!modal) return; modal.classList.add('hidden'); modal.setAttribute('aria-hidden','true'); }
  if(modalClose) modalClose.addEventListener('click', closeModal);
  modal && modal.addEventListener('click', (e)=>{ if(e.target===modal) closeModal(); });

  // ---- Notes Feature (Supabase) ----
  const noteModal = document.getElementById('noteModal');
  const noteModalClose = document.getElementById('noteModalClose');
  const addNoteBtn = document.getElementById('addNoteBtn');
  const noteForm = document.getElementById('noteForm');
  const noteDate = document.getElementById('noteDate');
  const noteTitle = document.getElementById('noteTitle');
  const noteDescription = document.getElementById('noteDescription');

  function openNoteModal() { 
    if(!noteModal) return; 
    // Set today's date as default
    const today = new Date().toISOString().split('T')[0];
    noteDate.value = today;
    noteModal.classList.remove('hidden'); 
    noteModal.setAttribute('aria-hidden','false');
  }
  
  function closeNoteModal() { 
    if(!noteModal) return; 
    noteModal.classList.add('hidden'); 
    noteModal.setAttribute('aria-hidden','true'); 
    noteForm.reset();
  }

  if(addNoteBtn) addNoteBtn.addEventListener('click', openNoteModal);
  if(noteModalClose) noteModalClose.addEventListener('click', closeNoteModal);
  if(noteModal) noteModal.addEventListener('click', (e)=>{ if(e.target===noteModal) closeNoteModal(); });

  if(noteForm) {
    noteForm.addEventListener('submit', async (e)=>{
      e.preventDefault();
      const date = noteDate.value;
      const title = noteTitle.value;
      const description = noteDescription.value;

      if (!supabaseReady || !supabase) {
        alert('Supabase is not configured.');
        return;
      }

      const submitBtn = noteForm.querySelector('button[type="submit"]');
      const origText = submitBtn.textContent;
      submitBtn.disabled = true;
      submitBtn.textContent = 'Adding…';

      try {
        await addNoteToSupabase(date, title, description);
        closeNoteModal();
        alert('Note added! 📝');
        await renderNotes();
      } catch (err) {
        console.error('Note add error', err);
        alert('Failed to add note: ' + (err.message || String(err)));
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = origText;
      }
    });
  }

  // Photo Upload Feature ----
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

  // ---- Add Photo: upload to Supabase Storage + table (persists for both of you) ----
  if(uploadForm){
    uploadForm.addEventListener('submit', async (e)=>{
      e.preventDefault();
      const pwd = uploadPasswordInput.value;
      const file = uploadFileInput.files[0];
      const caption = (uploadCaptionInput.value || 'Uploaded Photo').trim();

      if(pwd !== uploadPassword){ alert('Incorrect password'); return; }
      if(!file) { alert('Please select a photo'); return; }
      if (!supabaseReady || !supabase) {
        alert('Supabase is not configured. See SUPABASE_SETUP.md and add SUPABASE_URL + SUPABASE_ANON_KEY to script.js.');
        return;
      }

      const submitBtn = uploadForm.querySelector('button[type="submit"]');
      const origText = submitBtn.textContent;
      submitBtn.disabled = true;
      submitBtn.textContent = 'Uploading…';

      function resetBtn() {
        submitBtn.disabled = false;
        submitBtn.textContent = origText;
      }

      const timeoutMs = 25000;
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Upload timed out. Check connection and Supabase Storage.')), timeoutMs)
      );

      try {
        const path = `${Date.now()}_${(file.name || 'photo').replace(/[^a-zA-Z0-9.-]/g, '_')}`;
        const { error: uploadError } = await Promise.race([
          supabase.storage.from(CAROUSEL_BUCKET).upload(path, file, { upsert: false }),
          timeoutPromise
        ]);
        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage.from(CAROUSEL_BUCKET).getPublicUrl(path);
        const imageURL = urlData.publicUrl;
        const dateStr = new Date().toISOString().split('T')[0];

        const { error: insertError } = await Promise.race([
          supabase.from(CAROUSEL_TABLE).insert({
            image_url: imageURL,
            caption: caption || 'Uploaded Photo',
            date: dateStr
          }),
          timeoutPromise
        ]);
        if (insertError) throw insertError;

        closeUploadModal();
        alert('Photo added! 📸 It will appear for both of you.');
        
        // Reload carousel to get all photos with proper IDs
        document.getElementById('carousel').innerHTML = '';
        await loadCarouselFromCloudAndSetup();
        // Also update polaroids (debounced to prevent flashing)
        updatePolaroidsDebounced();
      } catch (err) {
        console.error('Upload error', err);
        const msg = err.message || String(err);
        alert('Upload failed: ' + msg);
      } finally {
        resetBtn();
      }
    });
  }


  // init everything on DOMContentLoaded
  async function init(){
    resize(); 
    initStars(); 
    animateStars();
    setInterval(spawnHeart, 3000);
    await renderNotes();
    await createPolaroids();
    updateCountdown(); 
    setInterval(updateCountdown, 60000);
    // Carousel: load Supabase uploads then setup (static HTML slides + cloud slides)
    await loadCarouselFromCloudAndSetup();
    
    // Ensure layout responds to viewport changes
    // Add listener for when content actually resizes (after animations, etc.)
    if(window.ResizeObserver){
      const mainEl = document.getElementById('main');
      if(mainEl){
        const observer = new ResizeObserver(() => {
          // Only recalculate if main is not hidden
          if(!mainEl.classList.contains('hidden')){
            recalculateLayout();
          }
        });
        observer.observe(mainEl);
      }
    }
  }
  
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', init); 
  else init();

})();
