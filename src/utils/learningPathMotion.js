import { gsap, prefersReducedMotion } from './labMotion';

const CONFETTI_COLORS = ['#2563eb', '#38bdf8', '#10b981', '#f59e0b', '#ec4899'];

const createNodeConfetti = (nodeElement, particleCount = 84) => {
  if (!nodeElement || typeof document === 'undefined') return null;

  const rect = nodeElement.getBoundingClientRect();
  const centerX = rect.left + rect.width / 2;
  const centerY = rect.top + rect.height / 2;
  const layer = document.createElement('div');
  layer.className = 'lp-unlock-confetti-layer';
  layer.setAttribute('aria-hidden', 'true');
  layer.dataset.lpConfetti = 'true';

  const particles = Array.from({ length: particleCount }, (_, index) => {
    const particle = document.createElement('span');
    const size = 4 + (index % 6);
    particle.className = 'lp-unlock-confetti-particle';
    particle.style.left = `${centerX}px`;
    particle.style.top = `${centerY}px`;
    particle.style.width = `${size}px`;
    particle.style.height = `${Math.max(3, size - 2)}px`;
    particle.style.backgroundColor = CONFETTI_COLORS[index % CONFETTI_COLORS.length];
    particle.style.borderRadius = index % 3 === 0 ? '50%' : '2px';
    layer.appendChild(particle);
    return particle;
  });

  document.body.appendChild(layer);
  gsap.set(particles, { xPercent: -50, yPercent: -50, opacity: 0, scale: 0.7 });
  return { layer, particles };
};

/**
 * Animation utilities cho Learning Path Map sử dụng GSAP.
 *
 * NGUYÊN TẮC:
 * - GSAP KHÔNG sửa đổi dữ liệu nghiệp vụ, React giữ quyền sở hữu DOM.
 * - Tuân thủ prefers-reduced-motion (bỏ tween vô hạn, reveal dài).
 * - Dùng fromTo hoặc timeline có cleanup rõ ràng, tránh kẹt opacity 0 sau StrictMode.
 */

/**
 * Animation vẽ đường cong SVG khi map khởi tạo lần đầu
 */
export const animatePathReveal = (pathElements = [], reducedMotion = false) => {
  const isReduced = reducedMotion || prefersReducedMotion();
  const validPaths = Array.from(pathElements).filter(Boolean);

  if (!validPaths.length) return null;

  if (isReduced) {
    validPaths.forEach((path) => {
      path.style.strokeDashoffset = '0';
    });
    return null;
  }

  const tl = gsap.timeline();

  validPaths.forEach((path) => {
    try {
      const length = path.getTotalLength() || 400;
      path.style.strokeDasharray = `${length}`;
      path.style.strokeDashoffset = `${length}`;

      tl.to(
        path,
        {
          strokeDashoffset: 0,
          duration: 0.8,
          ease: 'power2.out',
        },
        '-=0.4'
      );
    } catch {
      path.style.strokeDashoffset = '0';
    }
  });

  return tl;
};

/**
 * Animation vòng sáng nhịp thở (pulse glow ring) cho current node
 */
export const animateCurrentPulse = (ringElement, reducedMotion = false) => {
  if (!ringElement) return null;
  const isReduced = reducedMotion || prefersReducedMotion();

  if (isReduced) {
    gsap.set(ringElement, { opacity: 0.3, scale: 1.1 });
    return null;
  }

  return gsap.fromTo(
    ringElement,
    { scale: 1, opacity: 0.8 },
    {
      scale: 1.35,
      opacity: 0,
      duration: 1.8,
      repeat: -1,
      ease: 'power1.out',
    }
  );
};

/**
 * Timeline mở khóa chặng tiếp theo khi một course vừa hoàn thành
 */
export const playUnlockSequence = ({
  completedNodeEl,
  connectingPathEl,
  nextNodeEl,
  onComplete,
  reducedMotion = false,
}) => {
  const isReduced = reducedMotion || prefersReducedMotion();

  if (isReduced) {
    if (completedNodeEl) gsap.set(completedNodeEl, { clearProps: 'all' });
    if (connectingPathEl) gsap.set(connectingPathEl, { strokeDashoffset: 0 });
    if (nextNodeEl) gsap.set(nextNodeEl, { clearProps: 'all' });
    if (typeof onComplete === 'function') onComplete();
    return null;
  }

  const confetti = createNodeConfetti(completedNodeEl);
  const cleanupConfetti = () => {
    if (!confetti) return;
    gsap.killTweensOf(confetti.particles);
    confetti.layer.remove();
  };

  const tl = gsap.timeline({
    onComplete: () => {
      cleanupConfetti();
      if (typeof onComplete === 'function') onComplete();
    },
  });

  tl.__lpCleanup = cleanupConfetti;

  // 1. Completed node phồng nhẹ, sau đó bắn hạt tại đúng tâm node.
  if (completedNodeEl) {
    tl.to(completedNodeEl, { scale: 1.22, duration: 0.35, ease: 'power2.out' }).addLabel(
      'confettiBurst'
    );

    if (confetti) {
      tl.set(confetti.particles, { opacity: 1, scale: 1 }, 'confettiBurst')
        .to(
          confetti.particles,
          {
            x: (index) => {
              const angle = (Math.PI * 2 * index) / confetti.particles.length;
              return Math.cos(angle) * (90 + (index % 7) * 14);
            },
            rotation: (index) => (index % 2 === 0 ? 1 : -1) * (240 + index * 20),
            opacity: 0,
            duration: 1.92,
            stagger: 0.004,
            ease: 'power1.out',
          },
          'confettiBurst'
        )
        .to(
          confetti.particles,
          {
            y: (index) => -220 - (index % 8) * 20,
            duration: 0.72,
            ease: 'power2.out',
          },
          'confettiBurst'
        )
        .to(
          confetti.particles,
          {
            y: (index) => 135 + (index % 7) * 12,
            duration: 1.2,
            ease: 'power2.in',
          },
          'confettiBurst+=0.72'
        );
    }

    tl.to(
      completedNodeEl,
      { scale: 1, duration: 0.45, ease: 'elastic.out(1, 0.4)' },
      'confettiBurst+=0.04'
    );
  }

  // 2. Nối đường sáng tới next node.
  if (connectingPathEl) {
    try {
      const length = connectingPathEl.getTotalLength() || 300;
      connectingPathEl.style.strokeDasharray = `${length}`;
      tl.fromTo(
        connectingPathEl,
        { strokeDashoffset: length },
        { strokeDashoffset: 0, duration: 0.6, ease: 'power1.inOut' },
        '-=0.1'
      );
    } catch {
      // Fallback nếu getTotalLength lỗi
    }
  }

  // 3. Next node sáng lên và nảy nhẹ.
  if (nextNodeEl) {
    tl.fromTo(
      nextNodeEl,
      { scale: 0.9, opacity: 0.8 },
      { scale: 1.08, opacity: 1, duration: 0.35, ease: 'back.out(2)' }
    ).to(nextNodeEl, { scale: 1, duration: 0.2, ease: 'power1.out' });
  }

  return tl;
};

export const killUnlockSequence = (timeline) => {
  if (!timeline) return;
  timeline.kill();
  if (typeof timeline.__lpCleanup === 'function') timeline.__lpCleanup();
};

/**
 * Dọn dẹp animation của một hoặc nhiều elements
 */
export const killMotion = (targets) => {
  if (targets) {
    gsap.killTweensOf(targets);
  }
};
