window.addEventListener("load", () => {

  const canvas = document.getElementById("renderCanvas");
  const video = document.getElementById("video");

  const dbgYaw = document.getElementById("dbgYaw");
  const dbgPitch = document.getElementById("dbgPitch");
  const dbgRoll = document.getElementById("dbgRoll");
  const dbgTYaw = document.getElementById("dbgTYaw");
  const dbgTPitch = document.getElementById("dbgTPitch");
  const dbgFov = document.getElementById("dbgFov");

  let engine, scene, camera;

  let currentYaw = 0;
  let currentPitch = 0;
  let yawOffset = null;

  let capturing = false;
  let holding = false;
  let holdStart = 0;

  let ringIndex = 0;
  let targetIndex = 0;

  let guidePoints = [];

  // ===== GRID =====
  const rings = [
    { pitch: 75, yaws: [0,180] },
    { pitch: 45, yaws: [0,45,90,135,180,225,270,315] },
    { pitch: 0,  yaws: [0,30,60,90,120,150,180,210,240,270,300,330] },
    { pitch: -45, yaws: [0,45,90,135,180,225,270,315] },
    { pitch: -75, yaws: [90,270] }
  ];

  // ===== INIT 3D =====
  function init3D() {

    engine = new BABYLON.Engine(canvas, true);
    scene = new BABYLON.Scene(engine);

    camera = new BABYLON.FreeCamera("cam", BABYLON.Vector3.Zero(), scene);

    new BABYLON.HemisphericLight("l", new BABYLON.Vector3(0,1,0), scene);

    const sphere = BABYLON.MeshBuilder.CreateSphere("s", {diameter:6}, scene);
    const mat = new BABYLON.StandardMaterial("m", scene);
    mat.wireframe = true;
    mat.alpha = 0.3;
    sphere.material = mat;

    createPoints();

    engine.runRenderLoop(() => scene.render());
  }

  // ===== POINTS =====
  function spherical(yaw, pitch) {
    const y = BABYLON.Tools.ToRadians(yaw);
    const p = BABYLON.Tools.ToRadians(pitch);

    return new BABYLON.Vector3(
      Math.sin(y)*Math.cos(p),
      Math.sin(p),
      Math.cos(y)*Math.cos(p)
    ).scale(3);
  }

  function createPoints() {
    rings.forEach((r, ri) => {
      r.yaws.forEach((y, yi) => {

        const mesh = BABYLON.MeshBuilder.CreateSphere("p",{diameter:0.15},scene);
        mesh.position = spherical(y, r.pitch);

        const m = new BABYLON.StandardMaterial("m", scene);
        m.emissiveColor = new BABYLON.Color3(1,1,1);
        mesh.material = m;

        guidePoints.push({mesh, ri, yi, done:false});
      });
    });
  }

  // ===== START =====
  startBtn.onclick = async () => {

    if (DeviceOrientationEvent.requestPermission) {
      await DeviceOrientationEvent.requestPermission();
    }

    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "environment" }
    });

    video.srcObject = stream;
    await video.play();

    init3D();
  };

  captureBtn.onclick = () => {
    capturing = true;
    yawOffset = null;
  };

  function norm(a){ return ((a+540)%360)-180; }

  // ===== ORIENTATION =====
  window.addEventListener("deviceorientation", e => {

    if (!camera || !capturing || e.alpha==null) return;

    let yaw = (e.alpha+360)%360;
    let pitch = -(e.beta-90);
    let roll = e.gamma || 0;

    pitch = Math.max(-90, Math.min(90, pitch));

    if (yawOffset===null) yawOffset=yaw;
    yaw = (yaw - yawOffset +360)%360;

    currentYaw = currentYaw*0.85 + yaw*0.15;
    currentPitch = currentPitch*0.85 + pitch*0.15;

    camera.rotation.y = BABYLON.Tools.ToRadians(currentYaw);
    camera.rotation.x = BABYLON.Tools.ToRadians(currentPitch);

    // ===== DEBUG =====
    const tYaw = rings[ringIndex]?.yaws[targetIndex] ?? 0;
    const tPitch = rings[ringIndex]?.pitch ?? 0;

    dbgYaw.innerText = currentYaw.toFixed(1);
    dbgPitch.innerText = currentPitch.toFixed(1);
    dbgRoll.innerText = roll.toFixed(1);
    dbgTYaw.innerText = tYaw;
    dbgTPitch.innerText = tPitch;
    dbgFov.innerText = (camera.fov*180/Math.PI).toFixed(1);

    // ===== ALIGN =====
    let yd = norm(currentYaw - tYaw);
    let pd = currentPitch - tPitch;

    if (Math.abs(tPitch) > 70) yd = 0;

    const aligned = Math.abs(yd)<6 && Math.abs(pd)<6;

    document.getElementById("debugBox").style.border =
      aligned ? "2px solid lime" : "2px solid red";

    // ===== HOLD =====
    if (aligned) {

      if (!holding) {
        holding = true;
        holdStart = Date.now();
      }

      let p = (Date.now()-holdStart)/700;

      if (p>=1) {

        guidePoints.forEach(g=>{
          if(g.ri===ringIndex && g.yi===targetIndex){
            g.done=true;
          }
        });

        targetIndex++;

        if(targetIndex>=rings[ringIndex].yaws.length){
          ringIndex++;
          targetIndex=0;
        }

        holding=false;
      }

    } else {
      holding=false;
    }

    // ===== UPDATE POINTS =====
    guidePoints.forEach(g=>{
      if(g.done){
        g.mesh.material.emissiveColor = new BABYLON.Color3(0,1,0);
      } else if(g.ri===ringIndex && g.yi===targetIndex){
        g.mesh.material.emissiveColor = new BABYLON.Color3(1,0.5,0);
      } else {
        g.mesh.material.emissiveColor = new BABYLON.Color3(1,1,1);
      }
    });

  });

});