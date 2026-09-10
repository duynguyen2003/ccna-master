import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
// Use the distributable UMD entry so CRA/Jest can load the plugin in both
// browser and CommonJS test environments.
import { MotionPathPlugin } from 'gsap/dist/MotionPathPlugin';

gsap.registerPlugin(useGSAP, MotionPathPlugin);

export const prefersReducedMotion = () => {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
};

export { gsap, useGSAP, MotionPathPlugin };
