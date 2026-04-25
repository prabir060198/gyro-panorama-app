const video = document.getElementById('video');
const canvas = document.getElementById('canvas');
const startBtn = document.getElementById('startBtn');
const statusText = document.getElementById('status');

let scene, camera, renderer;
let ghostMesh;

// ---------- CAMERA ----------
async function startCamera() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: "environment" },
            audio: false
        });

        video.srcObject = stream;
        await video.play();

        statusText.innerText = "Camera started";
    } catch (e) {
        statusText.innerText = "Camera error";
        console.error(e);
    }
}

// ---------- INIT 3D ----------
function init3D() {

    scene = new THREE.Scene();

    camera = new THREE.PerspectiveCamera(
        75,
        window.innerWidth / window.innerHeight,
        0.1,
        1000
    );

    camera.position.z = 0.1;

    renderer = new THREE.WebGLRenderer({
        canvas: canvas,
        alpha: true,
        antialias: true
    });

    renderer.setSize(window.innerWidth, window.innerHeight);

    // ✅ VIDEO AS BACKGROUND (FIXED)
    const videoTexture = new THREE.VideoTexture(video);
    videoTexture.minFilter = THREE.LinearFilter;
    videoTexture.magFilter = THREE.LinearFilter;
    videoTexture.format = THREE.RGBAFormat;

    scene.background = videoTexture;

    // ✅ GHOST PLANE (BIG + VISIBLE)
    const geometry = new THREE.PlaneGeometry(3, 3);

    const material = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        opacity: 0.3,
        transparent: true
    });

    ghostMesh = new THREE.Mesh(geometry, material);
    ghostMesh.position.set(0, 0, -2);

    scene.add(ghostMesh);

    animate();
}

// ---------- GYRO ----------
function setupGyro() {
    window.addEventListener('deviceorientation', (e) => {

        if (e.alpha == null) return;

        const alpha = THREE.MathUtils.degToRad(e.alpha);
        const beta = THREE.MathUtils.degToRad(e.beta || 0);

        camera.rotation.y = alpha;
        camera.rotation.x = beta;
    });
}

// ---------- RENDER ----------
function animate() {
    requestAnimationFrame(animate);
    renderer.render(scene, camera);
}

// ---------- CAPTURE ----------
function captureFrame() {

    const temp = document.createElement("canvas");
    temp.width = video.videoWidth;
    temp.height = video.videoHeight;

    const ctx = temp.getContext("2d");
    ctx.drawImage(video, 0, 0);

    const img = temp.toDataURL("image/png");

    const texture = new THREE.TextureLoader().load(img);

    ghostMesh.material.map = texture;
    ghostMesh.material.opacity = 0.5;
    ghostMesh.material.needsUpdate = true;

    statusText.innerText = "Captured";
}

// ---------- START ----------
startBtn.addEventListener('click', async () => {

    await startCamera();
    init3D();

    // iOS permission
    if (typeof DeviceOrientationEvent.requestPermission === 'function') {
        DeviceOrientationEvent.requestPermission().then(res => {
            if (res === 'granted') {
                setupGyro();
                statusText.innerText = "Gyro active";
            }
        });
    } else {
        setupGyro();
        statusText.innerText = "Gyro active";
    }
});

// Tap anywhere to capture
window.addEventListener("click", captureFrame);