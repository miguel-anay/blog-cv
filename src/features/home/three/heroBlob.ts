import { Mesh, IcosahedronGeometry, ShaderMaterial, Color, NormalBlending } from "three";
import type { StageContext } from "./stage";
import { sceneWeights } from "./sceneWeights";

const VERTEX_SHADER = /* glsl */ `
  varying vec3 vNormal;
  varying vec3 vViewPos;

  void main() {
    vNormal = normalize(normalMatrix * normal);
    vViewPos = -(modelViewMatrix * vec4(position, 1.0)).xyz;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const FRAGMENT_SHADER = /* glsl */ `
  uniform float uFresnelPower;
  uniform float uProgress;
  uniform float uOpacity;
  uniform vec3 uColorA;
  uniform vec3 uColorB;

  varying vec3 vNormal;
  varying vec3 vViewPos;

  void main() {
    float f = pow(1.0 - clamp(dot(normalize(vNormal), normalize(vViewPos)), 0.0, 1.0), uFresnelPower);
    vec3 c = mix(uColorB, uColorA, f);
    gl_FragColor = vec4(c, f * uProgress * uOpacity);
  }
`;

let mesh: Mesh<IcosahedronGeometry, ShaderMaterial> | null = null;
let displayed = 0;
let time = 0;
let readPalette: (() => void) | null = null;

const readCssColor = (name: string): string =>
  getComputedStyle(document.documentElement).getPropertyValue(name).trim();

export const heroBlob = {
  init(ctx: StageContext): void {
    const geometry = new IcosahedronGeometry(1.4, 4);
    const material = new ShaderMaterial({
      vertexShader: VERTEX_SHADER,
      fragmentShader: FRAGMENT_SHADER,
      transparent: true,
      depthWrite: false,
      blending: NormalBlending,
      uniforms: {
        uTime: { value: 0 },
        uProgress: { value: 0 },
        uColorA: { value: new Color() },
        uColorB: { value: new Color() },
        uFresnelPower: { value: 3.0 },
        uOpacity: { value: 0.5 },
      },
    });

    mesh = new Mesh(geometry, material);
    ctx.scene.add(mesh);

    readPalette = () => {
      if (!mesh) return;
      // Plain-hex custom props only — --accent-soft is rgba() and Color.set() won't parse it.
      material.uniforms.uColorA.value.set(readCssColor("--accent"));
      material.uniforms.uColorB.value.set(readCssColor("--border-strong"));
    };
    readPalette();
    document.addEventListener("themechange", readPalette); // ThemeSwitcher.astro:37
    document.addEventListener("modechange", readPalette); // ModeToggle.astro:30

    displayed = 0;
    time = 0;
  },

  resize(aspect: number): void {
    if (!mesh) return;
    const wide = aspect > 1.2;
    mesh.position.x = wide ? 1.8 : 0;
    mesh.scale.setScalar(wide ? 1 : 0.6);
  },

  tick(dt: number): void {
    if (!mesh) return;
    const weight = sceneWeights.get("hero").weight;
    displayed += (weight - displayed) * Math.min(1, dt * 4);
    if (displayed > 0.001) time += dt; // only accumulate while actually rendering
    const uniforms = mesh.material.uniforms;
    uniforms.uProgress.value = displayed;
    uniforms.uTime.value = time;
  },

  destroy(): void {
    if (readPalette) {
      document.removeEventListener("themechange", readPalette);
      document.removeEventListener("modechange", readPalette);
      readPalette = null;
    }
    if (mesh) {
      mesh.removeFromParent();
      mesh.geometry.dispose();
      mesh.material.dispose();
      mesh = null;
    }
  },
};
