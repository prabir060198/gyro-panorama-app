import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.158.0/build/three.module.js';

const video = document.getElementById("video");
const statusText = document.getElementById("status");
const angleUI = document.getElementById("angleUI");
const arrow = document.getElementById("arrow");

let images = [];
let yaw = 0;
let capturing = false;
let targetIndex = 0;
let isCapturingFrame = false;

// 8 steps
const targets = [0, 45, 90, 135, 180, 225, 270, 315];

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

    yaw = Math.round(event.alpha);
    angleUI.innerText = `Yaw: ${yaw}° (${targetIndex}/${targets.length})`;

    if (!capturing) return;

    let target = targets[targetIndex];

    let diff = target - yaw;

    // normalize
    if (diff > 180) diff -= 360;
    if (diff < -180) diff += 360;

    // rotate arrow
    arrow.style.transform =
        `translateX(-50%) rotate(${diff}deg)`;

    // guidance text
    if (Math.abs(diff) > 25) {
        statusText.innerText = "➡ Rotate phone";
    } else if (Math.abs(diff) > 10) {
        statusText.innerText = "➡ Keep going...";
    } else if (Math.abs(diff) > 5) {
        statusText.innerText = "🎯 Almost...";
    } else {
        statusText.innerText = "⏳ Hold...";
    }

    // EASY CAPTURE
    if (Math.abs(diff) < 12 && !isCapturingFrame) {

        isCapturingFrame = true;

        statusText.innerText = "📸 Capturing...";

        setTimeout(() => {

            captureImage();
            targetIndex++;

            isCapturingFrame = false;

            if (targetIndex >= targets.length) {
                capturing = false;
                statusText.innerText = "✅ Done!";
            }

        }, 600);
    }
});

// ================= CAPTURE =================
function captureImage() {

    let canvas = document.createElement("canvas");
    let ctx = canvas.getContext("2d");

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    ctx.drawImage(video, 0, 0);

    images.push(canvas);
}

// ================= START =================
window.startGuidedCapture = function () {
    images = [];
    capturing = true;
    targetIndex = 0;
};

// ================= SMOOTH STITCH =================
function createPanoramaTexture() {

    let overlap = 60;
    let imgW = images[0].width;
    let imgH = images[0].height;

    let totalWidth = imgW * images.length - overlap * (images.length - 1);

    let canvas = document.createElement("canvas");
    let ctx = canvas.getContext("2d");

    canvas.width = totalWidth;
    canvas.height = imgH;

    let xOffset = 0;

    images.forEach((img, i) => {

        if (i === 0) {
            ctx.drawImage(img, 0, 0);
            xOffset += imgW - overlap;
        } else {

            for (let x = 0; x < overlap; x++) {
                let alpha = x / overlap;

                ctx.globalAlpha = alpha;
                ctx.drawImage(img, x, 0, 1, imgH,
                    xOffset + x, 0, 1, imgH);
            }

            ctx.globalAlpha = 1;

            ctx.drawImage(img,
                overlap, 0,
                imgW - overlap, imgH,
                xOffset + overlap, 0,
                imgW - overlap, imgH);

            xOffset += imgW - overlap;
        }
    });

    return canvas;
}

// ================= VIEWER =================
window.createViewer = function () {

    if (images.length === 0) {
        alert("No images!");
        return;
    }

    const panoCanvas = createPanoramaTexture();
    const texture = new THREE.CanvasTexture(panoCanvas);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / 400, 1, 1000);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, 400);

    const container = document.getElementById("viewer");
    container.innerHTML = "";
    container.appendChild(renderer.domElement);

    const geometry = new THREE.SphereGeometry(500, 60, 40);
    geometry.scale(-1, 1, 1);

    const material = new THREE.MeshBasicMaterial({ map: texture });
    scene.add(new THREE.Mesh(geometry, material));

    let lon = 0, lat = 0;
    let isDown = false;

    renderer.domElement.addEventListener("mousedown", () => isDown = true);
    renderer.domElement.addEventListener("mouseup", () => isDown = false);

    renderer.domElement.addEventListener("mousemove", (e) => {
        if (!isDown) return;
        lon += e.movementX * 0.1;
        lat -= e.movementY * 0.1;
    });

    function animate() {
        requestAnimationFrame(animate);

        lat = Math.max(-85, Math.min(85, lat));

        const phi = THREE.MathUtils.degToRad(90 - lat);
        const theta = THREE.MathUtils.degToRad(lon);

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