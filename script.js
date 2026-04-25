const video = document.getElementById('video');
const canvas = document.getElementById('canvas');
const startBtn = document.getElementById('startBtn');

let scene, camera, renderer;
let videoTexture, ghostMesh;

async function startCamera() {
    const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
        audio: false
    });
    video.srcObject = stream;
}

// INIT 3D
function init3D() {
    scene = new THREE.Scene();

    camera = new THREE.PerspectiveCamera(
        75,
        window.innerWidth / window.innerHeight,
        0.1,
        1000
    );

    renderer = new THREE.WebGLRenderer({
        canvas: canvas,
        alpha: true
    });

    renderer.setSize(window.innerWidth, window.innerHeight);

    // 🔥 Camera video as background
    videoTexture = new THREE.VideoTexture(video);
    scene.background = videoTexture;

    // 🔥 Create ghost plane
    const geometry = new THREE.PlaneGeometry(2, 2);

    const material = new THREE.MeshBasicMaterial({
        transparent: true,
        opacity: 0.5
    });

    ghostMesh = new THREE.Mesh(geometry, material);

    // Place in front of camera
    ghostMesh.position.z = -3;

    scene.add(ghostMesh);

    animate();
}

// 🔥 Apply captured image to 3D plane
function setGhostImage(imageData) {
    const texture = new THREE.TextureLoader().load(imageData);

    ghostMesh.material.map = texture;
    ghostMesh.material.needsUpdate = true;
}

// Gyro rotation
function setupGyro() {
    window.addEventListener('deviceorientation', (e) => {
        if (e.alpha == null) return;

        // Rotate camera based on device
        camera.rotation.y = THREE.MathUtils.degToRad(e.alpha);
        camera.rotation.x = THREE.MathUtils.degToRad(e.beta || 0);
    });
}

// Animation loop
function animate() {
    requestAnimationFrame(animate);
    renderer.render(scene, camera);
}

// Start everything
startBtn.addEventListener('click', async () => {
    await startCamera();
    init3D();
    setupGyro();
});


// 🔥 Example: simulate capture → apply ghost
// Replace this with your real capturePhoto()
function fakeCapture() {
    const canvas2 = document.createElement("canvas");
    canvas2.width = video.videoWidth;
    canvas2.height = video.videoHeight;

    const ctx = canvas2.getContext("2d");
    ctx.drawImage(video, 0, 0);

    const imgData = canvas2.toDataURL("image/png");

    setGhostImage(imgData);
}

// TEMP: tap screen to capture
window.addEventListener("click", () => {
    fakeCapture();
});