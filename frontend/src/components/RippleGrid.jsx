import { useRef, useEffect } from 'react';
import { Renderer, Program, Triangle, Mesh } from 'ogl';
import { useDJ } from '../context/DJContext';
import './RippleGrid.css';

const RippleGrid = ({
  enableRainbow = false,
  gridColor = '#ffffff',
  rippleIntensity = 0.05,
  gridSize = 10.0,
  gridThickness = 15.0,
  fadeDistance = 1.5,
  glowIntensity = 0.1,
  opacity = 1.0,
  gridRotation = 0,
  mouseInteraction = true,
  mouseInteractionRadius = 1
}) => {
  const { isGenerating, isStudioLoading, isSpeaking } = useDJ();
  const containerRef = useRef(null);
  const mousePositionRef = useRef({ x: 0.5, y: 0.5 });
  const targetMouseRef = useRef({ x: 0.5, y: 0.5 });
  const mouseInfluenceRef = useRef(0);
  const uniformsRef = useRef(null);
  const isGeneratingRef = useRef(isGenerating);

  useEffect(() => {
    if (!containerRef.current) return;
    
    // Throttle WebGL during ANY LLM activity across all tabs
    isGeneratingRef.current = isGenerating || isStudioLoading || isSpeaking;
  }, [isGenerating, isStudioLoading, isSpeaking]);

  useEffect(() => {
    if (!containerRef.current) return;

    const hexToRgb = hex => {
      const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
      return result
        ? [parseInt(result[1], 16) / 255, parseInt(result[2], 16) / 255, parseInt(result[3], 16) / 255]
        : [1, 1, 1];
    };

    const renderer = new Renderer({
      dpr: Math.min(window.devicePixelRatio, 2),
      alpha: true
    });
    const gl = renderer.gl;
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.canvas.style.width = '100%';
    gl.canvas.style.height = '100%';
    containerRef.current.appendChild(gl.canvas);

    const vert = `
attribute vec2 position;
varying vec2 vUv;
void main() {
    vUv = position * 0.5 + 0.5;
    gl_Position = vec4(position, 0.0, 1.0);
}`;

    const frag = `precision highp float;
uniform float iTime;
uniform vec2 iResolution;
uniform bool enableRainbow;
uniform vec3 gridColor;
uniform float rippleIntensity;
uniform float gridSize;
uniform float gridThickness;
uniform float fadeDistance;
uniform float glowIntensity;
uniform float opacity;
uniform float gridRotation;
uniform bool mouseInteraction;
uniform vec2 mousePosition;
uniform float mouseInfluence;
uniform float mouseInteractionRadius;
uniform float audioPulse;
uniform float audioEnergy;
uniform float dropFlash;
uniform vec3 edgeWaveData;
varying vec2 vUv;

float pi = 3.141592;

mat2 rotate(float angle) {
    float s = sin(angle);
    float c = cos(angle);
    return mat2(c, -s, s, c);
}

void main() {
    vec2 uv = vUv * 2.0 - 1.0;
    uv.x *= iResolution.x / iResolution.y;

    if (gridRotation != 0.0) {
        uv = rotate(gridRotation * pi / 180.0) * uv;
    }

    float dist = length(uv);
    float func = sin(pi * (iTime - dist));
    float pulseBoost = audioPulse * 0.02 + audioEnergy * 0.012 + dropFlash * 0.06;
    vec2 rippleUv = uv + uv * func * (rippleIntensity + pulseBoost);

    if (mouseInteraction && mouseInfluence > 0.0) {
        vec2 mouseUv = (mousePosition * 2.0 - 1.0);
        mouseUv.x *= iResolution.x / iResolution.y;
        float mouseDist = length(uv - mouseUv);
        
        float influence = mouseInfluence * exp(-mouseDist * mouseDist / (mouseInteractionRadius * mouseInteractionRadius));
        
        float mouseWave = sin(pi * (iTime * 2.0 - mouseDist * 3.0)) * influence;
        rippleUv += normalize(uv - mouseUv) * mouseWave * rippleIntensity * 0.3;
    }

    float edgeWaveFlash = 0.0;
    if (edgeWaveData.z > 0.0) {
        vec2 edgeUv = (edgeWaveData.xy * 2.0 - 1.0);
        edgeUv.x *= iResolution.x / iResolution.y;
        float edgeDist = length(uv - edgeUv);
        float ringRadius = (1.0 - edgeWaveData.z) * 3.0; // Expands outward
        float ringDist = abs(edgeDist - ringRadius);
        edgeWaveFlash = exp(-ringDist * 8.0) * edgeWaveData.z;
        rippleUv += normalize(uv - edgeUv) * edgeWaveFlash * 0.15;
    }

    vec2 a = sin(gridSize * 0.5 * pi * rippleUv - pi / 2.0);
    vec2 b = abs(a);

    float aaWidth = 0.5;
    vec2 smoothB = vec2(
        smoothstep(0.0, aaWidth, b.x),
        smoothstep(0.0, aaWidth, b.y)
    );

    vec3 color = vec3(0.0);
    color += exp(-gridThickness * smoothB.x * (0.8 + 0.5 * sin(pi * iTime)));
    color += exp(-gridThickness * smoothB.y);
    color += 0.5 * exp(-(gridThickness / 4.0) * sin(smoothB.x));
    color += 0.5 * exp(-(gridThickness / 3.0) * smoothB.y);

    if (glowIntensity > 0.0) {
        color += glowIntensity * exp(-gridThickness * 0.5 * smoothB.x);
        color += glowIntensity * exp(-gridThickness * 0.5 * smoothB.y);
    }

    float ddd = 1.0;
    
    vec3 t;
    if (enableRainbow) {
        t = vec3(
            uv.x * 0.5 + 0.5 * sin(iTime),
            uv.y * 0.5 + 0.5 * cos(iTime),
            pow(cos(iTime), 4.0)
        ) + 0.5;
    } else {
        t = gridColor;
    }

    vec3 mixedColor = t;

    // Edge wave flash (existing ripple bursts)
    if (edgeWaveFlash > 0.0) {
        mixedColor = mix(t, vec3(1.0, 0.05, 0.6), clamp(edgeWaveFlash * 1.5, 0.0, 1.0));
        color += edgeWaveFlash * 1.5;
    }

    // Drop flash — festival stage lighting effect on the grid
    if (dropFlash > 0.0) {
        // Color shift toward hot magenta/white
        vec3 flashColor = mix(vec3(1.0, 0.1, 0.7), vec3(1.0, 1.0, 1.0), dropFlash * 0.4);
        mixedColor = mix(mixedColor, flashColor, dropFlash * 0.7);
        // Brightness boost
        color += dropFlash * 0.6 * flashColor;
        // Radial burst — bright ring expanding from center
        float burstRadius = (1.0 - dropFlash) * 4.0;
        float burstRing = exp(-abs(dist - burstRadius) * 6.0) * dropFlash;
        color += burstRing * 2.0 * flashColor;
    }
    
    // Audio energy adds subtle glow
    color += audioPulse * 0.15 * t;
    color += audioEnergy * 0.08 * t;

    float finalFade = ddd;
    float alpha = length(color) * finalFade * opacity;
    gl_FragColor = vec4(color * mixedColor * finalFade * opacity, alpha);
}`;

    const uniforms = {
      iTime: { value: 0 },
      iResolution: { value: [1, 1] },
      enableRainbow: { value: enableRainbow },
      gridColor: { value: hexToRgb(gridColor) },
      rippleIntensity: { value: rippleIntensity },
      gridSize: { value: gridSize },
      gridThickness: { value: gridThickness },
      fadeDistance: { value: fadeDistance },
      glowIntensity: { value: glowIntensity },
      opacity: { value: opacity },
      gridRotation: { value: gridRotation },
      mouseInteraction: { value: mouseInteraction },
      mousePosition: { value: [0.5, 0.5] },
      mouseInfluence: { value: 0 },
      mouseInteractionRadius: { value: mouseInteractionRadius },
      audioPulse: { value: 0 },
      audioEnergy: { value: 0 },
      dropFlash: { value: 0 },
      edgeWaveData: { value: [0, 0, 0] }
    };

    uniformsRef.current = uniforms;

    const geometry = new Triangle(gl);
    const program = new Program(gl, { vertex: vert, fragment: frag, uniforms });
    const mesh = new Mesh(gl, { geometry, program });

    let animationFrameId;

    const resize = () => {
      const { clientWidth: w, clientHeight: h } = containerRef.current;
      renderer.setSize(w, h);
      uniforms.iResolution.value = [w, h];
    };

    const handleMouseMove = e => {
      if (!mouseInteraction || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width;
      const y = 1.0 - (e.clientY - rect.top) / rect.height; // Flip Y coordinate
      targetMouseRef.current = { x, y };
    };

    const handleMouseEnter = () => {
      if (!mouseInteraction) return;
      mouseInfluenceRef.current = 1.0;
    };

    const handleMouseLeave = () => {
      if (!mouseInteraction) return;
      mouseInfluenceRef.current = 0.0;
    };

    window.addEventListener('resize', resize);
    if (mouseInteraction) {
      containerRef.current.addEventListener('mousemove', handleMouseMove);
      containerRef.current.addEventListener('mouseenter', handleMouseEnter);
      containerRef.current.addEventListener('mouseleave', handleMouseLeave);
    }
    resize();

    let currentAudioPulse = 0;
    let currentAudioEnergy = 0;
    let currentDropFlash = 0;
    let edgeWaveState = { x: 0, y: 0, active: 0 };
    let frameCount = 0;

    const handleBeat = (e) => {
      currentAudioPulse = e.detail.pulse || 0;
      // Only trigger BPM edge waves if no drop flash is active — drops take priority
      if (currentDropFlash <= 0 && currentAudioPulse > 0.85 && Math.random() > 0.8 && edgeWaveState.active <= 0.0) {
         const edge = Math.floor(Math.random() * 4);
         edgeWaveState.x = edge === 0 ? Math.random() : edge === 1 ? Math.random() : edge === 2 ? 0 : 1;
         edgeWaveState.y = edge === 0 ? 0 : edge === 1 ? 1 : edge === 2 ? Math.random() : Math.random();
         edgeWaveState.active = 1.0;
      }
    };

    const handleEnergy = (e) => {
      currentAudioEnergy = e.detail.energy || 0;
    };

    const handleDrop = (e) => {
      const intensity = e.detail?.intensity || 1;
      currentDropFlash = Math.min(intensity, 1.5);
      // Trigger ONE edge wave on drop for extra drama
      const edge = Math.floor(Math.random() * 4);
      edgeWaveState.x = edge === 0 ? Math.random() : edge === 1 ? Math.random() : edge === 2 ? 0 : 1;
      edgeWaveState.y = edge === 0 ? 0 : edge === 1 ? 1 : edge === 2 ? Math.random() : Math.random();
      edgeWaveState.active = 1.0;
    };

    window.addEventListener('riddim-beat', handleBeat);
    window.addEventListener('riddim-energy', handleEnergy);
    window.addEventListener('riddim-drop', handleDrop);

    const render = t => {
      uniforms.iTime.value = t * 0.001;

      const lerpFactor = 0.1;
      mousePositionRef.current.x += (targetMouseRef.current.x - mousePositionRef.current.x) * lerpFactor;
      mousePositionRef.current.y += (targetMouseRef.current.y - mousePositionRef.current.y) * lerpFactor;

      const currentInfluence = uniforms.mouseInfluence.value;
      const targetInfluence = mouseInfluenceRef.current;
      uniforms.mouseInfluence.value += (targetInfluence - currentInfluence) * 0.05;

      uniforms.mousePosition.value = [mousePositionRef.current.x, mousePositionRef.current.y];
      
      uniforms.audioPulse.value = currentAudioPulse;
      uniforms.audioEnergy.value += (currentAudioEnergy - uniforms.audioEnergy.value) * 0.15;
      
      // Drop flash decay
      if (currentDropFlash > 0) {
        currentDropFlash -= 0.018; // ~1 second for full decay
        if (currentDropFlash < 0) currentDropFlash = 0;
      }
      uniforms.dropFlash.value = currentDropFlash;

      if (edgeWaveState.active > 0) {
         edgeWaveState.active -= 0.012;
      }
      uniforms.edgeWaveData.value = [edgeWaveState.x, edgeWaveState.y, Math.max(0, edgeWaveState.active)];

      // Skip heavy WebGL render if AI is actively generating text to save CPU
      frameCount++;
      if (isGeneratingRef.current) {
        // Throttle to ~15fps during generation to free CPU for LLM
        if (frameCount % 4 !== 0) {
          animationFrameId = requestAnimationFrame(render);
          return;
        }
      }
      renderer.render({ scene: mesh });
      
      animationFrameId = requestAnimationFrame(render);
    };

    animationFrameId = requestAnimationFrame(render);

    const container = containerRef.current;
    return () => {
      window.removeEventListener('resize', resize);
      window.removeEventListener('riddim-beat', handleBeat);
      window.removeEventListener('riddim-energy', handleEnergy);
      window.removeEventListener('riddim-drop', handleDrop);
      if (mouseInteraction && container) {
        container.removeEventListener('mousemove', handleMouseMove);
        container.removeEventListener('mouseenter', handleMouseEnter);
        container.removeEventListener('mouseleave', handleMouseLeave);
      }
      cancelAnimationFrame(animationFrameId);
      renderer.gl.getExtension('WEBGL_lose_context')?.loseContext();
      if (container && gl.canvas.parentNode === container) {
          container.removeChild(gl.canvas);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!uniformsRef.current) return;

    const hexToRgb = hex => {
      const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
      return result
        ? [parseInt(result[1], 16) / 255, parseInt(result[2], 16) / 255, parseInt(result[3], 16) / 255]
        : [1, 1, 1];
    };

    uniformsRef.current.enableRainbow.value = enableRainbow;
    uniformsRef.current.gridColor.value = hexToRgb(gridColor);
    uniformsRef.current.rippleIntensity.value = rippleIntensity;
    uniformsRef.current.gridSize.value = gridSize;
    uniformsRef.current.gridThickness.value = gridThickness;
    uniformsRef.current.fadeDistance.value = fadeDistance;
    uniformsRef.current.glowIntensity.value = glowIntensity;
    uniformsRef.current.opacity.value = opacity;
    uniformsRef.current.gridRotation.value = gridRotation;
    uniformsRef.current.mouseInteraction.value = mouseInteraction;
    uniformsRef.current.mouseInteractionRadius.value = mouseInteractionRadius;
  }, [
    enableRainbow,
    gridColor,
    rippleIntensity,
    gridSize,
    gridThickness,
    fadeDistance,
    glowIntensity,
    opacity,
    gridRotation,
    mouseInteraction,
    mouseInteractionRadius
  ]);

  return <div ref={containerRef} className="ripple-grid-container" />;
};

export default RippleGrid;
