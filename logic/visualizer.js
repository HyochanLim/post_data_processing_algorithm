const three = require('three');
const scene = new three.Scene();
const rocketMesh = require('../three/rocket.mesh').createRocketMesh;

const viewerElement = document.getElementById('viewer');

const camera = new three.PerspectiveCamera(60, 1, 0.1, 100);
const cameraTarget = new three.Vector3(0, 0.5, 0);
camera.position.set(1.8, 1.2, 2.2);
camera.lookAt(cameraTarget);

const renderer = new three.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(window.devicePixelRatio);

viewerElement.appendChild(renderer.domElement);

scene.add(new three.AmbientLight(0xffffff, 0.6));
const directionalLight = new three.DirectionalLight(0xffffff, 1.1);
directionalLight.position.set(2, 3, 2);
scene.add(directionalLight);

function createPositiveAxisArrow(axis, color) {
    const group = new three.Group();
    const shaftLength = 1.0;
    const shaftRadius = 0.018;
    const headLength = 0.16;
    const headRadius = 0.05;

    const material = new three.MeshStandardMaterial({ color: color });

    const shaft = new three.Mesh(
        new three.CylinderGeometry(shaftRadius, shaftRadius, shaftLength, 16),
        material
    );
    shaft.position.y = shaftLength / 2;
    group.add(shaft);

    const head = new three.Mesh(
        new three.ConeGeometry(headRadius, headLength, 18),
        material
    );
    head.position.y = shaftLength + headLength / 2;
    group.add(head);

    if (axis === 'x') {
        group.rotation.z = -Math.PI / 2;
    } else if (axis === 'z') {
        group.rotation.x = Math.PI / 2;
    }

    return group;
}

function createAxisLabel(text, color, position) {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;

    const context = canvas.getContext('2d');
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.font = 'bold 72px sans-serif';
    context.fillStyle = color;
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText(text, 64, 68);

    const texture = new three.CanvasTexture(canvas);
    texture.needsUpdate = true;

    const material = new three.SpriteMaterial({
        map: texture,
        transparent: true,
        depthTest: false
    });

    const sprite = new three.Sprite(material);
    sprite.position.copy(position);
    sprite.scale.set(0.24, 0.24, 0.24);
    return sprite;
}

scene.add(createPositiveAxisArrow('x', 0xff4d4f));
scene.add(createPositiveAxisArrow('y', 0x52c41a));
scene.add(createPositiveAxisArrow('z', 0x40a9ff));
scene.add(createAxisLabel('X', '#ff4d4f', new three.Vector3(1.28, 0.02, 0)));
scene.add(createAxisLabel('Y', '#52c41a', new three.Vector3(0.02, 1.3, 0)));
scene.add(createAxisLabel('Z', '#40a9ff', new three.Vector3(0, 0.02, 1.28)));

const groundGrid = new three.GridHelper(8, 16, 0x999999, 0x444444);
scene.add(groundGrid);

const groundPlane = new three.Mesh(
    new three.PlaneGeometry(8, 8),
    new three.MeshStandardMaterial({
        color: 0x222222,
        transparent: true,
        opacity: 0.22,
        side: three.DoubleSide
    })
);
groundPlane.rotation.x = -Math.PI / 2;
scene.add(groundPlane);

const rocket = rocketMesh();
rocket.position.y = 0.6;
scene.add(rocket);

const progradeArrow = new three.ArrowHelper(
    new three.Vector3(0, 1, 0),
    rocket.position.clone(),
    0.01,
    0xffd666,
    0.16,
    0.08
);
progradeArrow.visible = false;
scene.add(progradeArrow);

const qx = 0;
const qy = 0;
const qz = 0;
const qw = 1;
rocket.quaternion.set(qx, qy, qz, qw); // rocket added to scene

let yaw = 0.68;
let pitch = 0.42;
let radius = 3.1;
let isDragging = false;
let lastX = 0;
let lastY = 0;

const velocityDirection = new three.Vector3();
const rocketNoseAxis = new three.Vector3(0, 1, 0);
const rotationQuaternion = new three.Quaternion();
// raw데이터는 로켓의 prograde 방향이 +x축이라 지표좌표계 기준 y축으로 변환하기 위해 회전행렬을 곱해줘야 함
const rawToViewerMatrix = new three.Matrix4().set(
    0, 1, 0, 0,
    1, 0, 0, 0,
    0, 0, 1, 0,
    0, 0, 0, 1
);
const minVelocityMagnitude = 0.02;
const progradeArrowLength = 1.2;

const timeValueElement = document.getElementById('timeValue');
const xVelocityElement = document.getElementById('xVelocity');
const yVelocityElement = document.getElementById('yVelocity');
const zVelocityElement = document.getElementById('zVelocity');
const speedValueElement = document.getElementById('speedValue');
const xAccelElement = document.getElementById('xAccel');
const yAccelElement = document.getElementById('yAccel');
const zAccelElement = document.getElementById('zAccel');
const accelValueElement = document.getElementById('accelValue');

function updateCameraFromOrbit() {
    const minPitch = -1.35;
    const maxPitch = 1.35;
    if (pitch < minPitch) pitch = minPitch;
    if (pitch > maxPitch) pitch = maxPitch;
    if (radius < 1.2) radius = 1.2;
    if (radius > 8) radius = 8;

    const x = radius * Math.cos(pitch) * Math.sin(yaw);
    const y = radius * Math.sin(pitch);
    const z = radius * Math.cos(pitch) * Math.cos(yaw);

    camera.position.set(x + cameraTarget.x, y + cameraTarget.y, z + cameraTarget.z);
    camera.lookAt(cameraTarget);
}

viewerElement.addEventListener('mousedown', (event) => {
    isDragging = true;
    lastX = event.clientX;
    lastY = event.clientY;
});

window.addEventListener('mouseup', () => {
    isDragging = false;
});

window.addEventListener('mousemove', (event) => {
    if (!isDragging) return;

    const deltaX = event.clientX - lastX;
    const deltaY = event.clientY - lastY;

    yaw -= deltaX * 0.005;
    pitch += deltaY * 0.005;

    lastX = event.clientX;
    lastY = event.clientY;

    updateCameraFromOrbit();
});

viewerElement.addEventListener('wheel', (event) => {
    event.preventDefault();
    updateCameraFromOrbit();
}, { passive: false });

updateCameraFromOrbit();

function resize() {
    const width = viewerElement.clientWidth;
    const height = viewerElement.clientHeight;
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
}

window.addEventListener('resize', resize);
resize();

function animate() {
    requestAnimationFrame(animate);
    renderer.render(scene, camera);
}

animate();

//----------------------------------------- 
// playbutton, playbar logic

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

let file = [];
let currentFrame = 0;
let isPlaying = false;
let playbackTimer = null;

function showRocketPose(frame) {
    if (!Array.isArray(file) || file.length === 0) return;

    const frameIndex = Math.max(0, Math.min(Number(frame) || 0, file.length - 1));
    const frameData = file[frameIndex];
    const velocity = frameData?.velocity;

    if (!Array.isArray(velocity) || velocity.length < 3) {
        progradeArrow.visible = false;
        return;
    }

    const vx = Number(velocity[0]) || 0;
    const vy = Number(velocity[1]) || 0;
    const vz = Number(velocity[2]) || 0;

    velocityDirection.set(vx, vy, vz).applyMatrix4(rawToViewerMatrix);
    const speedMagnitude = velocityDirection.length();

    if (speedMagnitude < minVelocityMagnitude) {
        progradeArrow.visible = false;
        return;
    }

    velocityDirection.normalize();

    // Align rocket model's +Y nose axis to current prograde direction.
    rotationQuaternion.setFromUnitVectors(rocketNoseAxis, velocityDirection);
    rocket.quaternion.copy(rotationQuaternion);

    progradeArrow.visible = true;
    progradeArrow.position.copy(rocket.position);
    progradeArrow.setDirection(velocityDirection);

    const headLength = 0.24;
    const headWidth = 0.12;
    progradeArrow.setLength(progradeArrowLength, headLength, headWidth);

    timeSliderElement.value = String(frameIndex);
    updateTelemetry(frameIndex);
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
    if (!Array.isArray(file) || file.length === 0) {
        timeValueElement.textContent = '0.00';
        xVelocityElement.textContent = '0.000';
        yVelocityElement.textContent = '0.000';
        zVelocityElement.textContent = '0.000';
        speedValueElement.textContent = '0.000';
        xAccelElement.textContent = '0.000';
        yAccelElement.textContent = '0.000';
        zAccelElement.textContent = '0.000';
        accelValueElement.textContent = '0.000';
        return;
    }

    const frameIndex = Math.max(0, Math.min(Number(frame) || 0, file.length - 1));
    const frameData = file[frameIndex] || {};

    const vx = Number(frameData?.velocity?.[0] ?? 0);
    const vy = Number(frameData?.velocity?.[1] ?? 0);
    const vz = Number(frameData?.velocity?.[2] ?? 0);
    const ax = Number(frameData?.accel_x ?? 0);
    const ay = Number(frameData?.accel_y ?? 0);
    const az = Number(frameData?.accel_z ?? 0);
    const speed = Math.sqrt((vx * vx) + (vy * vy) + (vz * vz));
    const accelMagnitude = Math.sqrt((ax * ax) + (ay * ay) + (az * az));

    timeValueElement.textContent = Number(frameData?.time ?? 0).toFixed(2);
    xVelocityElement.textContent = vx.toFixed(3);
    yVelocityElement.textContent = vy.toFixed(3);
    zVelocityElement.textContent = vz.toFixed(3);
    speedValueElement.textContent = speed.toFixed(3);
    xAccelElement.textContent = ax.toFixed(3);
    yAccelElement.textContent = ay.toFixed(3);
    zAccelElement.textContent = az.toFixed(3);
    accelValueElement.textContent = accelMagnitude.toFixed(3);
}

loadFile('/data/raw/2025-02-23-serial-10970-flight-0017.json')
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