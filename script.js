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
  const MUSIC_TABLE = 'music_library';
  const MUSIC_BUCKET = 'music';

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
    // Delete from storage
    const { error: storageError } = await supabase.storage.from(CAROUSEL_BUCKET).remove([imagePath]);
    if (storageError) console.warn('Storage delete warning', storageError);
    // Delete from table
    const { error: dbError } = await supabase.from(CAROUSEL_TABLE).delete().eq('id', photoId);
    if (dbError) { console.error('Photo delete error', dbError); throw dbError; }
  }

  async function fetchCarouselPhotosFromSupabase() {
    if (!supabase) return [];
    const { data, error } = await supabase.from(CAROUSEL_TABLE).select('*').order('created_at', { ascending: true });
    if (error) throw error;
    return data || [];
  }

  // ---- Music Library Functions ----
  async function fetchMusicFromSupabase() {
    if (!supabase) return [];
    const { data, error } = await supabase.from(MUSIC_TABLE).select('*').order('created_at', { ascending: true });
    if (error) { console.warn('Music fetch error', error); return []; }
    return data || [];
  }

  async function uploadMusicToSupabase(file, title) {
    if (!supabase) { alert('Supabase not configured'); return null; }
    
    const filename = `${Date.now()}-${file.name}`;
    const path = `music/${filename}`;
    
    try {
      // Upload to storage
      const { error: uploadError } = await supabase.storage.from(MUSIC_BUCKET).upload(path, file, { upsert: false });
      if (uploadError) throw uploadError;
      
      // Get public URL
      const { data: urlData } = supabase.storage.from(MUSIC_BUCKET).getPublicUrl(path);
      const music_url = urlData?.publicUrl;
      
      // Insert into database
      const { data, error: dbError } = await supabase.from(MUSIC_TABLE).insert({
        title: title || file.name.replace('.mp3', ''),
        filename: filename,
        music_url: music_url,
        file_size: file.size,
        created_at: new Date().toISOString()
      }).select();
      
      if (dbError) throw dbError;
      return data ? data[0] : null;
    } catch (error) {
      console.error('Music upload error:', error);
      throw error;
    }
  }

  async function deleteMusicFromSupabase(musicId, filename) {
    if (!supabase) { alert('Supabase not configured'); return; }
    try {
      // Delete from storage
      const storagePath = `music/${filename}`;
      const { error: storageError } = await supabase.storage.from(MUSIC_BUCKET).remove([storagePath]);
      if (storageError) console.warn('Storage delete warning', storageError);
      
      // Delete from database
      const { error: dbError } = await supabase.from(MUSIC_TABLE).delete().eq('id', musicId);
      if (dbError) { console.error('Music delete error', dbError); throw dbError; }
    } catch (error) {
      console.error('Delete music error:', error);
      throw error;
    }
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
      slide.innerHTML = `<img src="${url}" alt="${cap}" data-src="${url}" />${deleteBtn}<figcaption><div class="caption">${cap}</div></figcaption>`;
      carousel.appendChild(slide);
      
      // Add load event to adjust carousel height
      const img = slide.querySelector('img');
      if (img) {
        img.addEventListener('load', () => adjustCarouselHeight(img));
      }
    });
    // Attach delete handlers to all delete buttons
    attachPhotoDeleteHandlers();
  }

  function attachPhotoDeleteHandlers() {
    document.querySelectorAll('.slide-delete-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const slide = btn.closest('.slide');
        if (!slide) return;
        
        const photoId = slide.dataset.photoId;
        const imageUrl = slide.dataset.imageUrl;
        
        if (!photoId || !imageUrl) {
          alert('Could not identify photo');
          return;
        }
        
        const confirmed = confirm('Delete this photo? It will be removed from both carousel and memories.');
        if (!confirmed) return;
        
        try {
          // Extract path from URL (everything after domain)
          const urlObj = new URL(imageUrl);
          const imagePath = urlObj.pathname.split('/').pop();
          
          await deletePhotoFromSupabase(photoId, imagePath);
          alert('Photo deleted! 🗑️');
          
          // Reload carousel and polaroids
          document.getElementById('carousel').innerHTML = '';
          await loadCarouselFromCloudAndSetup();
          updatePolaroidsDebounced();
        } catch (err) {
          console.error('Delete error', err);
          alert('Failed to delete photo: ' + (err.message || String(err)));
        }
      });
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
    // Show music library panel after login
    if (musicLibraryPanel) musicLibraryPanel.classList.remove('hidden');
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
    // Adjust carousel height for current slide
    adjustCarouselHeightForCurrentSlide();
  }

  // Auto-adjust carousel height based on current photo's aspect ratio
  function adjustCarouselHeight(img) {
    if (!img || !img.complete) return;
    const carousel = document.getElementById('carousel');
    if (!carousel) return;
    
    const aspectRatio = img.naturalWidth / img.naturalHeight;
    const maxWidth = Math.min(1000, window.innerWidth * 0.95);
    const maxHeight = window.innerHeight * 0.75;
    
    let newHeight;
    if (aspectRatio > 1.5) {
      // Wide landscape photo
      newHeight = Math.min(maxWidth / aspectRatio, maxHeight);
    } else if (aspectRatio < 0.7) {
      // Tall portrait photo
      newHeight = Math.min(maxHeight, maxWidth / aspectRatio);
    } else {
      // Square-ish photo
      newHeight = Math.min(maxWidth * 0.8, maxHeight);
    }
    
    // Constrain between 400px and 900px
    newHeight = Math.max(400, Math.min(900, newHeight));
    carousel.style.height = `${newHeight}px`;
  }

  function adjustCarouselHeightForCurrentSlide() {
    if (!slides || !slides[idx]) return;
    const currentSlide = slides[idx];
    const img = currentSlide.querySelector('img');
    if (img && img.complete) {
      adjustCarouselHeight(img);
    }
  }

  function attachCarouselDeleteHandlers() {
    document.querySelectorAll('.slide-delete-btn').forEach(btn => {
      // Remove any existing handlers
      const newBtn = btn.cloneNode(true);
      btn.parentNode.replaceChild(newBtn, btn);
      
      newBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        e.preventDefault();
        
        const slide = newBtn.closest('.slide');
        const photoId = slide.dataset.photoId;
        const imageUrl = slide.dataset.imageUrl;
        
        if(!photoId) return;
        
        const confirmed = confirm('Delete this photo?');
        if(!confirmed) return;
        
        try {
          // Extract path from full URL
          const pathMatch = imageUrl.match(/\/carousel\/(.+?)[\?#]?$/);
          const path = pathMatch ? pathMatch[1] : imageUrl.split('/carousel/')[1];
          
          if (!supabaseReady || !supabase) {
            alert('Supabase not configured');
            return;
          }
          
          await deletePhotoFromSupabase(photoId, path);
          slide.remove();
          setupCarousel();
          alert('Photo deleted! 📸');
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
    updateDots(); adjustCarouselHeightForCurrentSlide(); }
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
  const PLAYLIST = [];
  const music = document.createElement('audio');
  music.id = 'bgMusic';
  document.body.appendChild(music);
  let currentTrackIndex = 0;

  const playBtn = document.getElementById('playPause');
  const vol = document.getElementById('volumeSlider');
  const titleEl = document.getElementById('songTitle');
  const progressBar = document.getElementById('progressBar');
  const currentTimeEl = document.getElementById('currentTime');
  const durationTimeEl = document.getElementById('durationTime');
  const prevBtn = document.getElementById('prevBtn');
  const nextBtn = document.getElementById('nextBtn');
  const stopBtn = document.getElementById('stopBtn');

  function getActiveList() {
    return musicLibrary.length ? musicLibrary : PLAYLIST;
  }

  function formatTime(totalSeconds) {
    if (!Number.isFinite(totalSeconds)) return '0:00';
    const mins = Math.floor(totalSeconds / 60);
    const secs = Math.floor(totalSeconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  function updateProgressUI() {
    if (!progressBar) return;
    const duration = Number.isFinite(music.duration) ? music.duration : 0;
    const current = Number.isFinite(music.currentTime) ? music.currentTime : 0;
    const percent = duration ? (current / duration) * 100 : 0;
    progressBar.value = percent.toFixed(2);
    if (currentTimeEl) currentTimeEl.textContent = formatTime(current);
    if (durationTimeEl) durationTimeEl.textContent = formatTime(duration);
  }

  function goToTrack(index) {
    const list = getActiveList();
    if (!list.length) return;
    currentTrackIndex = (index + list.length) % list.length;
    const track = list[currentTrackIndex];
    music.src = track.src;
    music.load();
    if (titleEl) titleEl.textContent = track.name;
    music.play().then(() => updatePlay()).catch(() => updatePlay());
    updateProgressUI();
    renderMusicLibrary();
  }

  function nextTrack() {
    const list = getActiveList();
    if (list.length <= 1) { music.currentTime = 0; music.play().then(() => updatePlay()).catch(() => {}); return; }
    goToTrack(currentTrackIndex + 1);
  }

  function prevTrack() {
    if (music.currentTime > 2) { music.currentTime = 0; music.play().then(() => updatePlay()).catch(() => {}); return; }
    const list = getActiveList();
    if (list.length <= 1) { music.currentTime = 0; updatePlay(); return; }
    goToTrack(currentTrackIndex - 1);
  }

  function stopTrack() {
    music.pause();
    music.currentTime = 0;
    updateProgressUI();
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
  if (progressBar) {
    progressBar.addEventListener('input', () => {
      if (!Number.isFinite(music.duration) || music.duration === 0) return;
      const nextTime = (Number(progressBar.value) / 100) * music.duration;
      music.currentTime = nextTime;
    });
  }

  music.volume = vol ? vol.value / 100 : 0.8;
  music.loop = false;
  music.addEventListener('ended', () => {
    const list = getActiveList();
    if (loopEnabled && list.length > 0) {
      goToTrack(currentTrackIndex + 1);
      return;
    }
    music.pause();
    music.currentTime = 0;
    updateProgressUI();
    updatePlay();
  });
  music.addEventListener('play', updatePlay);
  music.addEventListener('pause', updatePlay);
  music.addEventListener('timeupdate', updateProgressUI);
  music.addEventListener('loadedmetadata', updateProgressUI);
  music.addEventListener('durationchange', updateProgressUI);

  function updateSongTitle() {
    const list = getActiveList();
    if (titleEl && list[currentTrackIndex]) titleEl.textContent = list[currentTrackIndex].name;
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
  updateProgressUI();

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
      // Note: Polaroids don't need recreation - CSS handles responsive sizing
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
      // Small random rotation for natural scattered look
      const rotation = (Math.random() - 0.5) * 4; // -2 to 2 degrees (reduced from 8)
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


  // ---- Music Library Feature ----
  const musicModal = document.getElementById('musicModal');
  const musicModalClose = document.getElementById('musicModalClose');
  const uploadMusicBtn = document.getElementById('uploadMusicBtn');
  const musicForm = document.getElementById('musicForm');
  const musicFileInput = document.getElementById('musicFile');
  const musicTitleInput = document.getElementById('musicTitle');
  const musicLibraryList = document.getElementById('musicLibraryList');
  const musicLibraryPanel = document.getElementById('musicLibraryPanel');
  const toggleLibraryBtn = document.getElementById('toggleLibraryBtn');
  const loopToggleBtn = document.getElementById('loopToggleBtn');

  let musicLibrary = [];
  let loopEnabled = true;
  let droppedMusicFile = null;

  // Hide music library panel initially (show after login)
  if (musicLibraryPanel) {
    musicLibraryPanel.classList.add('hidden');
  }

  function openMusicModal() { 
    if(!musicModal) return; 
    musicModal.classList.remove('hidden'); 
    musicModal.setAttribute('aria-hidden','false'); 
  }
  function closeMusicModal() { 
    if(!musicModal) return; 
    musicModal.classList.add('hidden'); 
    musicModal.setAttribute('aria-hidden','true'); 
    musicForm.reset(); 
  }

  if(uploadMusicBtn) uploadMusicBtn.addEventListener('click', openMusicModal);
  if(musicModalClose) musicModalClose.addEventListener('click', closeMusicModal);
  if(musicModal) musicModal.addEventListener('click', (e)=>{ if(e.target===musicModal) closeMusicModal(); });

  // Toggle library panel visibility
  if(toggleLibraryBtn && musicLibraryPanel) {
    toggleLibraryBtn.addEventListener('click', () => {
      musicLibraryPanel.classList.toggle('minimized');
    });
  }

  function initLibraryDrag() {
    if (!musicLibraryPanel) return;
    const header = musicLibraryPanel.querySelector('.library-header');
    if (!header) return;

    const savedPos = localStorage.getItem('musicLibraryPos');
    if (savedPos) {
      try {
        const parsed = JSON.parse(savedPos);
        if (Number.isFinite(parsed.left) && Number.isFinite(parsed.top)) {
          musicLibraryPanel.style.left = `${parsed.left}px`;
          musicLibraryPanel.style.top = `${parsed.top}px`;
          musicLibraryPanel.style.right = 'auto';
        }
      } catch (err) {}
    }

    let isDragging = false;
    let startX = 0;
    let startY = 0;
    let startLeft = 0;
    let startTop = 0;
    let panelWidth = 0;
    let panelHeight = 0;

    const onPointerMove = (e) => {
      if (!isDragging) return;
      const nextLeft = Math.min(Math.max(0, startLeft + (e.clientX - startX)), window.innerWidth - panelWidth);
      const nextTop = Math.min(Math.max(0, startTop + (e.clientY - startY)), window.innerHeight - panelHeight);
      musicLibraryPanel.style.left = `${nextLeft}px`;
      musicLibraryPanel.style.top = `${nextTop}px`;
    };

    const onPointerUp = () => {
      if (!isDragging) return;
      isDragging = false;
      musicLibraryPanel.classList.remove('dragging');
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      const rect = musicLibraryPanel.getBoundingClientRect();
      localStorage.setItem('musicLibraryPos', JSON.stringify({ left: rect.left, top: rect.top }));
    };

    header.addEventListener('pointerdown', (e) => {
      if (e.target.closest('.library-btn')) return;
      const rect = musicLibraryPanel.getBoundingClientRect();
      isDragging = true;
      startX = e.clientX;
      startY = e.clientY;
      startLeft = rect.left;
      startTop = rect.top;
      panelWidth = rect.width;
      panelHeight = rect.height;
      musicLibraryPanel.style.right = 'auto';
      musicLibraryPanel.style.left = `${rect.left}px`;
      musicLibraryPanel.style.top = `${rect.top}px`;
      musicLibraryPanel.classList.add('dragging');
      window.addEventListener('pointermove', onPointerMove);
      window.addEventListener('pointerup', onPointerUp);
    });
  }

  // Toggle loop
  if(loopToggleBtn) {
    loopToggleBtn.addEventListener('click', () => {
      loopEnabled = !loopEnabled;
      loopToggleBtn.classList.toggle('active', loopEnabled);
      loopToggleBtn.title = loopEnabled ? 'Loop: ON' : 'Loop: OFF';
    });
    loopToggleBtn.classList.toggle('active', loopEnabled);
  }

  initLibraryDrag();

  // Upload music form
  if(musicForm) {
    musicForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const file = droppedMusicFile || musicFileInput.files[0];
      const title = (musicTitleInput.value || file.name).trim();

      if(!file) { alert('Please select an MP3 file'); return; }
      if(!file.type.includes('audio')) { alert('Please select an audio file'); return; }
      if (!supabaseReady || !supabase) {
        alert('Supabase is not configured. See SUPABASE_SETUP.md');
        return;
      }

      const submitBtn = musicForm.querySelector('button[type="submit"]');
      const origText = submitBtn.textContent;
      submitBtn.disabled = true;
      submitBtn.textContent = 'Uploading…';

      try {
        const music = await uploadMusicToSupabase(file, title);
        if (music) {
          closeMusicModal();
          alert('Music uploaded! 🎵');
          await loadMusicLibrary();
        }
      } catch (err) {
        console.error('Music upload error', err);
        alert('Upload failed: ' + err.message);
      } finally {
        droppedMusicFile = null;
        submitBtn.disabled = false;
        submitBtn.textContent = origText;
      }
    });
  }

  if (musicFileInput) {
    musicFileInput.addEventListener('change', () => {
      droppedMusicFile = null;
    });
  }

  if (musicForm) {
    const setDragState = (isActive) => {
      musicForm.classList.toggle('drag-over', isActive);
    };

    musicForm.addEventListener('dragover', (e) => {
      e.preventDefault();
      setDragState(true);
    });

    musicForm.addEventListener('dragleave', () => setDragState(false));

    musicForm.addEventListener('drop', (e) => {
      e.preventDefault();
      setDragState(false);
      const file = e.dataTransfer.files && e.dataTransfer.files[0];
      if (!file) return;
      if (!file.type.includes('audio')) { alert('Please drop an audio file'); return; }
      droppedMusicFile = file;
      try { musicFileInput.files = e.dataTransfer.files; } catch (err) {}
      if (!musicTitleInput.value) {
        musicTitleInput.value = file.name.replace(/\.mp3$/i, '').replace(/_/g, ' ').trim();
      }
    });
  }

  async function loadMusicLibrary() {
    const raw = await fetchMusicFromSupabase();
    musicLibrary = raw.map(song => ({
      ...song,
      name: song.title,
      src: song.music_url
    }));
    if (musicLibrary.length && currentTrackIndex >= musicLibrary.length) {
      currentTrackIndex = 0;
    }
    updateSongTitle();
    renderMusicLibrary();
  }

  function renderMusicLibrary() {
    if (!musicLibraryList) return;

    if (musicLibrary.length === 0) {
      musicLibraryList.innerHTML = '<div class="library-empty">No songs uploaded yet. Click 📤 to add music!</div>';
      return;
    }

    const isLibraryActive = musicLibrary.length > 0;
    musicLibraryList.innerHTML = musicLibrary.map((song, index) => `
      <div class="library-item ${isLibraryActive && index === currentTrackIndex ? 'playing' : ''}" data-index="${index}">
        <div class="library-info">
          <div class="music-title">${song.name}</div>
          <div class="music-duration">${new Date(song.created_at).toLocaleDateString()}</div>
        </div>
        <div class="library-actions">
          <button class="library-action-btn play-btn" onclick="playMusic(${index})" title="Play">▶</button>
          <button class="library-action-btn delete-btn" onclick="deleteMusicAndRefresh(${index}, '${song.id}')" title="Delete">🗑️</button>
        </div>
      </div>
    `).join('');
  }

  window.playMusic = async function(index) {
    if (index >= musicLibrary.length || index < 0) return;
    currentTrackIndex = index;
    goToTrack(index);
  };

  window.deleteMusicAndRefresh = async function(index, musicId) {
    if (confirm('Delete this song?')) {
      try {
        const song = musicLibrary[index];
        await deleteMusicFromSupabase(musicId, song.filename);
        await loadMusicLibrary();
      } catch (err) {
        alert('Delete failed: ' + err.message);
      }
    }
  };

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
    // Load music library
    await loadMusicLibrary();
    
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
