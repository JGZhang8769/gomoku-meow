import { Component, ElementRef, Input, OnInit, Output, EventEmitter, ViewChild, AfterViewInit, OnDestroy, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import * as THREE from 'three';
import { PieceType } from '../../services/game-engine.service';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

@Component({
  selector: 'app-game-board',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './game-board.component.html',
  styleUrls: ['./game-board.component.scss']
})
export class GameBoardComponent implements AfterViewInit, OnDestroy, OnChanges {
  @ViewChild('canvasContainer', { static: true }) canvasContainer!: ElementRef<HTMLDivElement>;

  @Input() boardState: PieceType[][][] = [];
  @Input() interactable: boolean = false;
  @Input() cameraRotationOffset: number = 0; // For Cat Parkour
  @Input() playerColor: 'black' | 'white' | null = null;
  @Input() previewPosition: { x: number, y: number, z: number, color: 'black' | 'white' } | null = null;
  @Input() eventAnimationData: any = null;
  @Output() onCellClick = new EventEmitter<{x: number, z: number}>();

  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private renderer!: THREE.WebGLRenderer;
  private controls!: OrbitControls;
  private raycaster = new THREE.Raycaster();
  private mouse = new THREE.Vector2();
  private animationId: number = 0;

  private pieceMeshes: THREE.Mesh[] = [];
  private gridGroup = new THREE.Group();

  private readonly CELL_SIZE = 1;
  private readonly BOARD_SIZE = 11;

  // Colors
  private baseColor = 0xF4E3D7; // Milk tea
  private gridColor = 0xD4B39A;
  private blackCatColor = 0x333333;
  private whiteCatColor = 0xFFFFFF;
  private boxColor = 0xD2A679; // Cardboard color

  ngAfterViewInit() {
    this.initThreeJs();
    this.createBoardBase();
    this.updatePieces();
    this.animate();
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['boardState'] && !changes['boardState'].firstChange) {
      this.updatePieces();
    }
    if (changes['previewPosition']) {
      this.updatePieces(); // Re-render pieces to include/exclude preview
    }
    if (changes['cameraRotationOffset'] && !changes['cameraRotationOffset'].firstChange) {
      this.applyCameraRotation();
    }
    if (changes['playerColor'] && changes['playerColor'].currentValue) {
      this.setInitialCameraAngle();
    }
    if (changes['eventAnimationData'] && changes['eventAnimationData'].currentValue) {
      this.playEventAnimation(changes['eventAnimationData'].currentValue);
    }
  }

  ngOnDestroy() {
    cancelAnimationFrame(this.animationId);
    if (this.renderer) {
      this.renderer.dispose();
    }
  }

  private initThreeJs() {
    const container = this.canvasContainer.nativeElement;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xFFF9F5); // Very light milk tea background

    this.camera = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight, 0.1, 1000);
    this.camera.position.set(0, 15, 18);
    this.camera.lookAt(0, 0, 0);

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.shadowMap.enabled = true;
    container.appendChild(this.renderer.domElement);

    // Controls
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;
    this.controls.maxPolarAngle = Math.PI / 2 - 0.1; // Don't go below board
    this.controls.enableRotate = false; // Disable manual rotation for fixed camera

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    this.scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight.position.set(10, 20, 10);
    dirLight.castShadow = true;
    this.scene.add(dirLight);

    // Event listener for clicks
    this.renderer.domElement.addEventListener('pointerdown', this.onPointerDown.bind(this));
    window.addEventListener('resize', this.onWindowResize.bind(this));
  }

  private createBoardBase() {
    const boardWidth = this.BOARD_SIZE * this.CELL_SIZE;

    // Base geometry
    const baseGeometry = new THREE.BoxGeometry(boardWidth, 0.5, boardWidth);
    const baseMaterial = new THREE.MeshStandardMaterial({ color: this.baseColor, roughness: 0.8 });
    const baseMesh = new THREE.Mesh(baseGeometry, baseMaterial);
    baseMesh.position.y = -0.25;
    baseMesh.receiveShadow = true;
    this.scene.add(baseMesh);

    // Grid lines (visible indicators)
    const offset = (this.BOARD_SIZE - 1) / 2;
    this.scene.add(this.gridGroup);

    // Create hitboxes for raycasting
    const hitboxGeo = new THREE.PlaneGeometry(this.CELL_SIZE, this.CELL_SIZE);
    const hitboxMat = new THREE.MeshBasicMaterial({ visible: false });

    for (let x = 0; x < this.BOARD_SIZE; x++) {
      for (let z = 0; z < this.BOARD_SIZE; z++) {
        const gridHelper = new THREE.GridHelper(1, 1, this.gridColor, this.gridColor);
        gridHelper.position.set(x - offset, 0.01, z - offset);
        this.gridGroup.add(gridHelper);

        const hitbox = new THREE.Mesh(hitboxGeo, hitboxMat);
        hitbox.rotation.x = -Math.PI / 2;
        hitbox.position.set(x - offset, 0.02, z - offset);
        hitbox.userData = { gridX: x, gridZ: z }; // Store grid coordinates
        this.gridGroup.add(hitbox);
      }
    }
  }

  private setInitialCameraAngle() {
    // Determine base position based on color
    if (this.playerColor === 'white') {
      this.camera.position.set(0, 15, -18);
    } else {
      this.camera.position.set(0, 15, 18);
    }
    this.camera.lookAt(0, 0, 0);
    this.controls.update();
  }

  private updatePieces() {
    // Remove old pieces
    for (const mesh of this.pieceMeshes) {
      this.scene.remove(mesh);
      mesh.geometry.dispose();
      (mesh.material as THREE.Material).dispose();
    }
    this.pieceMeshes = [];

    if (!this.boardState || this.boardState.length === 0) return;

    const offset = (this.BOARD_SIZE - 1) / 2;
    const catGeo = new THREE.SphereGeometry(this.CELL_SIZE * 0.4, 32, 32); // Simple sphere for cat
    const boxGeo = new THREE.BoxGeometry(this.CELL_SIZE * 0.8, this.CELL_SIZE * 0.8, this.CELL_SIZE * 0.8);

    const blackMat = new THREE.MeshStandardMaterial({ color: this.blackCatColor, roughness: 0.5 });
    const whiteMat = new THREE.MeshStandardMaterial({ color: this.whiteCatColor, roughness: 0.5 });
    const boxMat = new THREE.MeshStandardMaterial({ color: this.boxColor, roughness: 0.9 });

    const blackPreviewMat = new THREE.MeshStandardMaterial({ color: this.blackCatColor, roughness: 0.5, transparent: true, opacity: 0.5 });
    const whitePreviewMat = new THREE.MeshStandardMaterial({ color: this.whiteCatColor, roughness: 0.5, transparent: true, opacity: 0.5 });

    for (let x = 0; x < this.BOARD_SIZE; x++) {
      for (let z = 0; z < this.BOARD_SIZE; z++) {
        for (let y = 0; y < 9; y++) {
          const type = this.boardState[x][z][y];
          if (type) {
            let mesh: THREE.Mesh;
            if (type === 'box') {
              mesh = new THREE.Mesh(boxGeo, boxMat);
            } else {
              mesh = new THREE.Mesh(catGeo, type === 'black' ? blackMat : whiteMat);
              // Adding simple ears to the sphere to make it look slightly like a cat
              const earGeo = new THREE.ConeGeometry(0.15, 0.3, 8);
              const earMesh1 = new THREE.Mesh(earGeo, type === 'black' ? blackMat : whiteMat);
              earMesh1.position.set(-0.2, 0.3, 0);
              earMesh1.rotation.z = Math.PI / 6;
              const earMesh2 = new THREE.Mesh(earGeo, type === 'black' ? blackMat : whiteMat);
              earMesh2.position.set(0.2, 0.3, 0);
              earMesh2.rotation.z = -Math.PI / 6;
              mesh.add(earMesh1);
              mesh.add(earMesh2);
            }

            mesh.position.set(x - offset, y * this.CELL_SIZE + (this.CELL_SIZE/2), z - offset);
            mesh.castShadow = true;
            mesh.receiveShadow = true;
            this.scene.add(mesh);
            this.pieceMeshes.push(mesh);
          }
        }
      }
    }

    if (this.previewPosition) {
      const p = this.previewPosition;
      const mesh = new THREE.Mesh(catGeo, p.color === 'black' ? blackPreviewMat : whitePreviewMat);
      const earGeo = new THREE.ConeGeometry(0.15, 0.3, 8);
      const earMesh1 = new THREE.Mesh(earGeo, p.color === 'black' ? blackPreviewMat : whitePreviewMat);
      earMesh1.position.set(-0.2, 0.3, 0);
      earMesh1.rotation.z = Math.PI / 6;
      const earMesh2 = new THREE.Mesh(earGeo, p.color === 'black' ? blackPreviewMat : whitePreviewMat);
      earMesh2.position.set(0.2, 0.3, 0);
      earMesh2.rotation.z = -Math.PI / 6;
      mesh.add(earMesh1);
      mesh.add(earMesh2);

      mesh.position.set(p.x - offset, p.y * this.CELL_SIZE + (this.CELL_SIZE/2), p.z - offset);
      this.scene.add(mesh);
      this.pieceMeshes.push(mesh);
    }
  }

  private applyCameraRotation() {
    // We handle rotation smoothly in playEventAnimation now, but keep this for absolute state sync if needed.
  }

  private playEventAnimation(event: any) {
    if (!event) return;

    if (event.type === 'parkour') {
      const rad = THREE.MathUtils.degToRad(event.data.angle);
      const radius = Math.sqrt(this.camera.position.x ** 2 + this.camera.position.z ** 2);
      const targetAngle = Math.atan2(this.camera.position.z, this.camera.position.x) + rad;

      // Smoothly animate camera rotation
      let frame = 0;
      const totalFrames = 60; // 1 second at 60fps
      const startAngle = Math.atan2(this.camera.position.z, this.camera.position.x);

      const animateCamera = () => {
        frame++;
        const progress = frame / totalFrames;
        // Ease in out
        const ease = progress < .5 ? 2 * progress * progress : -1 + (4 - 2 * progress) * progress;
        const currentAngle = startAngle + (targetAngle - startAngle) * ease;

        this.camera.position.x = radius * Math.cos(currentAngle);
        this.camera.position.z = radius * Math.sin(currentAngle);
        this.camera.lookAt(0, 0, 0);
        this.controls.update();

        if (frame < totalFrames) {
          requestAnimationFrame(animateCamera);
        }
      };
      animateCamera();
    } else if (event.type === 'swipe') {
      // Create a big temporary cat paw mesh that swipes across
      const pawGeo = new THREE.CylinderGeometry(1.5, 1.5, 8, 32);
      const pawMat = new THREE.MeshStandardMaterial({ color: 0x888888 });
      const paw = new THREE.Mesh(pawGeo, pawMat);
      paw.rotation.z = Math.PI / 2;
      paw.position.set(-15, 3, 0);
      this.scene.add(paw);

      let frame = 0;
      const totalFrames = 45;
      const animatePaw = () => {
        frame++;
        paw.position.x += 30 / totalFrames; // Sweep across board
        if (frame < totalFrames) {
          requestAnimationFrame(animatePaw);
        } else {
          this.scene.remove(paw);
          paw.geometry.dispose();
          pawMat.dispose();
        }
      };
      animatePaw();
    } else if (event.type === 'box') {
      // Just a little bounce effect handled by normal updatePieces dropping in,
      // but we could add a particle or scale effect here.
    }
  }

  private onPointerDown(event: PointerEvent) {
    if (!this.interactable) return;

    const rect = this.renderer.domElement.getBoundingClientRect();
    this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    this.raycaster.setFromCamera(this.mouse, this.camera);

    // Check intersection with grid hitboxes
    const intersects = this.raycaster.intersectObjects(this.gridGroup.children);

    if (intersects.length > 0) {
      // Find the first hitbox with userData
      const hit = intersects.find(i => i.object.userData && i.object.userData['gridX'] !== undefined);
      if (hit) {
        const x = hit.object.userData['gridX'];
        const z = hit.object.userData['gridZ'];
        this.onCellClick.emit({x, z});
      }
    }
  }

  private onWindowResize() {
    if (!this.canvasContainer) return;
    const container = this.canvasContainer.nativeElement;
    this.camera.aspect = container.clientWidth / container.clientHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(container.clientWidth, container.clientHeight);
  }

  private animate() {
    this.animationId = requestAnimationFrame(this.animate.bind(this));
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }
}
