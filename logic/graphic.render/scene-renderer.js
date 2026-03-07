const three = require('three');
const rocketMesh = require('../../three/rocket.mesh').createRocketMesh;

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

function createSceneRenderer() {
    const scene = new three.Scene();
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
    rocket.quaternion.set(qx, qy, qz, qw);

    let yaw = 0.68;
    let pitch = 0.42;
    let radius = 3.1;
    let isDragging = false;
    let lastX = 0;
    let lastY = 0;

    const velocityDirection = new three.Vector3();
    const rocketNoseAxis = new three.Vector3(0, 1, 0);
    const rotationQuaternion = new three.Quaternion();

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

    function applyFrameState(frameState, progradeArrowLength) {
        if (!frameState || !frameState.hasData) {
            progradeArrow.visible = false;
            return;
        }

        if (!frameState.prograde.visible) {
            progradeArrow.visible = false;
            return;
        }

        velocityDirection.set(
            frameState.prograde.direction.x,
            frameState.prograde.direction.y,
            frameState.prograde.direction.z
        );

        rotationQuaternion.setFromUnitVectors(rocketNoseAxis, velocityDirection);
        rocket.quaternion.copy(rotationQuaternion);

        progradeArrow.visible = true;
        progradeArrow.position.copy(rocket.position);
        progradeArrow.setDirection(velocityDirection);

        const headLength = 0.24;
        const headWidth = 0.12;
        progradeArrow.setLength(progradeArrowLength, headLength, headWidth);
    }

    function renderTelemetry(telemetry) {
        const safeTelemetry = telemetry || {
            time: 0,
            velocity: { x: 0, y: 0, z: 0 },
            speed: 0,
            accel: { x: 0, y: 0, z: 0 },
            accelMagnitude: 0
        };

        timeValueElement.textContent = safeTelemetry.time.toFixed(2);
        xVelocityElement.textContent = safeTelemetry.velocity.x.toFixed(3);
        yVelocityElement.textContent = safeTelemetry.velocity.y.toFixed(3);
        zVelocityElement.textContent = safeTelemetry.velocity.z.toFixed(3);
        speedValueElement.textContent = safeTelemetry.speed.toFixed(3);
        xAccelElement.textContent = safeTelemetry.accel.x.toFixed(3);
        yAccelElement.textContent = safeTelemetry.accel.y.toFixed(3);
        zAccelElement.textContent = safeTelemetry.accel.z.toFixed(3);
        accelValueElement.textContent = safeTelemetry.accelMagnitude.toFixed(3);
    }

    return {
        applyFrameState,
        renderTelemetry
    };
}

module.exports = {
    createSceneRenderer
};