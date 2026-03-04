const three = require('three');
const scene = new three.Scene();
const rocketMesh = require('../three/rocket.mesh').createRocketMesh;

const viewerElement = document.getElementById('viewer');

const camera = new three.PerspectiveCamera(60, 1, 0.1, 100);
camera.position.set(1.8, 1.2, 2.2);
camera.lookAt(0, 0, 0);

const renderer = new three.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(window.devicePixelRatio);

viewerElement.appendChild(renderer.domElement);

scene.add(new three.AmbientLight(0xffffff, 0.6));
const directionalLight = new three.DirectionalLight(0xffffff, 1.1);
directionalLight.position.set(2, 3, 2);
scene.add(directionalLight);

const rocket = rocketMesh();
scene.add(rocket);

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

    camera.position.set(x, y, z);
    camera.lookAt(0, 0, 0);
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



let time, vx, vy, vz, ax, ay, az;

module.exports = {
    time: time,
    vx: vx,
    vy: vy,
    vz: vz,
    ax: ax,
    ay: ay,
    az: az
};
