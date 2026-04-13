import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.158.0/build/three.module.js';

const video = document.getElementById("video");
const statusText = document.getElementById("status");
const angleUI = document.getElementById("angleUI");
const arrow = document.getElementById("arrow");

let capturing = false;
let sphereImages = [];
let isCapturing = false;

// 🌐 grid
const rows = [-45, 0, 45];     // pitch
const cols = [0, 60, 120, 180, 240, 300]; // yaw

let rowIndex = 0;
let colIndex = 0;

// ================= CAMERA =================
window.startCamera = async function () {
    const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" }
    });
    video.srcObject = stream;
};

// ================= SENSOR =================
window.requestPermission = function () {
    if (DeviceOrientationEvent.requestPermission) {
        DeviceOrientationEvent.requestPermission();
    }
};

// ================= GYRO =================
window.addEventListener("deviceorientation", (event) => {

    if (event.alpha === null) return;

    let yaw = Math.round(event.alpha);
    let pitch = Math.round(event.beta);

    angleUI.innerText =
        `Yaw: ${yaw}° Pitch: ${pitch}°
Row ${rowIndex+1}/3 Col ${colIndex+1}/6`;

    if (!capturing) return;

    let targetYaw = cols[colIndex];
    let targetPitch = rows[rowIndex];

    let diffYaw = targetYaw - yaw;
    if (diffYaw > 180) diffYaw -= 360;
    if (diffYaw < -180) diffYaw += 360;

    let diffPitch = targetPitch - pitch;

    arrow.style.transform =
        `translateX(-50%) rotate(${diffYaw}deg)`;

    if (Math.abs(diffYaw) < 12 && Math.abs(diffPitch) < 12 && !isCapturing) {

        isCapturing = true;
        statusText.innerText = "📸 Capturing...";

        setTimeout(() => {

            captureImage(yaw, pitch);

            colIndex++;

            if (colIndex >= cols.length) {
                colIndex = 0;
                rowIndex++;
            }

            if (rowIndex >= rows.length) {
                capturing = false;
                statusText.innerText = "✅ Sphere Capture Done!";
            }

            isCapturing = false;

        }, 700);
    }
});

// ================= CAPTURE =================
function captureImage(yaw, pitch) {

    let canvas = document.createElement("canvas");
    let ctx = canvas.getContext("2d");

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    ctx.drawImage(video, 0, 0);

    sphereImages.push({ img: canvas, yaw, pitch });
}

// ================= START =================
window.startCapture = function () {
    sphereImages = [];
    capturing = true;
    rowIndex = 0;
    colIndex = 0;
};

// ================= TEXTURE =================
function createTexture() {

    let w = sphereImages[0].img.width;
    let h = sphereImages[0].img.height;

    let canvas = document.createElement("canvas");
    let ctx = canvas.getContext("2d");

    canvas.width = cols.length * w;
    canvas.height = rows.length * h;

    sphereImages.forEach(data => {

        let x = Math.floor((data.yaw / 360) * cols.length);
        let y = Math.floor(((data.pitch + 90) / 180) * rows.length);

        x = Math.max(0, Math.min(cols.length - 1, x));
        y = Math.max(0, Math.min(rows.length - 1, y));

        ctx.drawImage(data.img, x * w, y * h);
    });

    return canvas;
}

// ================= VIEWER =================
window.createViewer = function () {

    const pano = createTexture();
    const texture = new THREE.CanvasTexture(pano);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / 400, 1, 1000);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, 400);

    document.getElementById("viewer").innerHTML = "";
    document.getElementById("viewer").appendChild(renderer.domElement);

    const geometry = new THREE.SphereGeometry(500, 60, 40);
    geometry.scale(-1, 1, 1);

    const material = new THREE.MeshBasicMaterial({ map: texture });
    scene.add(new THREE.Mesh(geometry, material));

    let lon = 0, lat = 0;
    let isDown = false;

    // mouse
    renderer.domElement.addEventListener("mousedown", () => isDown = true);
    renderer.domElement.addEventListener("mouseup", () => isDown = false);

    renderer.domElement.addEventListener("mousemove", (e) => {
        if (!isDown) return;
        lon += e.movementX * 0.1;
        lat -= e.movementY * 0.1;
    });

    // touch
    let lastX = 0, lastY = 0;

    renderer.domElement.addEventListener("touchstart", (e) => {
        lastX = e.touches[0].clientX;
        lastY = e.touches[0].clientY;
    });

    renderer.domElement.addEventListener("touchmove", (e) => {

        let dx = e.touches[0].clientX - lastX;
        let dy = e.touches[0].clientY - lastY;

        lon += dx * 0.1;
        lat -= dy * 0.1;

        lastX = e.touches[0].clientX;
        lastY = e.touches[0].clientY;
    });

    function animate() {
        requestAnimationFrame(animate);

        lat = Math.max(-85, Math.min(85, lat));

        let phi = THREE.MathUtils.degToRad(90 - lat);
        let theta = THREE.MathUtils.degToRad(lon);

        camera.position.set(
            500 * Math.sin(phi) * Math.cos(theta),
            500 * Math.cos(phi),
            500 * Math.sin(phi) * Math.sin(theta)
        );

        camera.lookAt(0, 0, 0);

        renderer.render(scene, camera);
    }

    animate();
};