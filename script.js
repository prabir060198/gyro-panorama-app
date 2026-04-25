const video = document.getElementById('video');
const canvas = document.getElementById('canvas');
const startBtn = document.getElementById('startBtn');

let scene, camera, renderer;
let ghostMesh;

// ✅ Start camera properly
async function startCamera() {
    const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
        audio: false
    });

    video.srcObject = stream;

    // IMPORTANT: wait for video
    await video.play();
}

// ✅ Init Three.js
function init3D() {
    scene = new THREE.Scene();

    camera = new THREE.PerspectiveCamera(
        75,
        window.innerWidth / window.innerHeight,
        0.1,
        1000
    );

    camera.position.set(0, 0, 0);

    renderer = new THREE.WebGLRenderer({
        canvas: canvas,
        alpha: true
    });

    renderer.setSize(window.innerWidth, window.innerHeight);

    // ✅ FIX: use video as texture properly
    const videoTexture = new THREE.VideoTexture(video);
    videoTexture.colorSpace = THREE.SRGBColorSpace;

    const bgGeometry = new THREE.PlaneGeometry(16, 9);
    const bgMaterial = new THREE.MeshBasicMaterial({
        map: videoTexture
    });

    const bgMesh = new THREE.Mesh(bgGeometry, bgMaterial);
    bgMesh.position.z = -10;

    scene.add(bgMesh);

    // ✅ Ghost plane (visible even before capture)
    const geometry = new THREE.PlaneGeometry(2, 2);

    const material = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        opacity: 0.3,
        transparent: true
    });

    ghostMesh = new THREE.Mesh(geometry, material);
    ghostMesh.position.z = -3;

    scene.add(ghostMesh);

    animate();
}

// ✅ Apply captured image
function setGhostImage(imageData) {
    const texture = new THREE.TextureLoader().load(imageData);

    ghostMesh.material.map = texture;
    ghostMesh.material.opacity = 0.5;
    ghostMesh.material.needsUpdate = true;
}

// ✅ Better gyro handling
function setupGyro() {
    window.addEventListener('deviceorientation', (e) => {
        if (e.alpha == null) return;

        const alpha = THREE.MathUtils.degToRad(e.alpha);
        const beta = THREE.MathUtils.degToRad(e.beta || 0);
        const gamma = THREE.MathUtils.degToRad(e.gamma || 0);

        // Simple but stable mapping
        camera.rotation.set(beta, alpha, -gamma);
    });
}

// ✅ Render loop
function animate() {
    requestAnimationFrame(animate);
    renderer.render(scene, camera);
}

// ✅ Capture function
function captureFrame() {
    const tempCanvas = document.createElement("canvas");
    tempCanvas.width = video.videoWidth;
    tempCanvas.height = video.videoHeight;

    const ctx = tempCanvas.getContext("2d");
    ctx.drawImage(video, 0, 0);

    const imgData = tempCanvas.toDataURL("image/png");

    setGhostImage(imgData);
}

// ✅ Start button
startBtn.addEventListener('click', async () => {
    await startCamera();
    init3D();
    setupGyro();
});

// tap screen to capture
window.addEventListener("click", captureFrame);