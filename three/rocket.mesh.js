const THREE = require('three');

function createRocketMesh() {
  const rocket = new THREE.Group();

  // rocket body
  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(0.12, 0.12, 1.2, 24),
    new THREE.MeshStandardMaterial({ color: 0xd9d9d9 })
  );
  rocket.add(body);

  // rocket nozecone
  const nose = new THREE.Mesh(
    new THREE.ConeGeometry(0.12, 0.3, 24),
    new THREE.MeshStandardMaterial({ color: 0xff4d4f })
  );
  nose.position.y = 0.75;
  rocket.add(nose);

  // motor nozzle
  const nozzle = new THREE.Mesh(
    new THREE.CylinderGeometry(0.06, 0.08, 0.12, 16),
    new THREE.MeshStandardMaterial({ color: 0x555555 })
  );
  nozzle.position.y = -0.66;
  rocket.add(nozzle);

  // 4 tailfins
  for (let i = 0; i < 4; i++) {
    const fin = new THREE.Mesh(
      new THREE.BoxGeometry(0.02, 0.18, 0.12),
      new THREE.MeshStandardMaterial({ color: 0x2f54eb })
    );
    fin.position.set(Math.cos((i * Math.PI) / 2) * 0.12, -0.45, Math.sin((i * Math.PI) / 2) * 0.12);
    fin.lookAt(0, fin.position.y, 0);
    rocket.add(fin);
  }

  return rocket;
}

module.exports = {
  createRocketMesh: createRocketMesh
};

// const rocketMesh = createRocketMesh();
// scene.add(rocketMesh);

// rocketMesh.quaternion.set(qx, qy, qz, qw); 이렇게 로켓 소환하면 댐