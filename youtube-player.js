// ========== YOUTUBE PLAYER MODULE - EASY TO REMOVE ==========
// To disable: Set ENABLE_YOUTUBE_PLAYER = false
// To remove completely: Delete this file + see YOUTUBE_REMOVAL.md

const ENABLE_YOUTUBE_PLAYER = true;

if (ENABLE_YOUTUBE_PLAYER) {
  // YouTube Queue Management System
  let youtubeQueue = [];
  let currentYouTubeIndex = 0;
  let youtubePlayer = null;
  let isYouTubeMode = false;
  let playerReady = false;

  // Load queue from localStorage
  function loadQueueFromStorage() {
    try {
      const saved = localStorage.getItem('valentines_youtube_queue');
      if (saved) {
        youtubeQueue = JSON.parse(saved);
        renderQueue();
      }
    } catch (e) {
      console.warn('Failed to load YouTube queue:', e);
    }
  }

  // Save queue to localStorage
  function saveQueueToStorage() {
    try {
      localStorage.setItem('valentines_youtube_queue', JSON.stringify(youtubeQueue));
    } catch (e) {
      console.warn('Failed to save YouTube queue:', e);
    }
  }

  // Extract YouTube video ID from URL
  function extractYouTubeID(url) {
    const patterns = [
      /(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/,
      /youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/,
      /youtube\.com\/v\/([a-zA-Z0-9_-]{11})/
    ];
    
    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match) return match[1];
    }
    return null;
  }

  // Load YouTube IFrame API
  function loadYouTubeAPI() {
    if (window.YT && window.YT.Player) {
      console.log('YouTube API already loaded');
      initYouTubePlayer();
      return;
    }

    console.log('Loading YouTube IFrame API...');
    const tag = document.createElement('script');
    tag.src = 'https://www.youtube.com/iframe_api';
    const firstScriptTag = document.getElementsByTagName('script')[0];
    firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);

    window.onYouTubeIframeAPIReady = function() {
      console.log('YouTube IFrame API Ready callback fired');
      initYouTubePlayer();
    };
  }

  // Initialize YouTube player (hidden iframe)
  function initYouTubePlayer() {
    const playerDiv = document.getElementById('youtube-player-container');
    if (!playerDiv) {
      console.error('youtube-player-container not found');
      return;
    }

    console.log('Initializing YouTube player...');
    try {
      youtubePlayer = new YT.Player('youtube-player-container', {
        height: '113',
        width: '200',
        playerVars: {
          autoplay: 1,
          controls: 1,
          disablekb: 0,
          fs: 1,
          modestbranding: 1,
          playsinline: 1,
          allowFullScreen: true
        },
        events: {
          onReady: onPlayerReady,
          onStateChange: onPlayerStateChange,
          onError: onPlayerError
        }
      });
    } catch (e) {
      console.error('Failed to initialize YouTube player:', e);
    }
  }

  function onPlayerError(event) {
    console.error('YouTube Player Error:', event.data);
    // Error codes: 2 = Invalid param, 5 = HTML5 player error, 100 = Video not found, 101 = Video not allowed to be played embedded, 150 = Same as 101
  }

  function onPlayerReady(event) {
    playerReady = true;
    console.log('YouTube player ready');
    
    // Sync volume with slider
    const volumeSlider = document.getElementById('volumeSlider');
    if (volumeSlider && youtubePlayer) {
      youtubePlayer.setVolume(volumeSlider.value);
      volumeSlider.addEventListener('input', () => {
        if (youtubePlayer && isYouTubeMode) {
          youtubePlayer.setVolume(volumeSlider.value);
        }
      });
    }
  }

  function onPlayerStateChange(event) {
    const playPauseBtn = document.getElementById('playPause');
    
    console.log('Player state changed:', event.data, 'Ready:', playerReady);
    
    if (event.data === YT.PlayerState.ENDED) {
      console.log('Song ended, playing next...');
      // Play next song in queue
      playNextInQueue();
    } else if (event.data === YT.PlayerState.PLAYING) {
      console.log('Song is now playing');
      if (playPauseBtn) playPauseBtn.textContent = 'Pause';
      updateNowPlaying();
    } else if (event.data === YT.PlayerState.PAUSED) {
      console.log('Song paused');
      if (playPauseBtn) playPauseBtn.textContent = 'Play';
    } else if (event.data === YT.PlayerState.BUFFERING) {
      console.log('Buffering...');
    } else if (event.data === YT.PlayerState.CUED) {
      console.log('Video cued and ready');
    } else if (event.data === YT.PlayerState.UNSTARTED) {
      console.log('Video unstarted');
    }
  }

  // Add song to queue
  async function addToQueue(url) {
    const videoId = extractYouTubeID(url);
    if (!videoId) {
      alert('Invalid YouTube URL. Please use a valid youtube.com or youtu.be link.');
      return false;
    }

    // Check if already in queue
    if (youtubeQueue.some(song => song.videoId === videoId)) {
      alert('This song is already in the queue!');
      return false;
    }

    // Fetch video title using YouTube oEmbed API
    let title = 'YouTube Video';
    try {
      const response = await fetch(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`);
      if (response.ok) {
        const data = await response.json();
        title = data.title || title;
      }
    } catch (e) {
      console.warn('Failed to fetch video title:', e);
    }

    const song = {
      videoId: videoId,
      title: title,
      url: url,
      thumbnail: `https://img.youtube.com/vi/${videoId}/default.jpg`,
      addedAt: Date.now()
    };

    youtubeQueue.push(song);
    saveQueueToStorage();
    renderQueue();
    
    return true;
  }

  // Remove song from queue
  function removeFromQueue(index) {
    if (index === currentYouTubeIndex && isYouTubeMode) {
      // If removing currently playing song, stop it
      if (youtubePlayer && playerReady) {
        youtubePlayer.stopVideo();
      }
    }

    youtubeQueue.splice(index, 1);
    
    // Adjust current index if needed
    if (currentYouTubeIndex >= youtubeQueue.length) {
      currentYouTubeIndex = Math.max(0, youtubeQueue.length - 1);
    }
    
    saveQueueToStorage();
    renderQueue();
  }

  // Play song at specific index
  function playSongAtIndex(index) {
    if (!youtubeQueue[index]) {
      console.error('Song not found at index', index);
      return;
    }
    
    currentYouTubeIndex = index;
    isYouTubeMode = true;
    
    if (!playerReady) {
      console.log('Player not ready, loading YouTube API...');
      loadYouTubeAPI();
      setTimeout(() => playSongAtIndex(index), 1000);
      return;
    }

    const song = youtubeQueue[index];
    console.log('Playing song:', song.title, 'VideoID:', song.videoId);
    
    if (!youtubePlayer) {
      console.error('YouTube player not initialized');
      return;
    }

    // Pause original music player
    const originalMusic = document.querySelector('audio');
    if (originalMusic) originalMusic.pause();

    // Use cueVideoById first, then play after a short delay to ensure it's loaded
    youtubePlayer.cueVideoById(song.videoId);
    
    setTimeout(() => {
      console.log('Attempting to play video after cue...');
      youtubePlayer.playVideo();
    }, 500);
    
    renderQueue();
    updateNowPlaying();
  }

  // Play next song in queue
  function playNextInQueue() {
    if (youtubeQueue.length === 0) return;
    
    currentYouTubeIndex = (currentYouTubeIndex + 1) % youtubeQueue.length;
    playSongAtIndex(currentYouTubeIndex);
  }

  // Play previous song in queue
  function playPrevInQueue() {
    if (youtubeQueue.length === 0) return;
    
    currentYouTubeIndex = (currentYouTubeIndex - 1 + youtubeQueue.length) % youtubeQueue.length;
    playSongAtIndex(currentYouTubeIndex);
  }

  // Update now playing display
  function updateNowPlaying() {
    const songTitle = document.getElementById('songTitle');
    if (songTitle && isYouTubeMode && youtubeQueue[currentYouTubeIndex]) {
      songTitle.textContent = youtubeQueue[currentYouTubeIndex].title;
    }
  }

  // Render queue UI
  function renderQueue() {
    const queueList = document.getElementById('youtubeQueueList');
    if (!queueList) return;

    if (youtubeQueue.length === 0) {
      queueList.innerHTML = '<div class="queue-empty">No songs in queue. Add your first song!</div>';
      return;
    }

    queueList.innerHTML = youtubeQueue.map((song, index) => `
      <div class="queue-item ${index === currentYouTubeIndex && isYouTubeMode ? 'now-playing' : ''}" data-index="${index}">
        <img src="${song.thumbnail}" alt="${song.title}" class="queue-thumbnail">
        <div class="queue-info">
          <div class="queue-title">${song.title}</div>
          ${index === currentYouTubeIndex && isYouTubeMode ? '<div class="queue-status">▶ Now Playing</div>' : ''}
        </div>
        <button class="queue-action-btn play-btn" onclick="youtubeMusicPlayer.play(${index})" title="Play this song">▶</button>
        <button class="queue-action-btn remove-btn" onclick="youtubeMusicPlayer.remove(${index})" title="Remove from queue">✕</button>
      </div>
    `).join('');
  }

  // UI Event Handlers
  document.addEventListener('DOMContentLoaded', () => {
    loadQueueFromStorage();

    // Hide queue initially (show after login)
    const youtubeQueue = document.getElementById('youtubeQueue');
    if (youtubeQueue) {
      youtubeQueue.classList.add('hidden');
    }

    // Add Song button
    const addSongBtn = document.getElementById('addSongBtn');
    const youtubeModal = document.getElementById('youtubeModal');
    const youtubeModalClose = document.getElementById('youtubeModalClose');
    const youtubeForm = document.getElementById('youtubeForm');
    const youtubeUrl = document.getElementById('youtubeUrl');

    if (addSongBtn) {
      addSongBtn.addEventListener('click', () => {
        youtubeModal.classList.remove('hidden');
        youtubeModal.setAttribute('aria-hidden', 'false');
        youtubeUrl.focus();
      });
    }

    if (youtubeModalClose) {
      youtubeModalClose.addEventListener('click', () => {
        youtubeModal.classList.add('hidden');
        youtubeModal.setAttribute('aria-hidden', 'true');
        youtubeForm.reset();
      });
    }

    if (youtubeModal) {
      youtubeModal.addEventListener('click', (e) => {
        if (e.target === youtubeModal) {
          youtubeModal.classList.add('hidden');
          youtubeModal.setAttribute('aria-hidden', 'true');
          youtubeForm.reset();
        }
      });
    }

    if (youtubeForm) {
      youtubeForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const url = youtubeUrl.value.trim();
        
        if (!url) {
          alert('Please enter a YouTube URL');
          return;
        }

        const submitBtn = youtubeForm.querySelector('button[type="submit"]');
        const originalText = submitBtn.textContent;
        submitBtn.disabled = true;
        submitBtn.textContent = 'Adding...';

        const success = await addToQueue(url);
        
        submitBtn.disabled = false;
        submitBtn.textContent = originalText;

        if (success) {
          youtubeModal.classList.add('hidden');
          youtubeModal.setAttribute('aria-hidden', 'true');
          youtubeForm.reset();
          
          // Show queue panel
          const queuePanel = document.getElementById('youtubeQueue');
          if (queuePanel) queuePanel.classList.remove('minimized');
        }
      });
    }

    // Toggle queue panel
    const toggleQueueBtn = document.getElementById('toggleQueueBtn');
    const queuePanel = document.getElementById('youtubeQueue');
    
    if (toggleQueueBtn && queuePanel) {
      toggleQueueBtn.addEventListener('click', () => {
        queuePanel.classList.toggle('minimized');
      });
    }

    // Clear queue button
    const clearQueueBtn = document.getElementById('clearQueueBtn');
    if (clearQueueBtn) {
      clearQueueBtn.addEventListener('click', () => {
        window.youtubeMusicPlayer.clearQueue();
      });
    }

    // Override music player controls when in YouTube mode
    const playPauseBtn = document.getElementById('playPause');
    const prevBtn = document.getElementById('prevBtn');
    const nextBtn = document.getElementById('nextBtn');
    const stopBtn = document.getElementById('stopBtn');

    if (playPauseBtn) {
      playPauseBtn.addEventListener('click', () => {
        if (isYouTubeMode && youtubePlayer && playerReady) {
          const state = youtubePlayer.getPlayerState();
          if (state === YT.PlayerState.PLAYING) {
            youtubePlayer.pauseVideo();
          } else {
            youtubePlayer.playVideo();
          }
        }
      });
    }

    if (prevBtn) {
      prevBtn.addEventListener('click', () => {
        if (isYouTubeMode && youtubeQueue.length > 0) {
          playPrevInQueue();
        }
      });
    }

    if (nextBtn) {
      nextBtn.addEventListener('click', () => {
        if (isYouTubeMode && youtubeQueue.length > 0) {
          playNextInQueue();
        }
      });
    }

    if (stopBtn) {
      stopBtn.addEventListener('click', () => {
        if (isYouTubeMode && youtubePlayer && playerReady) {
          youtubePlayer.stopVideo();
          isYouTubeMode = false;
          const songTitle = document.getElementById('songTitle');
          if (songTitle) songTitle.textContent = '—';
        }
      });
    }
  });

  // Public API
  window.youtubeMusicPlayer = {
    add: addToQueue,
    remove: removeFromQueue,
    play: playSongAtIndex,
    next: playNextInQueue,
    prev: playPrevInQueue,
    getQueue: () => [...youtubeQueue],
    clearQueue: () => {
      youtubeQueue = [];
      currentYouTubeIndex = 0;
      saveQueueToStorage();
      renderQueue();
    },
    showQueue: () => {
      const queuePanel = document.getElementById('youtubeQueue');
      if (queuePanel) queuePanel.classList.remove('hidden');
    }
  };

  // Show queue when main element becomes visible (after login)
  function observeMainElement() {
    const main = document.getElementById('main');
    const youtubeQueue = document.getElementById('youtubeQueue');
    
    if (!main || !youtubeQueue) return;
    
    const observer = new MutationObserver(() => {
      if (!main.classList.contains('hidden')) {
        youtubeQueue.classList.remove('hidden');
      }
    });
    
    observer.observe(main, { attributes: true, attributeFilter: ['class'] });
  }
  
  observeMainElement();

  console.log('YouTube Music Player loaded. Use window.youtubeMusicPlayer to access API.');
}
