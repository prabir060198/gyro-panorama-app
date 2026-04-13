const video = document.getElementById("video");
const statusText = document.getElementById("status");
const angleUI = document.getElementById("angleUI");

let images = [];
let lastAngle = null;
let capturing = false;
let captureCount = 0;

// ================= CAMERA =================
async function startCamera() {

    statusText.innerText = "Requesting camera...";

    try {
        const stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: "environment" },
            audio: false
        });

        video.srcObject = stream;

        video.onloadedmetadata = () => {
            video.play();
            statusText.innerText = "Camera started ✅";
        };

    } catch (err) {
        console.error(err);
        statusText.innerText = "Camera failed ❌";
        alert("Allow camera + use HTTPS");
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

// ================= LIVE GYRO =================
window.addEventListener("deviceorientation", (event) => {

    let angle = Math.round(event.alpha || 0);
    angleUI.innerText = "Angle: " + angle + "°";

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

// ================= SINGLE CAPTURE =================
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