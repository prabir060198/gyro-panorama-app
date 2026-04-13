const video = document.getElementById("video");
const statusText = document.getElementById("status");
const angleUI = document.getElementById("angleUI");

let images = [];
let lastAngle = null;
let capturing = false;
let captureCount = 0;

// ================= CAMERA =================
async function startCamera() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: "environment" },
            audio: false
        });

        video.srcObject = stream;
        statusText.innerText = "Camera started ✅";

    } catch (err) {
        statusText.innerText = "Camera failed ❌";
        alert("Use HTTPS + allow camera");
    }
}

// ================= SENSOR =================
function requestPermission() {

    if (typeof DeviceOrientationEvent !== "undefined" &&
        typeof DeviceOrientationEvent.requestPermission === "function") {

        DeviceOrientationEvent.requestPermission()
        .then(state => {
            if (state === "granted") {
                statusText.innerText = "Sensor enabled ✅";
            } else {
                statusText.innerText = "Sensor denied ❌";
            }
        })
        .catch(console.error);

    } else {
        statusText.innerText = "Sensor ready ✅";
    }
}

// ================= GYRO (FIXED) =================
window.addEventListener("deviceorientation", (event) => {

    let alpha = event.alpha;
    let beta = event.beta;
    let gamma = event.gamma;

    // ❌ No sensor data
    if (alpha === null && beta === null) {
        angleUI.innerText = "Gyro not supported ❌";
        return;
    }

    // 🔁 Choose best axis
    let angle = 0;

    if (alpha && alpha !== 0) {
        angle = alpha;
    } else if (beta && beta !== 0) {
        angle = beta;
    } else if (gamma && gamma !== 0) {
        angle = gamma;
    }

    angle = Math.round(angle);

    // 📺 Show debug
    angleUI.innerText =
        `Angle: ${angle}°
Alpha: ${Math.round(alpha || 0)}
Beta: ${Math.round(beta || 0)}
Gamma: ${Math.round(gamma || 0)}`;

    // ================= PANORAMA CAPTURE =================
    if (!capturing) return;

    if (lastAngle === null) {
        lastAngle = angle;
        captureImage(angle);
        return;
    }

    let diff = Math.abs(angle - lastAngle);
    if (diff > 180) diff = 360 - diff;

    if (diff > 25) {
        captureImage(angle);
        lastAngle = angle;
    }

    statusText.innerText =
        `Angle: ${angle}° | Captured: ${captureCount}`;
});

// ================= SINGLE PHOTO =================
function captureSingle() {

    if (!video.videoWidth) {
        alert("Camera not ready!");
        return;
    }

    let canvas = document.createElement("canvas");
    let ctx = canvas.getContext("2d");

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    ctx.drawImage(video, 0, 0);

    const img = document.createElement("img");
    img.src = canvas.toDataURL("image/png");

    document.getElementById("gallery").prepend(img);

    statusText.innerText = "Photo captured ✅";
}

// ================= PANORAMA =================
function startCapture() {
    images = [];
    captureCount = 0;
    capturing = true;
    lastAngle = null;

    statusText.innerText = "Rotate slowly 📱";
}

function captureImage(angle) {

    if (!video.videoWidth) return;

    let canvas = document.createElement("canvas");
    let ctx = canvas.getContext("2d");

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    ctx.drawImage(video, 0, 0);

    images.push(canvas);
    captureCount++;
}

function createPanorama() {

    if (images.length === 0) {
        alert("No images!");
        return;
    }

    let width = images[0].width * images.length;
    let height = images[0].height;

    let canvas = document.createElement("canvas");
    let ctx = canvas.getContext("2d");

    canvas.width = width;
    canvas.height = height;

    images.forEach((img, index) => {
        ctx.drawImage(img, index * img.width, 0);
    });

    document.getElementById("output").innerHTML = "";
    document.getElementById("output").appendChild(canvas);

    capturing = false;
    statusText.innerText = "Panorama created ✅";
}