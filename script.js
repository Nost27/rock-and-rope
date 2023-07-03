import * as THREE from "three";
import { ConvexGeometry } from "ConvexGeometry";

//------------------------------初期設定
// サイズを指定
const canvas = document.getElementById("gameCanvas");
const width = Math.floor(window.innerWidth * 0.8);
const height = Math.floor(window.innerHeight * 0.8);

// レンダラーを作成
const renderer = new THREE.WebGLRenderer({
  canvas: canvas,
  antialias: true,
});
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(width, height);
renderer.setClearColor("#B0E0E6"); // Set clear color to white
renderer.shadowMap.enabled = true;

canvas.addEventListener("click", async () => {
  await canvas.requestPointerLock();
});

// シーンを作成
const scene = new THREE.Scene();

// カメラを作成
const camera = new THREE.PerspectiveCamera(90, width / height, 1, 10000);

//------------------------------コンフィグ
let moveSpeed = 3;

const controlls = {
  front: "i",
  back: "k",
  left: "j",
  right: "l",
  jump: " ",
  run: "/",
};
const mouseButtons = ["leftMouse", "middleMouse", "rightMouse"];
//------------------------------オブジェクト管理
let lockedOnCanvas = false;
let isHolding = true;
let isJumping = false;
let isThrown = false;

let keyTable = {};
Object.keys(controlls).forEach(function (key) {
  keyTable[controlls[key]] = 0;
});
Object.keys(mouseButtons).forEach(function (key) {
  keyTable[mouseButtons[key]] = 0;
});
const v = (x, y, z) => new THREE.Vector3(x, y, z);

let cam = {
  rbuf: 0,
  p: v(100, 50, 0),
  t: v(0, 0, 0),
  v: v(0, 0, 0),
  r: v(0, 0, 0),
};

let rock_ph = {
  range: 5,
  p: v(0, 50, 0),
  v: v(0, 0, 0),
  r: v(0, 0, 0),
  vr: v(0, 0, 0),
};

//------------------------------インプットイベント
{
  window.addEventListener("resize", function () {
    const width = Math.floor(window.innerWidth * 0.8);
    const height = Math.floor(window.innerHeight * 0.8);

    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(width, height);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  });
  document.addEventListener("keydown", function (e) {
    Object.keys(keyTable).forEach(function (key) {
      if (e.key === key) {
        keyTable[key] = 1;
        return;
      }
    });
  });
  document.addEventListener("keyup", function (e) {
    Object.keys(keyTable).forEach(function (key) {
      if (e.key === key) {
        keyTable[key] = 0;
        return;
      }
    });
  });
  document.addEventListener("mousedown", function (e) {
    keyTable[mouseButtons[e.button]] = 1;
  });
  document.addEventListener("mouseup", function (e) {
    keyTable[mouseButtons[e.button]] = 0;
  });
  document.addEventListener("pointerlockchange", function (e) {
    lockedOnCanvas = document.pointerLockElement === canvas;
    if (lockedOnCanvas) {
      const width = Math.floor(window.innerWidth);
      const height = Math.floor(window.innerHeight);
    } else {
      const width = Math.floor(window.innerWidth * 0.8);
      const height = Math.floor(window.innerHeight * 0.8);
    }
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(width, height);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  });
  document.addEventListener("mousemove", function (e) {
    if (lockedOnCanvas) {
      cam.r.x -= e.movementX * 0.001;
      cam.r.y -= e.movementY * 0.001;
      if (cam.r.y < -Math.PI / 2) {
        cam.r.y = -Math.PI / 2;
      }
      if (cam.r.y > Math.PI / 2) {
        cam.r.y = Math.PI / 2;
      }
    }
  });
}
//------------------------------

window.addEventListener("load", function () {
  camera.position.set(cam.p.x, cam.p.y, cam.p.z);

  // 光源を作成
  {
    const spotLight = new THREE.SpotLight(0xffffff, 4, 2000, Math.PI / 3, 0.2, 1);
    spotLight.position.set(0, 1500, 0);
    spotLight.castShadow = true; // 影を落とす設定
    spotLight.shadow.mapSize.width = 2048;
    spotLight.shadow.mapSize.height = 2048;
    // spotLight.shadow.bias = 0.001;  // You may need to tweak this value
    scene.add(spotLight);

    const targetObject = new THREE.Object3D();
    scene.add(targetObject);
    spotLight.add(targetObject);
    targetObject.position.set(0, -1, 0);
    spotLight.target = targetObject;

    // const spotLightHelper = new THREE.SpotLightHelper(spotLight, 10);
    // scene.add(spotLightHelper);

    // HemiLight
    const hemiLight = new THREE.HemisphereLight(0xaaaaaa, 0x000000, 0.6);
    scene.add(hemiLight);
  }

  // 地面を作成
  {
    // 床のテクスチャー
    const texture = new THREE.TextureLoader().load("imgs/floor.jpg");
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping; // リピート可能に
    texture.repeat.set(100, 100); // 10x10マスに設定
    texture.magFilter = THREE.NearestFilter; // アンチエイリアスを外す

    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(10000, 10000),
      new THREE.MeshStandardMaterial({
        map: texture,
        roughness: 0.8,
        metalness: 0,
      })
      );
    floor.position.set(0, -1, 0);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true; // 影の設定
    scene.add(floor);
  }

  // ボックスのグループを作成
  let boxGroup = new THREE.Group();
  let targetGroup = new THREE.Group();

  let size = v(5, 1, 5);
  size.multiplyScalar(20);
  let boxG = new THREE.BoxGeometry(size.x, size.y, size.z);
  let boxM = new THREE.MeshStandardMaterial({ color: "gray" });
  for (let i = 0; i < 10; i++) {
    const boxCopy = new THREE.Mesh(boxG, boxM);
    boxCopy.castShadow = true; // 影の設定
    boxCopy.receiveShadow = true; // 影の設定
    boxCopy.position.set(-10 - 100 * i, 10 + 20 * i, 0);
    boxCopy.boundingBox = new THREE.Box3().setFromObject(boxCopy);
    boxGroup.add(boxCopy);
  }
  scene.add(boxGroup);

  {
    const geometry = new THREE.BoxGeometry(20, 200, 200);
    const material = new THREE.MeshStandardMaterial({ color: 0xff3333 });
    const cube = new THREE.Mesh(geometry, material);
    cube.position.set(200, 100, 0);
    cube.castShadow = true; // 影の設定
    cube.receiveShadow = true; // 影の設定
    cube.boundingBox = new THREE.Box3().setFromObject(cube);
    cube.boundingBox.max.add(v(6, 6, 6));
    cube.boundingBox.min.add(v(-6, -6, -6));
    targetGroup.add(cube);
    boxGroup.add(targetGroup);
  }
  {
    const geometry = new THREE.BoxGeometry(20, 20, 20);
    const material = new THREE.MeshStandardMaterial({ color: 0xff3333 });
    const cube = new THREE.Mesh(geometry, material);
    cube.position.set(400, 10, 400);
    cube.castShadow = true; // 影の設定
    cube.receiveShadow = true; // 影の設定
    cube.boundingBox = new THREE.Box3().setFromObject(cube);
    cube.boundingBox.max.add(v(6, 6, 6));
    cube.boundingBox.min.add(v(-6, -6, -6));
    targetGroup.add(cube);
    boxGroup.add(targetGroup);
  }

  // ジオメトリを作成
  const vertices = [];
  {
    // 球の半径と頂点の数を設定
    const radius = rock_ph.range / 10;
    const vertexCount = 50;

    // ランダムな頂点を生成し、それらを球面上にプロジェクト
    for (let i = 0; i < vertexCount; i++) {
      const theta = 2 * Math.PI * Math.random();
      const phi = Math.acos(2 * Math.random() - 1);

      const x = radius * Math.sin(phi) * Math.cos(theta) * 10;
      const y = radius * Math.sin(phi) * Math.sin(theta) * 10;
      const z = radius * Math.cos(phi) * 10;

      vertices.push(v(x, y, z));
    }
  }
  const rockG = new ConvexGeometry(vertices);
  const roundG = new THREE.SphereGeometry(rock_ph.range, 16, 16);

  // マテリアルを作成
  const rockM = new THREE.MeshPhongMaterial({ color: "SlateGray", specular: 0xbbbbbb, shininess: 5 });
  const rock = new THREE.Mesh(rockG, rockM);

  rock.receiveShadow = true;
  rock.castShadow = true;
  scene.add(rock);

  tick();
  // 毎フレーム時に実行されるループイベント
  function tick() {
    // コントロール
    {
      if (keyTable["leftMouse"]) {
        isHolding = true;
      } else {
        isHolding = false;
      }
      if (keyTable[controlls.run]) {
        moveSpeed = 10;
      } else {
        moveSpeed = 3;
      }
      if (keyTable[controlls.right] - keyTable[controlls.left]) {
        cam.t.x = (keyTable[controlls.right] - keyTable[controlls.left]) * moveSpeed;
      }
      if (keyTable[controlls.back] - keyTable[controlls.front]) {
        cam.t.z = (keyTable[controlls.back] - keyTable[controlls.front]) * moveSpeed;
      }
    }

    // マスタ
    {
      {
        cam.t.multiplyScalar(0.9);

        if (cam.v.y < 0) {
          isJumping = true;
        }

        cam.v.y -= 0.5;
        if (camera.position.y <= 50) {
          cam.v.y = 0;
          cam.p.y = 50;
          isJumping = false;
        }
        if (!isJumping) {
          cam.v.x = cam.t.x * Math.cos(cam.r.x) + cam.t.z * Math.sin(cam.r.x);
          cam.v.z = cam.t.x * -Math.sin(cam.r.x) + cam.t.z * Math.cos(cam.r.x);
        } else if (controlls.front) {
          cam.v.x = cam.v.x * 0.9 + (cam.t.x * Math.cos(cam.r.x) + cam.t.z * Math.sin(cam.r.x)) * 0.1;
          cam.v.z = cam.v.z * 0.9 + (cam.t.x * -Math.sin(cam.r.x) + cam.t.z * Math.cos(cam.r.x)) * 0.1;
        }

        if (!isJumping && keyTable[controlls.jump] == 1) {
          isJumping = true;
          cam.p.y += 0.1;
          cam.v.y = 10;
        }

        // 位置更新

        // [cam].forEach(function (obj) {
        //   [v(1, 0, 0), v(-1, 0, 0), v(0, 1, 0), v(0, -1, 0), v(0, 0, 1), v(0, 0, -1)].forEach(function (ver) {
        //     let raycaster = new THREE.Raycaster(obj.p, ver);
        //     let intersects = raycaster.intersectObject(boxGroup, true);
        //     if (intersects.length > 0 && intersects[0].distance < 50) {
        //       obj.p.copy(intersects[0].point.clone().add(ver.clone().multiplyScalar(50 * -1)));
        //       obj.v.add(obj.v.multiply(ver.clone().multiplyScalar(-1)));
        //     }
        //   });
        // });
        // const raycaster = new THREE.Raycaster(cam.p, v(0, -1, 0));
        {
          targetGroup.children.forEach((target) => {
            const closestPoint = target.boundingBox.clampPoint(rock_ph.p, v(0, 0, 0));
            if (closestPoint.distanceToSquared(rock_ph.p) < 0.001) {
              target.material.color.setHex(0x66ff66);
            }
          });
        }
        {
          const raycaster = new THREE.Raycaster(cam.p, v(0, -1, 0));
          const intersects = raycaster.intersectObject(boxGroup, true);
          if (intersects.length > 0 && intersects[0].distance < 50) {
            isJumping = false;
            cam.p.y = intersects[0].point.y + 50;
            cam.v.y = 0;
          }
        }
        {
          const raycaster = new THREE.Raycaster(cam.p, v(0, 1, 0));
          const intersects = raycaster.intersectObject(boxGroup, true);
          if (intersects.length > 0 && intersects[0].distance < 10) {
            cam.p.y = intersects[0].point.y - 10;
            cam.v.y = 0;
          }
        }
        {
          const sideBound = 15;
          [v(1, 0, 0), v(-1, 0, 0)].forEach(function (ver) {
            {
              cam.p.add(v(0, -20, 0));
              const raycaster = new THREE.Raycaster(cam.p, ver);
              const intersects = raycaster.intersectObject(boxGroup, true);
              if (intersects.length > 0 && intersects[0].distance < sideBound) {
                cam.p.x = intersects[0].point.x - ver.x * sideBound;
                cam.v.x = 0;
              }
            }
            {
              cam.p.add(v(0, 20, 0));
              const raycaster = new THREE.Raycaster(cam.p, ver);
              const intersects = raycaster.intersectObject(boxGroup, true);
              if (intersects.length > 0 && intersects[0].distance < sideBound) {
                cam.p.x = intersects[0].point.x - ver.x * sideBound;
                cam.v.x = 0;
              }
            }
          });
          [v(0, 0, 1), v(0, 0, -1)].forEach(function (ver) {
            {
              cam.p.add(v(0, -20, 0));
              const raycaster = new THREE.Raycaster(cam.p, ver);
              const intersects = raycaster.intersectObject(boxGroup, true);
              if (intersects.length > 0 && intersects[0].distance < sideBound) {
                cam.p.z = intersects[0].point.z - ver.z * sideBound;
                cam.v.z = 0;
              }
            }
            {
              cam.p.add(v(0, 20, 0));
              const raycaster = new THREE.Raycaster(cam.p, ver);
              const intersects = raycaster.intersectObject(boxGroup, true);
              if (intersects.length > 0 && intersects[0].distance < sideBound) {
                cam.p.z = intersects[0].point.z - ver.z * sideBound;
                cam.v.z = 0;
              }
            }
          });
        }
        cam.p.add(cam.v);

        camera.position.copy(cam.p);
        camera.rotation.setFromVector3(v(cam.r.y, cam.r.x, 0), "YXZ");
      }
      {
        if (isHolding) {
          isThrown = false;
          const position = v().copy(camera.position);
          const vector = v();
          camera.getWorldDirection(vector);

          rock_ph.p.copy(position.clone().add(vector.clone().multiplyScalar(50)));
          rock_ph.v.copy(vector.clone().multiplyScalar(5)).add(cam.v);
          rock_ph.r.copy(v().subVectors(rock_ph.p, cam.p).normalize());
          rock_ph.vr.set(0, 0, 0);
          if (rock_ph.p.y < rock_ph.range) {
            rock_ph.p.y = rock_ph.range;
          }
        } else {
          if (!isThrown) {
            const rtheta = Math.random() * Math.PI;
            const rphi = Math.random() * Math.PI;
            const strength = Math.random();

            rock_ph.vr.set(strength * Math.sin(rtheta) * Math.cos(rphi), strength * Math.sin(rtheta) * Math.sin(rphi), strength * Math.cos(rtheta));
            isThrown=true;
          }
          rock_ph.v.y += -0.098;

          if (rock_ph.p.y < rock_ph.range) {
            rock_ph.p.y = rock_ph.range;
            rock_ph.v.multiply(v(0.4, -0.5, 0.4));

            if (rock_ph.v.distanceTo(v(0, 0, 0)) > 0.5) {
              const rtheta = Math.random() * Math.PI;
              const rphi = Math.random() * Math.PI;
              const strength = Math.random();

              rock_ph.vr.set(strength * Math.sin(rtheta) * Math.cos(rphi), strength * Math.sin(rtheta) * Math.sin(rphi), strength * Math.cos(rtheta));
            } else {
              rock_ph.v.set(0, 0, 0);
              rock_ph.vr.multiplyScalar(0.7);
            }
          }
        }
      }

      [rock_ph].forEach(function (obj) {
        [v(1, 0, 0), v(-1, 0, 0), v(0, 1, 0), v(0, -1, 0), v(0, 0, 1), v(0, 0, -1)].forEach(function (ver) {
          let raycaster = new THREE.Raycaster(obj.p, ver);
          let intersects = raycaster.intersectObject(boxGroup, true);
          if (intersects.length > 0 && intersects[0].distance < obj.range * 1.2) {
            obj.p.copy(intersects[0].point.clone().add(ver.multiplyScalar(obj.range * -1.2)));
            obj.v.reflect(ver.normalize());
            if (obj.v.distanceTo(v(0, 0, 0)) < 0.5) {
              obj.v.set(0, 0, 0);
              obj.vr.multiplyScalar(0.6);
            } else {
              obj.v.multiply(v(0.4, 0.5, 0.4));
            }
          }
        });
      });

      rock_ph.p.add(rock_ph.v);
      rock_ph.r.add(rock_ph.vr);
      rock.position.copy(rock_ph.p);
      rock.rotation.setFromVector3(rock_ph.r);
    }

    // レンダリング
    renderer.render(scene, camera);
    requestAnimationFrame(tick);
  }
});
