window.addEventListener("load", () => {

const canvas = document.getElementById("renderCanvas");
const video = document.getElementById("video");
const dot = document.getElementById("dot");
const arrow = document.getElementById("arrow");
const progress = document.getElementById("progress");
const capCanvas = document.getElementById("capCanvas");

let engine, scene, camera3D;

let yawOffset = null;
let capturing = false;

let smoothYaw = 0;
let smoothPitch = 0;

let holding = false;
let holdStart = 0;

// ===== CAPTURE GRID =====
const rings = [
  { pitch: 0, yaws: [0, 90, 180, 270] },
  { pitch: 45, yaws: [0, 90, 180, 270] },
  { pitch: -45, yaws: [0, 90, 180, 270] }
];

let ringIndex = 0;
let targetIndex = 0;

// ===== INIT =====
function init3D(){
  engine = new BABYLON.Engine(canvas,true);
  scene = new BABYLON.Scene(engine);

  camera3D = new BABYLON.FreeCamera("cam", BABYLON.Vector3.Zero(), scene);

  new BABYLON.HemisphericLight("l", new BABYLON.Vector3(0,1,0), scene);

  const s = BABYLON.MeshBuilder.CreateSphere("s",{diameter:6},scene);
  const sm = new BABYLON.StandardMaterial("sm",scene);
  sm.wireframe = true;
  sm.alpha = 0.2;
  s.material = sm;

  engine.runRenderLoop(()=>scene.render());
}

// ===== CAPTURE =====
function captureFrame(){
  const ctx = capCanvas.getContext("2d");
  capCanvas.width = video.videoWidth;
  capCanvas.height = video.videoHeight;
  ctx.drawImage(video,0,0);
  return capCanvas.toDataURL("image/png");
}

// ===== PLACE IMAGE =====
function placeImage(img, yaw, pitch){

  const y = BABYLON.Tools.ToRadians(yaw);
  const p = BABYLON.Tools.ToRadians(pitch);

  const pos = new BABYLON.Vector3(
    Math.sin(y)*Math.cos(p),
    Math.sin(p),
    Math.cos(y)*Math.cos(p)
  ).scale(3);

  const plane = BABYLON.MeshBuilder.CreatePlane("img",{size:1},scene);

  plane.position = pos;
  plane.billboardMode = BABYLON.Mesh.BILLBOARDMODE_ALL;

  const tex = new BABYLON.DynamicTexture("dt",{width:512,height:512},scene);
  const ctx = tex.getContext();

  const image = new Image();
  image.onload = ()=>{
    ctx.drawImage(image,0,0,512,512);
    tex.update();
  };
  image.src = img;

  const mat = new BABYLON.StandardMaterial("mat",scene);
  mat.diffuseTexture = tex;

  plane.material = mat;
}

// ===== START =====
startBtn.onclick = async ()=>{
  if(DeviceOrientationEvent.requestPermission){
    await DeviceOrientationEvent.requestPermission();
  }

  const stream = await navigator.mediaDevices.getUserMedia({
    video:{facingMode:"environment"}
  });

  video.srcObject = stream;
  await video.play();

  init3D();
};

captureBtn.onclick = ()=>{
  capturing = true;
  yawOffset = null;
};

// ===== SENSOR =====
window.addEventListener("deviceorientation", e => {

  if(!camera3D || !capturing || e.alpha == null) return;

  let rawYaw = e.alpha;
  let rawPitch = e.beta - 90;

  if(yawOffset === null) yawOffset = rawYaw;

  let yaw = rawYaw - yawOffset;
  let pitch = rawPitch;

  smoothYaw = smoothYaw*0.85 + yaw*0.15;
  smoothPitch = smoothPitch*0.85 + pitch*0.15;

  camera3D.rotation.y = BABYLON.Tools.ToRadians(smoothYaw);
  camera3D.rotation.x = BABYLON.Tools.ToRadians(smoothPitch);

  // ===== TARGET =====
  const targetYaw = rings[ringIndex].yaws[targetIndex];
  const targetPitch = rings[ringIndex].pitch;

  let yawDiff = ((smoothYaw - targetYaw + 540) % 360) - 180;
  let pitchDiff = smoothPitch - targetPitch;

  // ===== DOT =====
  const maxOffset = 70;

  const x = Math.max(-maxOffset, Math.min(maxOffset, (yawDiff/30)*maxOffset));
  const y = Math.max(-maxOffset, Math.min(maxOffset, (pitchDiff/30)*maxOffset));

  dot.style.transform =
    `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))`;

  // ===== ARROW =====
  if(Math.abs(yawDiff) > Math.abs(pitchDiff)){
    arrow.innerText = yawDiff > 0 ? "⬅" : "➡";
  } else {
    arrow.innerText = pitchDiff > 0 ? "⬆" : "⬇";
  }

  // ===== ALIGN =====
  const aligned =
    Math.abs(yawDiff) < 10 &&
    Math.abs(pitchDiff) < 10;

  // ===== CAPTURE =====
  if(aligned){

    if(!holding){
      holding = true;
      holdStart = Date.now();
    }

    let p = (Date.now() - holdStart) / 700;

    progress.style.background =
      `conic-gradient(lime ${p*360}deg, transparent 0deg)`;

    if(p >= 1){

      const img = captureFrame();
      placeImage(img, targetYaw, targetPitch);

      holding = false;
      progress.style.background = "none";

      targetIndex++;

      if(targetIndex >= rings[ringIndex].yaws.length){
        ringIndex++;
        targetIndex = 0;

        if(ringIndex >= rings.length){
          alert("DONE");
          capturing = false;
        }
      }
    }

  } else {
    holding = false;
    progress.style.background = "none";
  }

});

});