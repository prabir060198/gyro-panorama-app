import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.158.0/build/three.module.js';

const video = document.getElementById("video");
const statusText = document.getElementById("status");
const angleUI = document.getElementById("angleUI");
const arrow = document.getElementById("arrow");

let images = [];
let yaw = 0;
let capturing = false;
let targetIndex = 0;

// 360 targets
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
    angleUI.innerText = "Yaw: " + yaw + "°";

    if (!capturing) return;

    let target = targets[targetIndex];

    // 🎯 Direction arrow
    let diff = target - yaw;

    if (diff > 180) diff -= 360;
    if (diff < -180) diff += 360;

    // rotate arrow
    arrow.style.transform =
        `translateX(-50%) rotate(${diff}deg)`;

    // auto capture
    if (Math.abs(diff) < 8) {
        captureImage();
        targetIndex++;

        if (targetIndex >= targets.length) {
            capturing = false;
            statusText.innerText = "✅ 360 Capture Complete!";
        }
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

    statusText.innerText = "Captured: " + images.length;
}

// ================= START =================
window.startGuidedCapture = function () {
    images = [];
    capturing = true;
    targetIndex = 0;
};

// ================= THREE VIEWER =================
window.createViewer = function () {

    if (images.length === 0) {
        alert("No images!");
        return;
    }

    // create texture strip
    let width = images[0].width * images.length;
    let height = images[0].height;

    let canvas = document.createElement("canvas");
    let ctx = canvas.getContext("2d");

    canvas.width = width;
    canvas.height = height;

    images.forEach((img, i) => {
        ctx.drawImage(img, i * img.width, 0);
    });

    let texture = new THREE.CanvasTexture(canvas);

    let scene = new THREE.Scene();
    let camera = new THREE.PerspectiveCamera(75, window.innerWidth / 400, 1, 1000);

    let renderer = new THREE.WebGLRenderer();
    renderer.setSize(window.innerWidth, 400);

    document.getElementById("viewer").innerHTML = "";
    document.getElementById("viewer").appendChild(renderer.domElement);

    let geometry = new THREE.SphereGeometry(500, 60, 40);
    geometry.scale(-1, 1, 1);

    let material = new THREE.MeshBasicMaterial({ map: texture });

    let mesh = new THREE.Mesh(geometry, material);
    scene.add(mesh);

    // simple control (drag)
    let isDown = false;
    let lon = 0, lat = 0;

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

        let phi = THREE.MathUtils.degToRad(90 - lat);
        let theta = THREE.MathUtils.degToRad(lon);

        camera.target = new THREE.Vector3(
            500 * Math.sin(phi) * Math.cos(theta),
            500 * Math.cos(phi),
            500 * Math.sin(phi) * Math.sin(theta)
        );

        camera.lookAt(camera.target);

        renderer.render(scene, camera);
    }

    animate();
};