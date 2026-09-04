import React, { useRef } from 'react';
import { gsap, useGSAP } from '../../../utils/adminMotion';

const AdminMotionSwap = ({ stateKey, children, className = '', style }) => {
  const containerRef = useRef(null);

  useGSAP(() => {
    if (!containerRef.current) return undefined;

    const media = gsap.matchMedia();

    media.add('(prefers-reduced-motion: no-preference)', () => {
      gsap.fromTo(containerRef.current, {
        autoAlpha: 0,
        y: 6
      }, {
        autoAlpha: 1,
        y: 0,
        duration: 0.28,
        ease: 'power2.out',
        clearProps: 'opacity,visibility,transform'
      });
    });

    return () => media.revert();
  }, {
    scope: containerRef,
    dependencies: [stateKey],
    revertOnUpdate: true
  });

  return (
    <div
      ref={containerRef}
      className={`admin-motion-swap ${className}`.trim()}
      style={style}
    >
      {children}
    </div>
  );
};

export default AdminMotionSwap;
