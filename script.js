const video = document.getElementById("video");
const statusText = document.getElementById("status");

let images = [];
let lastAngle = null;
let capturing = false;
let captureCount = 0;

// ================= START CAMERA (USER CLICK REQUIRED) =================
async function startCamera() {

    statusText.innerText = "Requesting camera permission...";

    try {
        const stream = await navigator.mediaDevices.getUserMedia({
            video: {
                facingMode: "environment"
            },
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

        alert(
            "Camera Error:\n" + err.message +
            "\n\n👉 Make sure:\n- Using HTTPS\n- Allowed permission\n- Using Chrome"
        );
    }
}

// ================= SENSOR PERMISSION =================
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
        statusText.innerText = "Sensor ready (Android)";
    }
}

// ================= START CAPTURE =================
function startCapture() {
    images = [];
    captureCount = 0;
    capturing = true;
    lastAngle = null;

    statusText.innerText = "Rotate slowly 📱";
}

// ================= GYROSCOPE =================
window.addEventListener("deviceorientation", (event) => {

    if (!capturing) return;

    let angle = Math.round(event.alpha || 0);

    if (lastAngle === null) {
        lastAngle = angle;
        captureImage(angle);
        return;
    }

    let diff = Math.abs(angle - lastAngle);

    // Fix wrap (0 ↔ 360)
    if (diff > 180) diff = 360 - diff;

    if (diff > 25) {
        captureImage(angle);
        lastAngle = angle;
    }

    statusText.innerText =
        `Angle: ${angle}° | Captured: ${captureCount}`;
});

// ================= CAPTURE =================
function captureImage(angle) {

    if (!video.videoWidth) return;

    let canvas = document.createElement("canvas");
    let ctx = canvas.getContext("2d");

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    ctx.drawImage(video, 0, 0);

    images.push(canvas);
    captureCount++;

    console.log("Captured:", captureCount, "Angle:", angle);
}

// ================= PANORAMA =================
function createPanorama() {

    if (images.length === 0) {
        alert("No images captured!");
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

    const output = document.getElementById("output");
    output.innerHTML = "";
    output.appendChild(canvas);

    statusText.innerText = "Panorama created ✅";
}