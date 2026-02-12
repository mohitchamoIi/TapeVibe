// Global variables
let tracks = [];
let currentTrack = 0;
let isPlaying = false;
let isTapeInserted = false;
let recipientName = '';
let currentPlatform = null;
let spotifyIframe = null;
let youtubePlayer = null;
let playerReady = false;

// Photo (local only, not serialized in share URL) 
let photoDataUrl = null;
// Photo upload handler
function handlePhotoUpload(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    if (!file.type || !file.type.startsWith('image/')) {
        alert('Please select an image file.');
        return;
    }

    const reader = new FileReader();
    reader.onload = function(ev) {
        photoDataUrl = ev.target.result;
        const preview = document.getElementById('photoPreview');
        const img = document.getElementById('photoPreviewImg');
        if (img) img.src = photoDataUrl;
        if (preview) {
            preview.style.display = 'flex';
            preview.setAttribute('aria-hidden', 'false');
        }
    };
    reader.readAsDataURL(file);
}

function removePhoto() {
    photoDataUrl = null;
    const photoInput = document.getElementById('photoInput');
    if (photoInput) photoInput.value = '';
    const preview = document.getElementById('photoPreview');
    const img = document.getElementById('photoPreviewImg');
    if (img) img.src = '';
    if (preview) {
        preview.style.display = 'none';
        preview.setAttribute('aria-hidden', 'true');
    }
}

// YouTube API Ready
window.onYouTubeIframeAPIReady = function() {
    console.log('YouTube API Ready');
};

// Spotify Embed Controller using postMessage API
class SpotifyController {
    constructor(iframeElement) {
        this.iframe = iframeElement;
        this.isReady = false;

        // Listen for messages from Spotify iframe
        window.addEventListener('message', (event) => {
            // Only accept messages from the known iframe content window
            try {
                if (!this.iframe || event.source !== this.iframe.contentWindow) return;
            } catch (err) {
                return;
            }

            const data = event.data;
            console.debug('[SpotifyController] message received:', data);

            if (data && data.type === 'ready') {
                this.isReady = true;
                console.log('✓ Spotify player ready');
            }

            if (data && data.type === 'playback_update') {
                // Sync our UI with Spotify player state
                if (data.isPaused) {
                    stopReels();
                } else {
                    startReels();
                }
            }
        });
    }

    play() {
        if (this.isReady && this.iframe) {
            try {
                // Try several message shapes used by different embed types
                this.iframe.contentWindow.postMessage({ command: 'play' }, '*');
                this.iframe.contentWindow.postMessage({ command: 'toggle' }, '*');
                this.iframe.contentWindow.postMessage({ func: 'play' }, '*');
                console.log('▶ Sent play message to Spotify iframe');
            } catch (e) {
                console.warn('Failed to send play message to Spotify iframe:', e);
            }
        }
    }

    pause() {
        if (this.isReady && this.iframe) {
            try {
                this.iframe.contentWindow.postMessage({ command: 'pause' }, '*');
                this.iframe.contentWindow.postMessage({ command: 'toggle' }, '*');
                this.iframe.contentWindow.postMessage({ func: 'pause' }, '*');
                console.log('⏸ Sent pause message to Spotify iframe');
            } catch (e) {
                console.warn('Failed to send pause message to Spotify iframe:', e);
            }
        }
    }

    toggle() {
        if (this.isReady && this.iframe) {
            try {
                this.iframe.contentWindow.postMessage({ command: 'toggle' }, '*');
                console.log('↔ Sent toggle message to Spotify iframe');
            } catch (e) {
                console.warn('Failed to send toggle message to Spotify iframe:', e);
            }
        }
    }
}

let spotifyController = null;
let shareableUrl = window.location.origin + window.location.pathname;

// Platform detection and ID extraction
function detectPlatform(url) {
    url = url.trim();

    // Spotify
    if (url.includes('spotify.com/track/') || url.includes('spotify.com/episode/')) {
        const match = url.match(/\/(track|episode)\/([a-zA-Z0-9]+)/);
        if (match) {
            return { platform: 'spotify', id: match[2], type: match[1] };
        }
    }

    // YouTube
    if (url.includes('youtube.com') || url.includes('youtu.be')) {
        const videoId = extractYouTubeId(url);
        if (videoId) {
            return { platform: 'youtube', id: videoId };
        }
    }

    // SoundCloud
    if (url.includes('soundcloud.com/')) {
        return { platform: 'soundcloud', id: url };
    }

    return null;
}

function extractYouTubeId(url) {
    try {
        if (url.includes('youtu.be/')) {
            const parts = url.split('youtu.be/')[1];
            return parts.split('?')[0].split('&')[0].split('/')[0];
        }
        if (url.includes('youtube.com/watch')) {
            const urlObj = new URL(url);
            return urlObj.searchParams.get('v');
        }
        if (url.includes('youtube.com/embed/')) {
            return url.split('embed/')[1].split('?')[0].split('&')[0];
        }
        if (url.length === 11 && /^[a-zA-Z0-9_-]+$/.test(url)) {
            return url;
        }
    } catch (error) {
        console.error('Error extracting YouTube ID:', error);
    }
    return null;
}

// Play sound effect
function playInsertSound() {
    try {
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const duration = 0.6;
        const sampleRate = audioContext.sampleRate;
        const buffer = audioContext.createBuffer(1, duration * sampleRate, sampleRate);
        const data = buffer.getChannelData(0);

        for (let i = 0; i < buffer.length; i++) {
            const t = i / sampleRate;
            if (t < 0.05) {
                data[i] = (Math.random() * 2 - 1) * 0.3 * (1 - t / 0.05);
            } else if (t < 0.4) {
                const freq = 200 - (t - 0.05) * 300;
                data[i] = Math.sin(2 * Math.PI * freq * t) * 0.15 * (1 - (t - 0.05) / 0.35);
            } else if (t < 0.5) {
                data[i] = (Math.random() * 2 - 1) * 0.25 * (1 - (t - 0.4) / 0.1);
            }
        }

        const source = audioContext.createBufferSource();
        source.buffer = buffer;
        source.connect(audioContext.destination);
        source.start();
    } catch (error) {
        console.log('Sound effect error:', error);
    }
}

// Update preview
document.getElementById('recipientName').addEventListener('input', function(e) {
    const name = e.target.value.trim().toUpperCase() || 'FOR YOU';
    document.getElementById('previewName').textContent = name;
});

// Photo input listeners
const photoInputEl = document.getElementById('photoInput');
if (photoInputEl) photoInputEl.addEventListener('change', handlePhotoUpload);
const removePhotoBtn = document.getElementById('removePhotoBtn');
if (removePhotoBtn) removePhotoBtn.addEventListener('click', removePhoto);

// Add track
let trackCount = 1;
document.getElementById('addTrackBtn').addEventListener('click', function() {
    if (trackCount >= 5) return;

    trackCount++;
    const trackInputsContainer = document.getElementById('trackInputs');

    const newTrackDiv = document.createElement('div');
    newTrackDiv.className = 'track-input';
    newTrackDiv.innerHTML = `
        <span class="track-number">${trackCount}:</span>
        <input 
            type="url" 
            class="music-input" 
            placeholder="Paste Spotify, YouTube, or SoundCloud URL"
            data-track="${trackCount}"
        >
    `;

    trackInputsContainer.appendChild(newTrackDiv);

    this.textContent = `ADD ANOTHER TRACK (${trackCount}/5)`;

    if (trackCount >= 5) {
        this.disabled = true;
        this.textContent = 'MAX TRACKS REACHED';
    }
});

// Create TapeVibe
document.getElementById('createBtn').addEventListener('click', function() {
    recipientName = document.getElementById('recipientName').value.trim() || 'For You';
    const musicInputs = document.querySelectorAll('.music-input');

    tracks = [];
    const invalidUrls = [];

    musicInputs.forEach((input, index) => {
        const url = input.value.trim();
        if (url) {
            const detected = detectPlatform(url);
            if (detected) {
                tracks.push(detected);
                console.log(`Track ${index + 1}:`, detected);
            } else {
                invalidUrls.push(`Track ${index + 1}: Unsupported URL`);
            }
        }
    });

    if (invalidUrls.length > 0) {
        alert('⚠️ Some links are invalid:\n\n' + invalidUrls.join('\n') + '\n\nSupported: Spotify, YouTube, SoundCloud');
        return;
    }

    if (tracks.length === 0) {
        alert('Please add at least one music link!');
        return;
    }

    console.log('✓ Tracks ready:', tracks);

    // Create shareable URL
    const params = new URLSearchParams();
    params.set('tracks', JSON.stringify(tracks));
    params.set('to', recipientName);

    shareableUrl = window.location.origin + window.location.pathname + '?playback&' + params.toString();

    // Update URL
    window.history.pushState({}, '', '?playback&' + params.toString());

    // Show shareable link
    console.log('🔗 Shareable link:', shareableUrl);

    switchToPlayerPage();
});

// Switch to player page
function switchToPlayerPage() {
    document.getElementById('createPage').classList.remove('active');
    document.getElementById('playerPage').classList.add('active');
    showEmptySlot();
}

// Show empty slot
function showEmptySlot() {
    const cassetteSlot = document.getElementById('cassetteSlot');
    cassetteSlot.innerHTML = `
        <div class="empty-slot">
            <div class="slot-opening"></div>
            <button id="insertBtn" class="insert-btn">INSERT</button>
        </div>
    `;

    document.getElementById('trackInfo').textContent = 'NO TAPE';
    document.getElementById('statusLight').classList.remove('active');
    isTapeInserted = false;
    disableControls();

    document.getElementById('insertBtn').addEventListener('click', insertTape);
}

// Insert tape
function insertTape() {
    playInsertSound();

    const cassetteSlot = document.getElementById('cassetteSlot');
    cassetteSlot.innerHTML = `
        <div class="cassette inserted-cassette" style="width: 400px; height: 250px;">
            <div class="cassette-top">
                <div class="screw"></div>
                <div class="label">
                    <div class="label-text">${recipientName.toUpperCase()}</div>
                    <div class="label-line"></div>
                </div>
                <div class="screw"></div>
            </div>
            <div class="cassette-body">
                <div class="cassette-window">
                    <div class="reel left">
                        <div class="reel-center"></div>
                        <div class="reel-teeth"></div>
                    </div>
                    <div class="tape-visible"></div>
                    <div class="reel right">
                        <div class="reel-center"></div>
                        <div class="reel-teeth"></div>
                    </div>
                </div>
                <div class="cassette-holes">
                    <div class="hole"></div>
                    <div class="side-label">A</div>
                    <div class="hole"></div>
                </div>
            </div>
        </div>
        <button id="ejectBtn" class="eject-btn">EJECT</button>
    `;

    // If a photo was added, insert a framed photo into the cassette window
    if (photoDataUrl) {
        const cassetteWindow = cassetteSlot.querySelector('.cassette-window');
        if (cassetteWindow) {
            const photoHtml = `
                <div class="photo-frame" style="width:120px;height:120px;">
                    <img src="${photoDataUrl}" alt="Inserted photo">
                    <div class="heart-frame" aria-hidden="true">
                        <div class="heart h1"></div>
                        <div class="heart h2"></div>
                        <div class="heart h3"></div>
                        <div class="heart h4"></div>
                        <div class="heart h5"></div>
                        <div class="heart h6"></div>
                    </div>
                </div>
            `;
            cassetteWindow.insertAdjacentHTML('afterbegin', photoHtml);
        }
    }

    currentTrack = 0;
    document.getElementById('trackInfo').textContent = `TRACK 1/${tracks.length}`;
    document.getElementById('statusLight').classList.add('active');
    isTapeInserted = true;
    enableControls();

    loadTrack(0);

    document.getElementById('ejectBtn').addEventListener('click', ejectTape);
}

// Detect if mobile
function isMobile() {
    return window.innerWidth <= 768;
}

// Load track based on platform
function loadTrack(index) {
    const track = tracks[index];
    currentPlatform = track.platform;

    const playerFrame = document.getElementById('playerFrame');
    document.getElementById('platformName').textContent = track.platform.charAt(0).toUpperCase() + track.platform.slice(1);

    console.log('Loading track:', track);

    if (track.platform === 'spotify') {
        // Responsive Spotify player with API enabled
        const mobile = isMobile();
        const playerWidth = mobile ? '100%' : '400px';
        const playerHeight = mobile ? '80px' : '152px';
        const bottom = mobile ? '80px' : '20px';
        const right = mobile ? '0' : '20px';
        const left = mobile ? '0' : 'auto';

        playerFrame.innerHTML = `
            <iframe 
                style="border-radius:${mobile ? '0' : '12px'}; box-shadow: 0 4px 15px rgba(0,0,0,0.2);" 
                src="https://open.spotify.com/embed/track/${track.id}?utm_source=generator&theme=0" 
                width="100%" 
                height="${playerHeight}" 
                frameBorder="0" 
                allowfullscreen="" 
                allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" 
                loading="lazy"
                id="spotifyFrame">
            </iframe>
        `;

        // Position player responsively
        playerFrame.style.position = 'fixed';
        playerFrame.style.bottom = bottom;
        playerFrame.style.right = right;
        playerFrame.style.left = left;
        playerFrame.style.width = playerWidth;
        playerFrame.style.height = playerHeight;
        playerFrame.style.zIndex = '9999';
        playerFrame.style.opacity = '1';
        playerFrame.style.pointerEvents = 'all';
        playerFrame.style.margin = mobile ? '0' : 'auto';

        // Initialize Spotify controller after iframe loads
        setTimeout(() => {
            spotifyIframe = document.getElementById('spotifyFrame');
            if (spotifyIframe) {
                spotifyController = new SpotifyController(spotifyIframe);
                console.log('✓ Spotify controller initialized');
            }
        }, 1000);

        console.log('✓ Spotify player loaded');

        // Start with paused state - user will click play
        stopReels();

    } else if (track.platform === 'youtube') {
        playerFrame.innerHTML = '<div id="youtubePlayerDiv"></div>';
        playerFrame.style.position = 'fixed';
        playerFrame.style.bottom = '-500px';
        playerFrame.style.opacity = '0';
        initYouTubePlayer(track.id);
    } else if (track.platform === 'soundcloud') {
        const mobile = isMobile();
        const playerWidth = mobile ? '100%' : '400px';

        playerFrame.innerHTML = `
            <iframe 
                width="100%" 
                height="166" 
                scrolling="no" 
                frameborder="no" 
                allow="autoplay" 
                src="https://w.soundcloud.com/player/?url=${encodeURIComponent(track.id)}&color=%238b5a3c&auto_play=false&hide_related=true&show_comments=false&show_user=true&show_reposts=false&show_teaser=false"
                id="soundcloudFrame">
            </iframe>
        `;

        playerFrame.style.position = 'fixed';
        playerFrame.style.bottom = mobile ? '80px' : '20px';
        playerFrame.style.right = mobile ? '0' : '20px';
        playerFrame.style.left = mobile ? '0' : 'auto';
        playerFrame.style.width = playerWidth;
        playerFrame.style.height = '166px';
        playerFrame.style.zIndex = '9999';
        playerFrame.style.opacity = '1';
        playerFrame.style.pointerEvents = 'all';

        console.log('✓ SoundCloud player loaded');
        stopReels();
    }
}

// YouTube player initialization
function initYouTubePlayer(videoId) {
    if (typeof YT !== 'undefined' && YT.Player) {
        youtubePlayer = new YT.Player('youtubePlayerDiv', {
            height: '360',
            width: '640',
            videoId: videoId,
            playerVars: {
                'autoplay': 0,
                'controls': 1
            },
            events: {
                'onReady': (e) => {
                    console.log('✓ YouTube ready');
                    stopReels();
                },
                'onStateChange': (e) => {
                    if (e.data === YT.PlayerState.PLAYING) {
                        startReels();
                    } else if (e.data === YT.PlayerState.PAUSED) {
                        stopReels();
                    } else if (e.data === YT.PlayerState.ENDED) {
                        nextTrack();
                    }
                }
            }
        });
    } else {
        setTimeout(() => initYouTubePlayer(videoId), 500);
    }
}

// Eject tape
function ejectTape() {
    stopPlayback();

    const cassette = document.querySelector('.cassette');
    if (cassette) {
        cassette.classList.add('ejecting-cassette');
        setTimeout(() => showEmptySlot(), 600);
    }
}

// Controls
function enableControls() {
    document.getElementById('playBtn').disabled = false;
    document.getElementById('prevBtn').disabled = false;
    document.getElementById('nextBtn').disabled = false;
}

function disableControls() {
    document.getElementById('playBtn').disabled = true;
    document.getElementById('prevBtn').disabled = true;
    document.getElementById('nextBtn').disabled = true;
}

document.getElementById('playBtn').addEventListener('click', togglePlay);
document.getElementById('prevBtn').addEventListener('click', () => { if(isTapeInserted) previousTrack(); });
document.getElementById('nextBtn').addEventListener('click', () => { if(isTapeInserted) nextTrack(); });

function togglePlay() {
    if (!isTapeInserted) return;

    console.debug('[TapeVibe] togglePlay called', { currentPlatform, isPlaying, spotifyControllerReady: spotifyController ? spotifyController.isReady : false });

    // Spotify: we try to control via controller, but also update UI optimistically
    if (currentPlatform === 'spotify') {
        // Optimistic UI
        if (isPlaying) {
            stopReels();
        } else {
            startReels();
        }

        // If we can control Spotify via controller, prefer explicit play/pause
        if (spotifyController && spotifyController.isReady) {
            try {
                // Try explicit commands if available
                if (isPlaying) {
                    spotifyController.pause();
                } else {
                    spotifyController.play();
                }
            } catch (e) {
                console.warn('Spotify control failed:', e);
                showTempTrackStatus('Could not control Spotify automatically. Try inside the widget.');
            }
        } else {
            // Attempt to initialize the controller if iframe exists (race condition fix)
            spotifyIframe = document.getElementById('spotifyFrame');
            if (spotifyIframe && !spotifyController) {
                spotifyController = new SpotifyController(spotifyIframe);
                console.log('[TapeVibe] Attempting Spotify controller init (fallback)');
            }

            // Give the user a hint if automatic control isn't available
            showTempTrackStatus();
        }

        return;
    }

    // YouTube: defer to player API
    if (currentPlatform === 'youtube' && youtubePlayer) {
        console.debug('[TapeVibe] YouTube toggle, isPlaying:', isPlaying);
        if (isPlaying) {
            youtubePlayer.pauseVideo();
        } else {
            youtubePlayer.playVideo();
        }
        return;
    }

    // SoundCloud or other: fallback to local UI toggle
    console.debug('[TapeVibe] Fallback toggle for platform:', currentPlatform);
    if (isPlaying) {
        stopReels();
    } else {
        startReels();
    }
}

// small helper to show a short message in the track display area
function showTempTrackStatus(message, ms = 2500) {
    const trackInfo = document.getElementById('trackInfo');
    if (!trackInfo) return;
    const prev = trackInfo.textContent;
    trackInfo.textContent = message;
    setTimeout(() => {
        trackInfo.textContent = prev;
    }, ms);
}

function startReels() {
    const reels = document.querySelectorAll('.reel');
    reels.forEach(r => r.classList.add('spinning'));
    // animate photo(s)
    document.querySelectorAll('.photo-frame').forEach(p => p.classList.add('playing'));
    isPlaying = true;
    const playSpan = document.querySelector('#playBtn span');
    if (playSpan) playSpan.textContent = '⏸';
    console.debug('[TapeVibe] startReels -> isPlaying = true');
}

function stopReels() {
    const reels = document.querySelectorAll('.reel');
    reels.forEach(r => r.classList.remove('spinning'));
    isPlaying = false;
    const playSpan = document.querySelector('#playBtn span');
    if (playSpan) playSpan.textContent = '▶';
    // stop photo animation
    document.querySelectorAll('.photo-frame').forEach(p => p.classList.remove('playing'));
    console.debug('[TapeVibe] stopReels -> isPlaying = false');
}

function stopReels() {
    const reels = document.querySelectorAll('.reel');
    reels.forEach(r => r.classList.remove('spinning'));
    isPlaying = false;
    document.querySelector('#playBtn span').textContent = '▶';
}

function stopPlayback() {
    if (youtubePlayer && youtubePlayer.stopVideo) {
        youtubePlayer.stopVideo();
    }

    // Clean up Spotify controller
    spotifyController = null;
    spotifyIframe = null;

    // Hide player
    const playerFrame = document.getElementById('playerFrame');
    playerFrame.innerHTML = '';
    playerFrame.style.opacity = '0';
    playerFrame.style.pointerEvents = 'none';

    stopReels();
}

function nextTrack() {
    if (currentTrack < tracks.length - 1) {
        currentTrack++;
        stopPlayback();
        setTimeout(() => {
            loadTrack(currentTrack);
            updateTrackDisplay();
        }, 300);
    }
}

function previousTrack() {
    if (currentTrack > 0) {
        currentTrack--;
        stopPlayback();
        setTimeout(() => {
            loadTrack(currentTrack);
            updateTrackDisplay();
        }, 300);
    }
}

function updateTrackDisplay() {
    document.getElementById('trackInfo').textContent = `TRACK ${currentTrack + 1}/${tracks.length}`;
}

// Create new link
document.getElementById('createNewLink').addEventListener('click', function(e) {
    e.preventDefault();
    stopPlayback();
    tracks = [];
    currentTrack = 0;

    window.history.pushState({}, '', window.location.pathname);
    document.getElementById('playerPage').classList.remove('active');
    document.getElementById('createPage').classList.add('active');
});

// Handle window resize
window.addEventListener('resize', () => {
    if (isTapeInserted && currentPlatform) {
        const tempTrack = currentTrack;
        stopPlayback();
        setTimeout(() => loadTrack(tempTrack), 100);
    }
});

// Load from URL - CRUCIAL FOR SHARING
window.addEventListener('load', function() {
    const urlParams = new URLSearchParams(window.location.search);

    if (urlParams.has('playback')) {
        const tracksParam = urlParams.get('tracks');
        recipientName = urlParams.get('to') || 'For You';

        if (tracksParam) {
            try {
                tracks = JSON.parse(tracksParam);
                console.log('✓ Loaded shared TapeVibe:', tracks);
                console.log('✓ For:', recipientName);
                switchToPlayerPage();

                // Auto-insert tape for shared links
                setTimeout(() => {
                    const insertBtn = document.getElementById('insertBtn');
                    if (insertBtn) {
                        insertBtn.click();
                    }
                }, 500);
            } catch (error) {
                console.error('Error loading tracks:', error);
                alert('⚠️ Invalid TapeVibe link. Please create a new one!');
            }
        }
    }
});

// --- Share functionality ---
function updateShareableUrlToCurrent() {
    shareableUrl = window.location.href;
}


document.getElementById('shareBtn')?.addEventListener('click', openShareModal);

document.getElementById('shareNativeBtn')?.addEventListener('click', async function() {
    const url = shareableUrl || window.location.href;
    if (navigator.share) {
        try {
            await navigator.share({ title: 'TapeVibe', text: 'Check out this TapeVibe!', url });
            closeShareModal();
        } catch (err) {
            console.log('Share canceled or failed', err);
        }
    } else {
        // Fallback: copy link
        copyLink();
    }
});


document.getElementById('shareCopyBtn')?.addEventListener('click', copyLink);
document.getElementById('shareWhatsAppBtn')?.addEventListener('click', () => openExternalShare('https://wa.me/?text='));
document.getElementById('shareTelegramBtn')?.addEventListener('click', () => openExternalShare('https://t.me/share/url?url='));
document.getElementById('shareTwitterBtn')?.addEventListener('click', () => openExternalShare('https://twitter.com/intent/tweet?text='));
document.getElementById('shareEmailBtn')?.addEventListener('click', () => {
    const url = encodeURIComponent(shareableUrl || window.location.href);
    window.open(`mailto:?subject=${encodeURIComponent('TapeVibe')}&body=${encodeURIComponent('Check this TapeVibe: ')}%20${url}`, '_self');
    closeShareModal();
});
document.getElementById('shareInstagramBtn')?.addEventListener('click', () => {
    copyLink().then(() => {
        alert('Link copied — Instagram posts do not accept link-only posts. Paste link in DM or your bio.');
    });
});

document.getElementById('shareCloseBtn')?.addEventListener('click', closeShareModal);
document.getElementById('shareOverlay')?.addEventListener('click', closeShareModal);

function openShareModal() {
    updateShareableUrlToCurrent();
    const modal = document.getElementById('shareModal');
    const input = document.getElementById('shareCopyInput');
    const status = document.getElementById('shareStatus');
    if (!modal) return;
    input.value = shareableUrl || window.location.href;
    status.textContent = '';
    modal.classList.add('open');
    modal.setAttribute('aria-hidden', 'false');

    // Make it easy to copy: focus and select the URL
    try {
        input.focus();
        input.select();
    } catch (e) {}
}

function closeShareModal() {
    const modal = document.getElementById('shareModal');
    if (!modal) return;
    modal.classList.remove('open');
    modal.setAttribute('aria-hidden', 'true');
}

async function copyLink() {
    const url = shareableUrl || window.location.href;
    const status = document.getElementById('shareStatus');
    const input = document.getElementById('shareCopyInput');

    // Keep the input value updated so the user can see/copy it manually if needed
    if (input) input.value = url;

    try {
        // Preferred modern API
        if (navigator.clipboard && navigator.clipboard.writeText) {
            await navigator.clipboard.writeText(url);
            if (status) status.textContent = 'Copied to clipboard ✅';
            return Promise.resolve();
        }

        // Fallback: use the visible input inside the modal if present
        if (input) {
            input.removeAttribute('readonly');
            input.focus();
            input.select();
            try {
                // For mobile browsers, ensure selection range
                input.setSelectionRange(0, 99999);
            } catch (e) {}

            const ok = document.execCommand && document.execCommand('copy');
            input.setAttribute('readonly', 'true');

            if (ok) {
                if (status) status.textContent = 'Copied to clipboard ✅';
                return Promise.resolve();
            } else {
                if (status) status.textContent = 'Automatic copy failed — link selected. Press Ctrl+C (or long-press) to copy.';
                return Promise.reject(new Error('execCommand failed'));
            }
        }

        // Final fallback: off-screen temporary input
        const temp = document.createElement('input');
        temp.style.position = 'absolute';
        temp.style.left = '-9999px';
        temp.value = url;
        document.body.appendChild(temp);
        temp.select();
        try {
            temp.setSelectionRange(0, 99999);
        } catch (e) {}
        const ok = document.execCommand && document.execCommand('copy');
        document.body.removeChild(temp);
        if (ok) {
            if (status) status.textContent = 'Copied to clipboard ✅';
            return Promise.resolve();
        }

        if (status) status.textContent = 'Automatic copy failed — link selected. Press Ctrl+C (or long-press) to copy.';
        return Promise.reject(new Error('execCommand failed'));
    } catch (err) {
        // Helpful feedback for insecure contexts
        if (!window.isSecureContext && status) {
            status.textContent = 'Automatic copy is blocked on file:// or non-secure pages — please copy the link manually.';
        } else if (status) {
            status.textContent = 'Copy failed — please copy manually (link selected).';
        }

        // Focus and select the input so user can copy manually
        if (input) {
            input.removeAttribute('readonly');
            input.focus();
            try { input.select(); } catch (e) {}
        }

        return Promise.reject(err);
    }
}

function openExternalShare(base) {
    const url = shareableUrl || window.location.href;
    const text = encodeURIComponent('Check out my TapeVibe: ' + url);
    const shareUrl = base + encodeURIComponent(url) + (base.includes('intent') ? '&via=TapVibe' : (base.includes('wa.me') ? encodeURIComponent('Check out my TapeVibe: ' + url) : ''));
    // For WhatsApp we want wa.me/?text=encodedMessage
    if (base.includes('wa.me')) {
        window.open(`https://wa.me/?text=${encodeURIComponent('Check out my TapeVibe: ' + url)}`, '_blank');
    } else if (base.includes('t.me')) {
        window.open(`https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent('Check out my TapeVibe!')}`, '_blank');
    } else if (base.includes('twitter.com')) {
        window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent('Check out my TapeVibe: ' + url)}`, '_blank');
    } else {
        window.open(shareUrl, '_blank');
    }
    closeShareModal();

}
