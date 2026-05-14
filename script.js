window.addEventListener("load", () => {

  const startScreen =
    document.getElementById("startScreen");

  const captureScreen =
    document.getElementById("captureScreen");

  const resultScreen =
    document.getElementById("resultScreen");

  const video =
    document.getElementById("video");

  const dot =
    document.getElementById("dot");

  const arrow =
    document.getElementById("arrow");

  const progress =
    document.getElementById("progress");

  const debug =
    document.getElementById("debug");

  const statusText =
    document.getElementById("status");

  const modeButtons =
    document.querySelectorAll(".modeBtn");

  let smoothYaw = 0;
  let smoothPitch = 0;

  let stableYaw = 0;
  let stablePitch = 0;

  let displayYaw = 0;
  let displayPitch = 0;

  let captureCooldown = false;
  let isCapturing = false;

  let worldLockYaw = 0;
  let environmentLocked = false;

  let capturing = false;

  let holding = false;
  let holdStart = 0;

  let stream;

  let currentIndex = 0;

  let capturedImages = [];
  let captureData = [];

  let rings = [];
  let capturePoints = [];
  let totalPoints = 0;
  let selectedMode = "";
  let cameraFOV = {

    width: 0,
    height: 0,
    aspect: 0,

    horizontal: 0,
    vertical: 0,

    focalLength: 0

  };

  // =========================================
  // HELPERS
  // =========================================

  function norm360(a) {

    return (a % 360 + 360) % 360;

  }

  function angleDiff(a, b) {

    return ((a - b + 540) % 360) - 180;

  }

  function getPitch(beta) {

    let pitch = beta - 90;

    if (pitch > 90) pitch = 90;
    if (pitch < -90) pitch = -90;

    return pitch;

  }

  function estimateCameraFOV(
    width,
    height
  ) {

    const aspect =
      width / height;

    let horizontalFOV;

    if (aspect > 1.9) {

      horizontalFOV = 74;

    }

    else if (aspect > 1.7) {

      horizontalFOV = 69;

    }

    else if (aspect > 1.5) {

      horizontalFOV = 66;

    }

    else if (aspect > 1.3) {

      horizontalFOV = 62;

    }

    else {

      horizontalFOV = 58;

    }

    const verticalFOV =
      horizontalFOV / aspect;

    const focalLength =
      width /
      (
        2 *
        Math.tan(
          (
            horizontalFOV *
            Math.PI /
            180
          ) / 2
        )
      );

    return {

      horizontal:
        horizontalFOV,

      vertical:
        verticalFOV,

      focalLength

    };

  }

  // =========================================
  // CAPTURE MODES
  // =========================================

  function setCaptureMode(mode) {

    capturePoints = [];

    // =====================================
    // QUICK
    // =====================================

    if (mode === "quick") {

      rings = [

        {
          ring: 1,
          pitch: 0,

          yaws: [
            0, 20, 40, 60,
            80, 100, 120, 140,
            160, 180, 200, 220,
            240, 260, 280, 300,
            320, 340
          ]
        }

      ];

    }

    // =====================================
    // STANDARD
    // =====================================

    else if (mode === "standard") {

      rings = [

        // Horizon
        {
          ring: 1,
          pitch: 0,

          yaws: [
            0, 30, 60, 90,
            120, 150, 180, 210,
            240, 270, 300, 330
          ]
        },

        // Upper
        {
          ring: 2,
          pitch: 45,

          yaws: [
            0, 45, 90, 135,
            180, 225, 270, 315
          ]
        },

        // Top
        {
          ring: 3,
          pitch: 75,

          yaws: [
            0, 180
          ]
        },

        // Lower
        {
          ring: 4,
          pitch: -45,

          yaws: [
            22, 67, 112, 157,
            202, 247, 292, 337
          ]
        },

        // Bottom
        {
          ring: 5,
          pitch: -75,

          yaws: [
            90, 270
          ]
        }

      ];

    }

    // =====================================
    // PRO
    // =====================================

    else if (mode === "pro") {

      rings = [

        // Horizon
        {
          ring: 1,
          pitch: 0,

          yaws: [

            0, 25, 50, 75,
            100, 125, 150,
            175, 200, 225,
            250, 275, 300,
            325

          ]
        },

        // Upper Mid
        {
          ring: 2,
          pitch: 45,

          yaws: [

            18, 54, 90, 126,
            162, 198, 234, 270,
            306, 342

          ]
        },

        // Top
        {
          ring: 3,
          pitch: 75,

          yaws: [

            0, 120, 240

          ]
        },

        // Lower Mid
        {
          ring: 4,
          pitch: -45,

          yaws: [

            0, 36, 72, 108,
            144, 180, 216, 252,
            288, 324

          ]
        },

        // Bottom
        {
          ring: 5,
          pitch: -75,

          yaws: [

            60, 180, 300

          ]
        }

      ];

    }

    // =====================================
    // ULTRA
    // =====================================

    else {

      rings = [

        {
          ring: 1,
          pitch: 0,

          yaws: [

            0, 24, 48, 72,
            96, 120, 144, 168,
            192, 216, 240, 264,
            288, 312, 336

          ]
        },

        {
          ring: 2,
          pitch: 36,

          yaws: [

            0, 24, 48, 72,
            96, 120, 144, 168,
            192, 216, 240, 264,
            288, 312, 336

          ]
        },

        {
          ring: 3,
          pitch: 72,

          yaws: [

            0, 24, 48, 72,
            96, 120, 144, 168,
            192, 216, 240, 264,
            288, 312, 336

          ]
        },

        {
          ring: 4,
          pitch: -36,

          yaws: [

            12, 36, 60, 84,
            108, 132, 156, 180,
            204, 228, 252, 276,
            300, 324, 348

          ]
        },

        {
          ring: 5,
          pitch: -72,

          yaws: [

            12, 36, 60, 84,
            108, 132, 156, 180,
            204, 228, 252, 276,
            300, 324, 348

          ]
        }

      ];

    }

    rings.forEach(r => {

      r.yaws.forEach(yaw => {

        capturePoints.push({

          ring: r.ring,

          yaw,

          pitch: r.pitch

        });

      });

    });

    totalPoints =
      capturePoints.length;

  }

  // =========================================
  // BUTTONS
  // =========================================

  modeButtons.forEach(btn => {

    btn.onclick = async () => {

      currentIndex = 0;

      capturedImages = [];

      captureData = [];

      capturePoints = [];

      rings = [];

      totalPoints = 0;

      smoothYaw = 0;
      smoothPitch = 0;

      stableYaw = 0;
      stablePitch = 0;

      displayYaw = 0;
      displayPitch = 0;

      captureCooldown = false;

      isCapturing = false;

      holding = false;

      environmentLocked = false;

      worldLockYaw = 0;

      selectedMode =
        btn.dataset.mode;

      setCaptureMode(
        selectedMode
      );

      try {

        startScreen.style.display =
          "none";

        captureScreen.style.display =
          "block";

        if (
          typeof DeviceOrientationEvent !== "undefined" &&
          typeof DeviceOrientationEvent.requestPermission === "function"
        ) {

          await DeviceOrientationEvent
            .requestPermission();

        }

        stream =
          await navigator.mediaDevices
            .getUserMedia({

              video: {

                facingMode: {
                  ideal: "environment"
                },

                width: {
                  ideal: 2016
                },

                height: {
                  ideal: 1512
                }

              }

            });

        video.srcObject = stream;

        await video.play();

        cameraFOV.width =
          video.videoWidth;

        cameraFOV.height =
          video.videoHeight;

        cameraFOV.aspect =
          video.videoWidth /
          video.videoHeight;

        const estimatedFOV =
          estimateCameraFOV(
            video.videoWidth,
            video.videoHeight
          );

        cameraFOV.horizontal =
          estimatedFOV.horizontal;

        cameraFOV.vertical =
          estimatedFOV.vertical;

        cameraFOV.focalLength =
          estimatedFOV.focalLength;

        capturing = true;

      }

      catch (err) {

        debug.innerHTML =
          err;

      }

    };

  });

  // =========================================
  // DEVICE ORIENTATION
  // =========================================

  window.addEventListener(
    "deviceorientation",
    async e => {

      if (!capturing) return;

      if (
        captureCooldown ||
        isCapturing
      ) {
        return;
      }

      const alphaDeg =
        e.alpha || 0;

      const betaDeg =
        e.beta || 0;

      const gammaDeg =
        e.gamma || 0;

      const alpha =
        alphaDeg * Math.PI / 180;

      const beta =
        betaDeg * Math.PI / 180;

      const gamma =
        gammaDeg * Math.PI / 180;

      // Rotation matrix parts

      const cA = Math.cos(alpha);
      const sA = Math.sin(alpha);

      const cB = Math.cos(beta);
      const sB = Math.sin(beta);

      const cG = Math.cos(gamma);
      const sG = Math.sin(gamma);
      

      const xh =
        -cA * sG -
        sA * sB * cG;

      const yh =
        -sA * sG +
        cA * sB * cG;

      let rawYaw =
        Math.atan2(xh, yh) *
        180 / Math.PI;

      rawYaw =
        norm360(rawYaw);

      let rawPitch =
        getPitch(betaDeg);

      if (!environmentLocked) {

        worldLockYaw =
          rawYaw;

        environmentLocked = true;

      }

      let yaw =
        norm360(
          rawYaw - worldLockYaw
        );

      smoothYaw =
        norm360(

          smoothYaw +

          angleDiff(
            yaw,
            smoothYaw
          ) * 0.08

        );

      smoothPitch +=
        (rawPitch - smoothPitch) * 0.12;

      stableYaw =
        norm360(

          stableYaw +

          angleDiff(
            smoothYaw,
            stableYaw
          ) * 0.22

        );

      stablePitch +=
        (smoothPitch - stablePitch) * 0.22;

      displayYaw =
        norm360(

          displayYaw +

          angleDiff(
            stableYaw,
            displayYaw
          ) * 0.18

        );

      displayPitch +=
        (stablePitch - displayPitch) * 0.18;

      const active =
        capturePoints[currentIndex];

      if (!active) {

        finish();
        return;

      }

      let yawDiff =
        angleDiff(
          stableYaw,
          active.yaw
        );

      let pitchDiff =
        active.pitch -
        stablePitch;

      let visualYaw =
        angleDiff(
          displayYaw,
          active.yaw
        );

      let visualPitch =
        active.pitch -
        displayPitch;

      dot.style.transform =
        `
translate(
calc(-50% + ${-(visualYaw / 18) * 45}px),
calc(-50% + ${(visualPitch / 18) * 45}px)
)
`;

      const absYaw =
        Math.abs(yawDiff);

      const absPitch =
        Math.abs(pitchDiff);

      if (
        absYaw > 8 ||
        absPitch > 8
      ) {

        if (absYaw > absPitch) {

          arrow.innerText =
            yawDiff > 0 ? "⬅" : "➡";

        }

        else {

          arrow.innerText =
            pitchDiff > 0 ? "⬆" : "⬇";

        }

      }

      else {

        arrow.innerText =
          "✅";

      }

      statusText.innerHTML =
        `
Captured
${capturedImages.length}
/
${totalPoints}
`;

      const aligned =

        Math.abs(yawDiff) < 8 &&
        Math.abs(pitchDiff) < 8;

      const motionStable =

        Math.abs(
          angleDiff(
            smoothYaw,
            stableYaw
          )
        ) < 2.5 &&

        Math.abs(
          smoothPitch -
          stablePitch
        ) < 2.5;

      if (
        aligned &&
        motionStable
      ) {

        if (!holding) {

          holding = true;
          holdStart = Date.now();

        }

        let progressValue =
          (Date.now() - holdStart) / 900;

        progress.style.background =
          `
conic-gradient(
lime ${progressValue * 360}deg,
transparent 0deg
)
`;

        if (progressValue >= 1) {

          isCapturing = true;
          captureCooldown = true;

          await capture(active);

          currentIndex++;

          holding = false;

          progress.style.background =
            "none";

          await new Promise(r =>
            setTimeout(r, 350)
          );

          captureCooldown = false;
          isCapturing = false;

        }

      }

      else {

        holding = false;

        progress.style.background =
          "none";

      }

      debug.innerHTML =
        `
Captured:
${capturedImages.length}
/
${totalPoints}

<br><br>

Ring:
${active.ring}

<br>

Yaw:
${stableYaw.toFixed(1)}

<br>

Pitch:
${stablePitch.toFixed(1)}

<br><br>

Target Yaw:
${active.yaw}

<br>

Target Pitch:
${active.pitch}

<br><br>

HFOV:
${cameraFOV.horizontal.toFixed(1)}

<br>

VFOV:
${cameraFOV.vertical.toFixed(1)}

<br>

Focal:
${cameraFOV.focalLength.toFixed(1)}
`;

    });

  // =========================================
  // CAPTURE
  // =========================================

  async function capture(active) {

    const canvas =
      document.createElement("canvas");

    canvas.width =
      video.videoWidth;

    canvas.height =
      video.videoHeight;

    const ctx =
      canvas.getContext("2d");

    ctx.drawImage(
      video,
      0,
      0
    );

    const img =
      canvas.toDataURL(
        "image/jpeg",
        0.92
      );

    capturedImages.push(img);

    captureData.push({

      degrees:
        Math.round(active.yaw),

      ring:
        active.ring,

      sensors: {

        fileUri:
          `img-r${active.ring}-${String(
            Math.round(active.yaw)
          ).padStart(3, "0")}.jpg`,

        roll_pitch_yaw: {

          pitch:
            stablePitch,

          roll:
            window.orientation || 0,

          yaw:
            stableYaw

        }

      }

    });

  }

  // =========================================
  // FINISH
  // =========================================

  function finish() {

    capturing = false;

    if (stream) {

      stream.getTracks()
        .forEach(track => {

          track.stop();

        });

    }

    captureScreen.style.display =
      "none";

    resultScreen.style.display =
      "block";

    const gallery =
      document.getElementById(
        "gallery"
      );

    gallery.innerHTML = "";

    capturedImages.forEach(img => {

      const el =
        document.createElement("img");

      el.src = img;

      gallery.appendChild(el);

    });

  }

  // =========================================
  // DOWNLOAD ZIP
  // =========================================

  document.getElementById(
    "downloadBtn"
  ).onclick = async () => {

    const zip =
      new JSZip();

    capturedImages.forEach((img, i) => {

      zip.file(

        captureData[i]
          .sensors
          .fileUri,

        img.split(",")[1],

        {
          base64: true
        }

      );

    });

    zip.file(

      "data.json",

      JSON.stringify({

        mode:
          selectedMode,

        totalPhotos:
          capturedImages.length,

        capturedAt:
          new Date().toISOString(),

        angleViewX:
          cameraFOV.horizontal,

        angleViewY:
          cameraFOV.vertical,

        focalLength:
          cameraFOV.focalLength,

        pictures:
          captureData

      },
        null,
        2)

    );

    const blob =
      await zip.generateAsync({

        type: "blob"

      });

    const now =
      new Date();

    const pad = n =>
      String(n).padStart(2, "0");

    const timestamp =

      `${now.getFullYear()}-` +
      `${pad(now.getMonth() + 1)}-` +
      `${pad(now.getDate())}_` +

      `${pad(now.getHours())}-` +
      `${pad(now.getMinutes())}-` +
      `${pad(now.getSeconds())}`;

    const filename =

      `360_` +
      `${selectedMode}_` +
      `${capturedImages.length}photos_` +
      `${timestamp}.zip`;

    const a =
      document.createElement("a");

    a.href =
      URL.createObjectURL(blob);

    a.download =
      filename;

    a.click();

  };

});