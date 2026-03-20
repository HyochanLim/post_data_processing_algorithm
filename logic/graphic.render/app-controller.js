const calculator = require('../calculation/flight-frame-calculator');
const createSceneRenderer = require('./scene-renderer').createSceneRenderer;

const minVelocityMagnitude = 0.02;
const progradeArrowLength = 1.2;
const sceneRenderer = createSceneRenderer();

const playBtnElement = document.getElementById('playBtn');
const timeSliderElement = document.getElementById('timeSlider');

async function loadFile(filePath) {
    const response = await fetch(filePath);
    if (!response.ok) {
        throw new Error(`Failed to load flight data: ${response.status}`);
    }
    const file = await response.json();
    return file;
}

async function loadFirstAvailableFile(filePaths) {
    let lastError = null;

    for (const filePath of filePaths) {
        try {
            return await loadFile(filePath);
        } catch (error) {
            lastError = error;
        }
    }

    throw lastError || new Error('No available flight data file');
}

let file = [];
let currentFrame = 0;
let isPlaying = false;
let playbackTimer = null;

function showRocketPose(frame) {
    const frameState = calculator.getFrameState(file, frame, minVelocityMagnitude);
    sceneRenderer.applyFrameState(frameState, progradeArrowLength);
    timeSliderElement.value = String(frameState.frameIndex);
    updateTelemetry(frameState.telemetry);
}

function continuePlaying() {
    if (!Array.isArray(file) || file.length === 0) return;

    if (isPlaying) {
        isPlaying = false;
        playBtnElement.classList.remove('playing');
        playBtnElement.textContent = 'Play';
        if (playbackTimer) {
            window.clearInterval(playbackTimer);
            playbackTimer = null;
        }
        return;
    }

    isPlaying = true;
    playBtnElement.classList.add('playing');
    playBtnElement.textContent = 'Pause';

    playbackTimer = window.setInterval(() => {
        if (currentFrame >= file.length - 1) {
            continuePlaying();
            return;
        }

        currentFrame += 1;
        showRocketPose(currentFrame);
    }, 16);
}

timeSliderElement.addEventListener('input', (event) => {
    currentFrame = Number(event.target.value) || 0;
    showRocketPose(currentFrame);
});

function updateTelemetry(frame) {
    const telemetry = (typeof frame === 'object' && frame !== null)
        ? frame
        : calculator.getFrameState(file, frame, minVelocityMagnitude).telemetry;
    sceneRenderer.renderTelemetry(telemetry);
}

loadFirstAvailableFile([
    '/data/processed/2025-02-23-serial-10970-flight-0017-filtered.json',
    '/data/processed/manual-test.json',
    '/data/raw/2025-02-23-serial-10970-flight-0017.json'
])
    .then((loadedFile) => {
        file = loadedFile;
        timeSliderElement.min = '0';
        timeSliderElement.max = String(Math.max(file.length - 1, 0));
        timeSliderElement.step = '1';
        currentFrame = 0;
        showRocketPose(0);
        updateTelemetry(0);
    })
    .catch((error) => {
        console.error(error);
        playBtnElement.disabled = true;
        timeSliderElement.disabled = true;
    });

playBtnElement.addEventListener('click', continuePlaying);