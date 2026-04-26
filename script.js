const video = document.getElementById("video");
const canvas = document.getElementById("canvas");
const gallery = document.getElementById("gallery");

const previewModal = document.getElementById("previewModal");
const previewImg = document.getElementById("previewImg");

const startBtn = document.getElementById("startCapture");
const resultScreen = document.getElementById("resultScreen");
const cameraScreen = document.getElementById("cameraScreen");

const downloadBtn = document.getElementById("downloadAll");

let capturedImages = [];
let captureComplete = false;

// CAMERA
async function startCamera() {
    const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" }
    });
    video.srcObject = stream;
}

// START
startBtn.onclick = async () => {
    cameraScreen.classList.remove("hidden");
    await startCamera();

    // simulate capture loop
    let count = 0;
    let interval = setInterval(() => {
        capture();

        count++;
        if (count >= 32) {
            clearInterval(interval);
            finishCapture();
        }
    }, 500);
};

// CAPTURE
function capture() {

    const ctx = canvas.getContext("2d");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    ctx.drawImage(video, 0, 0);

    const imgData = canvas.toDataURL("image/png");

    capturedImages.push(imgData);

    const img = document.createElement("img");
    img.src = imgData;

    gallery.appendChild(img);
}

// 🔥 CLICK CONTROL (MAIN FIX)
gallery.addEventListener("click", (e) => {

    // ❌ DURING CAPTURE → DO NOTHING
   // if (!captureComplete) return;

    // ✅ AFTER COMPLETE → ENABLE PREVIEW
    if (e.target.tagName === "IMG") {
        const index = Array.from(gallery.children).indexOf(e.target);

        previewModal.style.display = "block";
        previewImg.src = capturedImages[index];
    }
});

// FINISH
function finishCapture() {

    captureComplete = true;

    cameraScreen.classList.add("hidden");
    resultScreen.classList.remove("hidden");
}

// CLOSE PREVIEW
previewModal.onclick = () => {
    previewModal.style.display = "none";
};

// DOWNLOAD
downloadBtn.onclick = async () => {
    const zip = new JSZip();

    capturedImages.forEach((img, i) => {
        zip.file(`img_${i}.png`, img.split(",")[1], { base64:true });
    });

    const blob = await zip.generateAsync({ type:"blob" });

    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "photos.zip";
    a.click();
};