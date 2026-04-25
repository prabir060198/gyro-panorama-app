const video = document.getElementById('video');
const canvas = document.getElementById('canvas');
const gallery = document.getElementById('gallery');

const angleText = document.getElementById('angleText');
const targetText = document.getElementById('targetText');
const startGuideBtn = document.getElementById('startGuide');

let stream = null;
let currentAngle = 0;

// Target angles
const targets = [0, 90, 180, 270];
let currentTargetIndex = 0;

// Store captured flags
let capturedFlags = [false, false, false, false];

// Start camera
async function startCamera() {
    try {
        stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: "environment" },
            audio: false
        });
        video.srcObject = stream;
    } catch (err) {
        alert("Camera error: " + err.message);
    }
}
startCamera();

// Normalize angle
function normalize(angle) {
    return (angle + 360) % 360;
}

// Capture image
function capturePhoto(index) {
    const ctx = canvas.getContext('2d');

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    ctx.drawImage(video, 0, 0);

    const imgData = canvas.toDataURL("image/png");

    const img = document.createElement("img");
    img.src = imgData;
    gallery.appendChild(img);

    capturedFlags[index] = true;
}

// Gyro handler
function handleOrientation(event) {
    let alpha = event.alpha;

    if (alpha === null) return;

    currentAngle = normalize(alpha);

    angleText.innerText = "Angle: " + Math.round(currentAngle) + "°";

    let target = targets[currentTargetIndex];
    targetText.innerText = "Target: " + target + "°";

    // tolerance ±10°
    let diff = Math.abs(currentAngle - target);

    if (diff > 180) diff = 360 - diff;

    if (diff < 10) {
        if (!capturedFlags[currentTargetIndex]) {

            capturePhoto(currentTargetIndex);

            currentTargetIndex++;

            if (currentTargetIndex >= targets.length) {
                window.removeEventListener('deviceorientation', handleOrientation);
                alert("✅ All 4 directions captured!");
            }
        }
    }
}

// Start guided capture
startGuideBtn.addEventListener('click', () => {

    currentTargetIndex = 0;
    capturedFlags = [false, false, false, false];
    gallery.innerHTML = "";

    // iOS permission
    if (typeof DeviceOrientationEvent.requestPermission === 'function') {
        DeviceOrientationEvent.requestPermission()
            .then(response => {
                if (response === 'granted') {
                    window.addEventListener('deviceorientation', handleOrientation);
                } else {
                    alert("Permission denied");
                }
            })
            .catch(console.error);
    } else {
        window.addEventListener('deviceorientation', handleOrientation);
    }
});