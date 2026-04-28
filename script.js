
// ===== ELEMENTS =====
const video = document.getElementById("video");
const canvas = document.getElementById("canvas");

const startScreen = document.getElementById("startScreen");
const cameraScreen = document.getElementById("cameraScreen");
const resultScreen = document.getElementById("resultScreen");

const dot = document.getElementById("dot");
const arrow = document.getElementById("arrow");
const progressEl = document.getElementById("progress");

const gallery = document.getElementById("gallery");
const statusText = document.getElementById("statusText");

const previewPopup = document.getElementById("previewPopup");
const previewImg = document.getElementById("previewImg");

// DEBUG UI
const dbgYaw = document.getElementById("dbgYaw");
const dbgPitch = document.getElementById("dbgPitch");
const dbgTargetYaw = document.getElementById("dbgTargetYaw");
const dbgTargetPitch = document.getElementById("dbgTargetPitch");
const debugBox = document.getElementById("debugBox");

// ===== STATE =====
let capturedImages = [];
let captureData = [];

let currentYaw = 0;
let currentPitch = 0;
let currentRoll = 0;

let capturing = false;
let ringIndex = 0;
let targetIndex = 0;

let holding = false;
let holdStart = 0;

// ===== RING PATTERN =====
const rings = [
    { pitch: 75, yaws: [45, 225] },
    { pitch: 45, yaws: [22.5, 67.5, 112.5, 157.5, 202.5, 247.5, 292.5, 337.5] },
    { pitch: 0, yaws: [0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330] },
    { pitch: -45, yaws: [22.5, 67.5, 112.5, 157.5, 202.5, 247.5, 292.5, 337.5] },
    { pitch: -75, yaws: [135, 315] }
];

// ===== START CAMERA =====
document.getElementById("startBtn").onclick = async () => {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: "environment" }
        });

        video.srcObject = stream;
        await video.play();

        startScreen.classList.add("hidden");
        cameraScreen.classList.remove("hidden");

    } catch (e) {
        alert("Camera error: " + e.message);
        console.error(e);
    }
};

// ===== START CAPTURE =====
document.getElementById("captureBtn").onclick = () => {
    capturing = true;
    window.addEventListener("deviceorientation", handleOrientation);
};

// ===== HELPERS =====

// normalize angle to [-180, 180]
function normalizeAngle(a) {
    return ((a + 540) % 360) - 180;
}

// clamp
function clamp(v, min, max) {
    return Math.max(min, Math.min(max, v));
}

// ===== MAIN ORIENTATION =====
function handleOrientation(e) {

    if (!capturing || e.alpha == null) return;

    // ----- YAW -----
    currentYaw = (e.alpha + 360) % 360;

    // ----- PITCH (CRITICAL FIX) -----
    // Convert device beta → camera pitch (-90 to +90)
    currentPitch = (e.beta - 90);
    currentPitch = Math.max(-90, Math.min(90, currentPitch));

    // ----- ROLL -----
    currentRoll = e.gamma || 0;

    const targetYaw = rings[ringIndex].yaws[targetIndex];
    const targetPitch = rings[ringIndex].pitch;

    // ----- DIFF -----
    let yawDiff = normalizeAngle(currentYaw - targetYaw);
    let pitchDiff = currentPitch - targetPitch;

    // ===== DEBUG UI =====
    dbgYaw.innerText = currentYaw.toFixed(1);
    dbgPitch.innerText = currentPitch.toFixed(1);
    dbgTargetYaw.innerText = targetYaw;
    dbgTargetPitch.innerText = targetPitch;

    // green when aligned
    debugBox.style.border =
        (Math.abs(yawDiff) < 6 && Math.abs(pitchDiff) < 8)
            ? "2px solid lime"
            : "2px solid red";

    // ===== DOT (FIXED MAPPING) =====
    const maxOffset = 80;

    const x = clamp((yawDiff / 30) * maxOffset, -maxOffset, maxOffset);
    const y = clamp((pitchDiff / 30) * maxOffset, -maxOffset, maxOffset);

    dot.style.transform =
        `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))`;

    // ===== ARROW (FIXED DIRECTION) =====
    arrow.innerText =
        Math.abs(yawDiff) > 6 ? (yawDiff > 0 ? "➡" : "⬅") :
            Math.abs(pitchDiff) > 8 ? (pitchDiff > 0 ? "⬇" : "⬆") : "●";

    // ===== HOLD CAPTURE =====
    if (Math.abs(yawDiff) < 6 && Math.abs(pitchDiff) < 8) {

        if (!holding) {
            holding = true;
            holdStart = Date.now();
        }

        let progress = Math.min((Date.now() - holdStart) / 800, 1);

        progressEl.style.background =
            `conic-gradient(#00c853 ${progress * 360}deg, transparent 0deg)`;

        if (progress >= 1) {

            capture(targetYaw, targetPitch);

            holding = false;
            progressEl.style.background =
                `conic-gradient(#888 0deg, transparent 0deg)`;

            targetIndex++;

            if (targetIndex >= rings[ringIndex].yaws.length) {
                ringIndex++;
                targetIndex = 0;

                if (ringIndex >= rings.length) {
                    finish();
                    return;
                }
            }
        }

    } else {
        holding = false;
        progressEl.style.background =
            `conic-gradient(#888 0deg, transparent 0deg)`;
    }

    statusText.innerText = `${capturedImages.length}/32`;
}

// ===== CAPTURE =====
function capture(targetYaw, targetPitch) {

    const ctx = canvas.getContext("2d");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    ctx.drawImage(video, 0, 0);

    const img = canvas.toDataURL("image/png");

    capturedImages.push(img);

    captureData.push({
        name: `img_${capturedImages.length}.png`,
        target: { yaw: targetYaw, pitch: targetPitch },
        actual: {
            yaw: currentYaw,
            pitch: currentPitch,
            roll: currentRoll
        },
        time: Date.now()
    });
}

// ===== FINISH =====
function finish() {

    capturing = false;
    window.removeEventListener("deviceorientation", handleOrientation);

    cameraScreen.classList.add("hidden");
    resultScreen.classList.remove("hidden");

    capturedImages.forEach(img => {
        const el = document.createElement("img");
        el.src = img;

        el.onclick = () => {
            previewImg.src = img;
            previewPopup.classList.remove("hidden");
        };

        gallery.appendChild(el);
    });
}

// ===== PREVIEW CLOSE =====
previewPopup.onclick = () => previewPopup.classList.add("hidden");

// ===== DOWNLOAD (FIXED) =====
document.getElementById("downloadBtn").onclick = async () => {

    const zip = new JSZip();

    capturedImages.forEach((img, i) => {
        zip.file(`img_${i + 1}.png`, img.split(",")[1], { base64: true });
    });

    zip.file("metadata.json", JSON.stringify({
        total: capturedImages.length,
        images: captureData
    }, null, 2));

    const blob = await zip.generateAsync({ type: "blob" });

    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = "photosphere.zip";

    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    URL.revokeObjectURL(url);
};

// ===== RETAKE =====
document.getElementById("retakeBtn").onclick = () => location.reload();