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
