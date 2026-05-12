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

  let previousDescriptors = null;

  let featureMatchScore = 0;
  let overlapConfidence = 0;
  let homographyValid = false;
  let visualStable = false;
  let blurScore = 0;

  let cameraFOV = {

    width: 0,
    height: 0,
    aspect: 0,

    horizontal: 0,
    vertical: 0,

    focalLength: 0

  };

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

  function detectBlur(gray) {

    const lap = new cv.Mat();

    cv.Laplacian(
      gray,
      lap,
      cv.CV_64F
    );

    const mean = new cv.Mat();
    const stddev = new cv.Mat();

    cv.meanStdDev(
      lap,
      mean,
      stddev
    );

    const variance =
      stddev.doubleAt(0, 0) *
      stddev.doubleAt(0, 0);

    lap.delete();
    mean.delete();
    stddev.delete();

    return variance;

  }

  async function analyzeFrameFeatures() {

    if (
      typeof cv === "undefined" ||
      !video.videoWidth
    ) {
      return;
    }

    const canvas =
      document.createElement("canvas");

    canvas.width = 320;
    canvas.height = 240;

    const ctx =
      canvas.getContext("2d");

    ctx.drawImage(
      video,
      0,
      0,
      canvas.width,
      canvas.height
    );

    const src =
      cv.imread(canvas);

    const gray =
      new cv.Mat();

    cv.cvtColor(
      src,
      gray,
      cv.COLOR_RGBA2GRAY
    );

    blurScore =
      detectBlur(gray);

    const orb =
      new cv.ORB(1200);

    const keypoints =
      new cv.KeyPointVector();

    const descriptors =
      new cv.Mat();

    orb.detectAndCompute(
      gray,
      new cv.Mat(),
      keypoints,
      descriptors
    );

    featureMatchScore = 0;
    overlapConfidence = 0;
    homographyValid = false;
    visualStable = false;

    if (
      previousDescriptors &&
      !previousDescriptors.empty() &&
      !descriptors.empty()
    ) {

      const matcher =
        new cv.BFMatcher(
          cv.NORM_HAMMING,
          false
        );

      const matches =
        new cv.DMatchVectorVector();

      matcher.knnMatch(
        descriptors,
        previousDescriptors,
        matches,
        2
      );

      let goodMatches = 0;

      for (
        let i = 0;
        i < matches.size();
        i++
      ) {

        const pair =
          matches.get(i);

        if (pair.size() < 2)
          continue;

        const m1 = pair.get(0);
        const m2 = pair.get(1);

        if (
          m1.distance <
          0.72 * m2.distance
        ) {

          goodMatches++;

        }

      }

      featureMatchScore =
        goodMatches /
        Math.max(
          keypoints.size(),
          1
        );

      overlapConfidence =
        Math.min(
          featureMatchScore * 2.5,
          1
        );

      homographyValid =
        goodMatches > 35;

      visualStable =
        goodMatches > 45 &&
        blurScore > 80;

      matches.delete();
      matcher.delete();

    }

    if (previousDescriptors) {

      previousDescriptors.delete();

    }

    previousDescriptors =
      descriptors.clone();

    src.delete();
    gray.delete();
    descriptors.delete();
    keypoints.delete();
    orb.delete();

  }

  function estimateCameraFOV(
    width,
    height
  ) {

    const aspect =
      width / height;

    const horizontalFOV = 68;

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

  function setCaptureMode(mode) {

    capturePoints = [];

    rings = [

      {
        pitch: 75,
        yaws: [0, 120, 240]
      },

      {
        pitch: 45,
        yaws: [
          0, 36, 72, 108, 144,
          180, 216, 252, 288, 324
        ]
      },

      {
        pitch: 10,
        yaws: [
          0, 25, 50, 75,
          100, 125, 150, 175,
          200, 225, 250, 275,
          300, 325
        ]
      },

      {
        pitch: -25,
        yaws: [
          12, 42, 72, 102,
          132, 162, 192, 222,
          252, 282, 312, 342
        ]
      },

      {
        pitch: -70,
        yaws: [45, 135, 225, 315]
      }

    ];

    rings.forEach(r => {

      r.yaws.forEach(yaw => {

        capturePoints.push({

          yaw,
          pitch: r.pitch

        });

      });

    });

    totalPoints =
      capturePoints.length;

  }

  modeButtons.forEach(btn => {

    btn.onclick = async () => {

      setCaptureMode(
        btn.dataset.mode
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
                  ideal: 1920
                },

                height: {
                  ideal: 1080
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

      let rawYaw =
        360 - e.alpha;

      let rawPitch =
        getPitch(
          e.beta || 0
        );

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
          ) * 0.06

        );

      smoothPitch +=
        (rawPitch - smoothPitch) * 0.08;

      stableYaw =
        norm360(

          stableYaw +

          angleDiff(
            smoothYaw,
            stableYaw
          ) * 0.18

        );

      stablePitch +=
        (smoothPitch - stablePitch) * 0.18;

      displayYaw =
        norm360(

          displayYaw +

          angleDiff(
            stableYaw,
            displayYaw
          ) * 0.15

        );

      displayPitch +=
        (stablePitch - displayPitch) * 0.15;

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
calc(-50% + ${-(visualYaw / 20) * 40}px),
calc(-50% + ${(visualPitch / 20) * 40}px)
)
`;

      await analyzeFrameFeatures();

      const sensorAligned =

        Math.abs(yawDiff) < 7 &&
        Math.abs(pitchDiff) < 7;

      const aligned =

        sensorAligned &&
        overlapConfidence > 0.12 &&
        homographyValid;

      const motionStable =

        Math.abs(
          angleDiff(
            smoothYaw,
            stableYaw
          )
        ) < 1.8 &&

        Math.abs(
          smoothPitch -
          stablePitch
        ) < 1.8 &&

        visualStable;

      if (
        Math.abs(yawDiff) > 7 ||
        Math.abs(pitchDiff) > 7
      ) {

        if (
          Math.abs(yawDiff) >
          Math.abs(pitchDiff)
        ) {

          arrow.innerText =
            yawDiff > 0
              ? "⬅"
              : "➡";

        }

        else {

          arrow.innerText =
            pitchDiff > 0
              ? "⬆"
              : "⬇";

        }

      }

      else {

        arrow.innerText =
          "✅";

      }

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

          if (
            overlapConfidence > 0.85
          ) {

            holding = false;

            progress.style.background =
              "none";

            return;

          }

          isCapturing = true;
          captureCooldown = true;

          await capture(active);

          currentIndex++;

          holding = false;

          progress.style.background =
            "none";

          await new Promise(r =>
            setTimeout(r, 450)
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

      statusText.innerHTML =
        `
Captured
${capturedImages.length}
/
${totalPoints}
`;

      debug.innerHTML =
        `
Feature:
${featureMatchScore.toFixed(3)}

<br>

Overlap:
${(overlapConfidence * 100).toFixed(1)}%

<br>

Blur:
${blurScore.toFixed(0)}

<br>

Visual Stable:
${visualStable}

<br><br>

Yaw:
${stableYaw.toFixed(1)}

<br>

Pitch:
${stablePitch.toFixed(1)}

<br><br>

Target:
${active.yaw}
/
${active.pitch}

<br><br>

Motion Stable:
${motionStable}
`;

    });

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
        "image/png"
      );

    capturedImages.push(img);

    captureData.push({

      file:
        `img_${capturedImages.length}.png`,

      yaw:
        stableYaw,

      pitch:
        stablePitch,

      targetYaw:
        active.yaw,

      targetPitch:
        active.pitch,

      overlap:
        overlapConfidence,

      blur:
        blurScore,

      featureScore:
        featureMatchScore,

      camera: {

        width:
          cameraFOV.width,

        height:
          cameraFOV.height,

        aspect:
          cameraFOV.aspect,

        horizontal:
          cameraFOV.horizontal,

        vertical:
          cameraFOV.vertical,

        focalLength:
          cameraFOV.focalLength

      },

      timestamp:
        Date.now()

    });

  }

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

    capturedImages.forEach(img => {

      const el =
        document.createElement("img");

      el.src = img;

      gallery.appendChild(el);

    });

  }

  document.getElementById(
    "downloadBtn"
  ).onclick = async () => {

    const zip =
      new JSZip();

    capturedImages.forEach((img, i) => {

      zip.file(

        `img_${i + 1}.png`,

        img.split(",")[1],

        {
          base64: true
        }

      );

    });

    zip.file(

      "data.json",

      JSON.stringify({

        camera: cameraFOV,

        images:
          captureData

      },
        null,
        2)

    );

    const blob =
      await zip.generateAsync({

        type: "blob"

      });

    const a =
      document.createElement("a");

    a.href =
      URL.createObjectURL(blob);

    a.download =
      "360_capture.zip";

    a.click();

  };

});