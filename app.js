document.addEventListener('DOMContentLoaded', () => {
    const app = document.getElementById('app-content');
    const canvas = document.getElementById('box-canvas');
    const container = document.querySelector('.container');
    canvas.width = container.clientWidth / 2;
    canvas.height = container.clientHeight;
    const state = {
        isPlaying: false,
        count: 0,
        totalTime: 0,
        soundEnabled: false,
        timeLimit: '',
        sessionComplete: false,
        timeLimitReached: false,
        phaseTime: 5.5,
        pulseStartTime: null,
        phaseStartTime: null,
        lastTotalUpdate: null
    };
    let wakeLock = null;
    let audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const icons = {
        play: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>',
        pause: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg>',
        volume2: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M19 10a4 4 0 0 1 0 4"></path><path d="M23 6a8 8 0 0 1 0 12"></path></svg>',
        volumeX: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><line x1="23" y1="9" x2="17" y2="15"></line><line x1="17" y1="9" x2="23" y2="15"></line></svg>',
        rotateCcw: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="1 4 1 10 7 10"></polyline><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"></path></svg>',
        clock: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>'
    };
    function getInstruction(count) {
        switch (count) {
            case 0: return 'Inhale';
            case 1: return 'Exhale';
            default: return '';
        }
    }
    function formatTime(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    function playTone() {
        if (state.soundEnabled && audioContext) {
            try {
                const oscillator = audioContext.createOscillator();
                oscillator.type = 'sine';
                oscillator.frequency.setValueAtTime(440, audioContext.currentTime);
                oscillator.connect(audioContext.destination);
                oscillator.start();
                oscillator.stop(audioContext.currentTime + 0.1);
            } catch (e) {
                console.error('Error playing tone:', e);
            }
        }
    }
    let renderInterval;
    let animationFrameId;
    async function requestWakeLock() {
        if ('wakeLock' in navigator) {
            try {
                wakeLock = await navigator.wakeLock.request('screen');
                console.log('Wake lock is active');
            } catch (err) {
                console.error('Failed to acquire wake lock:', err);
            }
        } else {
            console.log('Wake Lock API not supported');
        }
    }
    function releaseWakeLock() {
        if (wakeLock !== null) {
            wakeLock.release()
                .then(() => {
                    wakeLock = null;
                    console.log('Wake lock released');
                })
                .catch(err => {
                    console.error('Failed to release wake lock:', err);
                });
        }
    }
    function togglePlay() {
        state.isPlaying = !state.isPlaying;
        if (state.isPlaying) {
            document.body.classList.add('playing');
            if (audioContext && audioContext.state === 'suspended') {
                audioContext.resume().then(() => {
                    console.log('AudioContext resumed');
                });
            }
            state.totalTime = 0;
            state.count = 0;
            state.sessionComplete = false;
            state.timeLimitReached = false;
            state.phaseStartTime = performance.now();
            state.pulseStartTime = performance.now();
            state.lastTotalUpdate = performance.now();
            playTone();
            animate();
            requestWakeLock();
            renderInterval = setInterval(render, 200);
        } else {
            document.body.classList.remove('playing');
            clearInterval(renderInterval);
            cancelAnimationFrame(animationFrameId);
            const ctx = canvas.getContext('2d');
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            releaseWakeLock();
        }
        render();
    }
    function resetToStart() {
        state.isPlaying = false;
        state.totalTime = 0;
        state.count = 0;
        state.sessionComplete = false;
        state.timeLimit = '';
        state.timeLimitReached = false;
        clearInterval(renderInterval);
        cancelAnimationFrame(animationFrameId);
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        releaseWakeLock();
        document.body.classList.remove('playing');
        render();
    }
    function toggleSound() {
        state.soundEnabled = !state.soundEnabled;
        render();
    }
    function handleTimeLimitChange(e) {
        state.timeLimit = e.target.value.replace(/[^0-9]/g, '');
    }
    function startWithPreset(minutes) {
        state.timeLimit = minutes.toString();
        state.isPlaying = true;
        document.body.classList.add('playing');
        state.totalTime = 0;
        state.count = 0;
        state.sessionComplete = false;
        state.timeLimitReached = false;
        if (audioContext && audioContext.state === 'suspended') {
            audioContext.resume().then(() => {
                console.log('AudioContext resumed');
            });
        }
        state.phaseStartTime = performance.now();
        state.pulseStartTime = performance.now();
        state.lastTotalUpdate = performance.now();
        playTone();
        animate();
        requestWakeLock();
        renderInterval = setInterval(render, 200);
        render();
    }
    function animate() {
        if (!state.isPlaying) return;
        const now = performance.now();
        while (now - state.lastTotalUpdate >= 1000) {
            state.totalTime += 1;
            state.lastTotalUpdate += 1000;
            if (state.timeLimit && !state.timeLimitReached) {
                const timeLimitSeconds = parseInt(state.timeLimit) * 60;
                if (state.totalTime >= timeLimitSeconds) {
                    state.timeLimitReached = true;
                }
            }
        }
        const ctx = canvas.getContext('2d');
        const elapsed = (now - state.phaseStartTime) / 1000;
        let progress = elapsed / state.phaseTime;
        progress = Math.max(0, Math.min(1, progress));
        const phase = state.count;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        const size = canvas.height * 0.6;
        const lineX = canvas.width / 2;
        const lineTop = (canvas.height - size) / 2;
        const lineBottom = lineTop + size;
        ctx.strokeStyle = '#d97706';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(lineX, lineTop);
        ctx.lineTo(lineX, lineBottom);
        ctx.stroke();
        let currentY;
        if (phase === 0) {
            currentY = lineBottom - progress * size;
        } else {
            currentY = lineTop + progress * size;
        }
        let radius = 10;
        if (state.pulseStartTime !== null) {
            const pulseElapsed = (now - state.pulseStartTime) / 1000;
            if (pulseElapsed < 0.5) {
                const pulseFactor = Math.sin(Math.PI * pulseElapsed / 0.5);
                radius = 10 + 10 * pulseFactor;
            }
        }
        ctx.beginPath();
        ctx.arc(lineX, currentY, radius, 0, 2 * Math.PI);
        ctx.fillStyle = '#ff0000';
        ctx.fill();
        if (elapsed >= state.phaseTime) {
            state.count = (state.count + 1) % 2;
            state.phaseStartTime = performance.now();
            state.pulseStartTime = performance.now();
            playTone();
            if (state.count === 0 && state.timeLimitReached) {
                state.sessionComplete = true;
                state.isPlaying = false;
                cancelAnimationFrame(animationFrameId);
                clearInterval(renderInterval);
                releaseWakeLock();
                document.body.classList.remove('playing');
                render();
                return;
            }
        }
        animationFrameId = requestAnimationFrame(animate);
    }
    function render() {
        let html = '';
        if (state.isPlaying) {
            const elapsedPhase = (performance.now() - state.phaseStartTime) / 1000;
            let countdownDisplay;
            if (elapsedPhase < 0.5) {
                countdownDisplay = '5.5';
            } else if (elapsedPhase < 1.5) {
                countdownDisplay = '5';
            } else if (elapsedPhase < 2.5) {
                countdownDisplay = '4';
            } else if (elapsedPhase < 3.5) {
                countdownDisplay = '3';
            } else if (elapsedPhase < 4.5) {
                countdownDisplay = '2';
            } else {
                countdownDisplay = '1';
            }
            html += `
                <div class="full-title">Coherent Breathing</div>
                <div class="left-content">
                    <div class="total-time">Total Time: ${formatTime(state.totalTime)}</div>
                    <div class="instruction">${getInstruction(state.count)}</div>
                    <div class="countdown">${countdownDisplay}</div>
                </div>
                <div class="full-bottom">
                    <button id="toggle-play">${icons.pause} Pause</button>
                </div>
            `;
        }
        if (!state.isPlaying && !state.sessionComplete) {
            html += `
                <div class="title">Coherent Breathing</div>
                <label>
                    <input type="checkbox" id="sound-toggle" ${state.soundEnabled ? 'checked' : ''}>
                    ${state.soundEnabled ? icons.volume2 : icons.volumeX}
                    Sound ${state.soundEnabled ? 'On' : 'Off'}
                </label>
                <div>
                    Minutes (optional)
                    <input type="text" id="input-id" value="${state.timeLimit}">
                </div>
                <button id="toggle-play">${icons.play} Start</button>
                <div>
                    <button class="preset-button" id="preset-2min">${icons.clock} 2 min</button>
                    <button class="preset-button" id="preset-5min">${icons.clock} 5 min</button>
                    <button class="preset-button" id="preset-10min">${icons.clock} 10 min</button>
                </div>
            `;
        }
        if (state.sessionComplete) {
            html += `
                <div class="title">Coherent Breathing</div>
                <div class="instruction">Complete!</div>
                <button id="reset">${icons.rotateCcw} Back to Start</button>
            `;
        }
        app.innerHTML = html;
        if (!state.sessionComplete) {
            const toggleBtn = document.getElementById('toggle-play');
            if (toggleBtn) toggleBtn.addEventListener('click', togglePlay);
        }
        if (state.sessionComplete) {
            const resetBtn = document.getElementById('reset");
            if (resetBtn) resetBtn.addEventListener('click', resetToStart);
        }
        if (!state.isPlaying && !state.sessionComplete) {
            const soundToggle = document.getElementById('sound-toggle');
            if (soundToggle) soundToggle.addEventListener('change', toggleSound);
            const timeLimitInput = document.getElementById('input-id');
            if (timeLimitInput) timeLimitInput.addEventListener('input', handleTimeLimitChange);
            const preset2 = document.getElementById('preset-2min');
            if (preset2) preset2.addEventListener('click', () => startWithPreset(2));
            const preset5 = document.getElementById('preset-5min');
            if (preset5) preset5.addEventListener('click', () => startWithPreset(5));
            const preset10 = document.getElementById('preset-10min');
            if (preset10) preset10.addEventListener('click', () => startWithPreset(10));
        }
    }
    render();
});
