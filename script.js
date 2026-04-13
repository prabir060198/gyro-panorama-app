const video = document.getElementById("video");
const statusText = document.getElementById("status");
const angleUI = document.getElementById("angleUI");

let sphereImages = [];
let capturing = false;
let lastYaw = null;

// ================= CAMERA =================
async function startCamera() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: "environment" }
        });

        video.srcObject = stream;
        statusText.innerText = "Camera started ✅";

    } catch (err) {
        alert("Camera error! Use HTTPS + allow permission");
    }
}

// ================= SENSOR =================
function requestPermission() {
    if (typeof DeviceOrientationEvent !== "undefined" &&
        typeof DeviceOrientationEvent.requestPermission === "function") {

        DeviceOrientationEvent.requestPermission()
        .then(res => {
            if (res === "granted") {
                statusText.innerText = "Sensor enabled ✅";
            }
        });
    } else {
        statusText.innerText = "Sensor ready ✅";
    }
}

// ================= GYRO =================
let yaw = 0;
let pitch = 0;

window.addEventListener("deviceorientation", (event) => {

    if (event.alpha === null) {
        angleUI.innerText = "Gyro not supported ❌";
        return;
    }

    yaw = Math.round(event.alpha);
    pitch = Math.round(event.beta);

    angleUI.innerText =
        `Yaw: ${yaw}°
Pitch: ${pitch}`;

    if (!capturing) return;

    if (lastYaw === null) {
        captureImage();
        lastYaw = yaw;
        return;
    }

    let diff = Math.abs(yaw - lastYaw);
    if (diff > 180) diff = 360 - diff;

    if (diff > 30) {
        captureImage();
        lastYaw = yaw;
    }
});

// ================= CAPTURE =================
function captureImage() {

    if (!video.videoWidth) return;

    let canvas = document.createElement("canvas");
    let ctx = canvas.getContext("2d");

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    ctx.drawImage(video, 0, 0);

    sphereImages.push({
        img: canvas,
        yaw: yaw,
        pitch: pitch
    });

    statusText.innerText = `Captured: ${sphereImages.length}`;
}

// ================= SINGLE PHOTO =================
function captureSingle() {
    captureImage();
}

// ================= START =================
function startCapture() {
    sphereImages = [];
    capturing = true;
    lastYaw = null;

    statusText.innerText = "Move phone slowly in all directions 🌐";
}

// ================= CREATE SPHERE =================
function createSphere() {

    if (sphereImages.length === 0) {
        alert("No images captured!");
        return;
    }

    let cols = 12; // horizontal slices
    let rows = 4;  // vertical slices

    let imgW = sphereImages[0].img.width;
    let imgH = sphereImages[0].img.height;

    let canvas = document.createElement("canvas");
    let ctx = canvas.getContext("2d");

    canvas.width = cols * imgW;
    canvas.height = rows * imgH;

    sphereImages.forEach((data) => {

        let x = Math.floor((data.yaw / 360) * cols);
        let y = Math.floor(((data.pitch + 90) / 180) * rows);

        x = Math.max(0, Math.min(cols - 1, x));
        y = Math.max(0, Math.min(rows - 1, y));

        ctx.drawImage(data.img, x * imgW, y * imgH);
    });

    document.getElementById("output").innerHTML = "";
    document.getElementById("output").appendChild(canvas);

    capturing = false;
    statusText.innerText = "Sphere created 🌐";
}