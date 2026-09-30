import React, { useEffect, useState } from 'react';
import { motion, useMotionValue, useSpring } from 'framer-motion';

export function CustomCursor() {
  const [isEnabled, setIsEnabled] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [isHovering, setIsHovering] = useState(false);
  const [isClicking, setIsClicking] = useState(false);
  const [isInput, setIsInput] = useState(false);

  // Mouse coordinate motion values
  const mouseX = useMotionValue(-100);
  const mouseY = useMotionValue(-100);

  // Magnetic center target motion values
  const ringTargetX = useMotionValue(-100);
  const ringTargetY = useMotionValue(-100);

  // Smooth springs for outer circular follower
  const ringX = useSpring(ringTargetX, { damping: 25, stiffness: 320, mass: 0.45 });
  const ringY = useSpring(ringTargetY, { damping: 25, stiffness: 320, mass: 0.45 });

  // Snappy spring for inner precision dot
  const dotX = useSpring(mouseX, { damping: 35, stiffness: 700, mass: 0.15 });
  const dotY = useSpring(mouseY, { damping: 35, stiffness: 700, mass: 0.15 });

  useEffect(() => {
    // Only enable on devices with fine pointer (mouse / trackpad)
    const mediaQuery = window.matchMedia('(pointer: fine)');
    const updateEnabled = () => {
      const finePointer = mediaQuery.matches;
      setIsEnabled(finePointer);
      if (finePointer) {
        document.body.classList.add('custom-cursor-active');
      } else {
        document.body.classList.remove('custom-cursor-active');
      }
    };

    updateEnabled();
    mediaQuery.addEventListener('change', updateEnabled);

    if (!mediaQuery.matches) {
      return () => {
        mediaQuery.removeEventListener('change', updateEnabled);
        document.body.classList.remove('custom-cursor-active');
      };
    }

    const handleMouseMove = (e: MouseEvent) => {
      const clientX = e.clientX;
      const clientY = e.clientY;

      mouseX.set(clientX);
      mouseY.set(clientY);

      if (!isVisible) setIsVisible(true);

      // Check if hovering over an interactive or magnetic element
      const target = e.target as HTMLElement | null;
      const interactiveEl = target?.closest(
        'button, a, [role="button"], input, textarea, select, [data-magnetic="true"], [data-cursor="interactive"]'
      ) as HTMLElement | null;

      if (interactiveEl) {
        const isFormInput =
          interactiveEl.tagName === 'INPUT' ||
          interactiveEl.tagName === 'TEXTAREA' ||
          interactiveEl.tagName === 'SELECT';

        setIsInput(isFormInput);
        setIsHovering(true);

        if (!isFormInput) {
          const rect = interactiveEl.getBoundingClientRect();
          const centerX = rect.left + rect.width / 2;
          const centerY = rect.top + rect.height / 2;

          // Magnetic pull calculation: pull the cursor ring towards the element center with spring resistance
          const distanceX = clientX - centerX;
          const distanceY = clientY - centerY;

          // Clamped pull (35% towards cursor, 65% snapped to center)
          const pullX = centerX + distanceX * 0.35;
          const pullY = centerY + distanceY * 0.35;

          ringTargetX.set(pullX);
          ringTargetY.set(pullY);
        } else {
          ringTargetX.set(clientX);
          ringTargetY.set(clientY);
        }
      } else {
        setIsHovering(false);
        setIsInput(false);
        ringTargetX.set(clientX);
        ringTargetY.set(clientY);
      }
    };

    const handleMouseDown = () => setIsClicking(true);
    const handleMouseUp = () => setIsClicking(false);

    const handleMouseLeave = () => {
      setIsVisible(false);
      setIsHovering(false);
    };

    const handleMouseEnter = () => {
      setIsVisible(true);
    };

    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    window.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mouseup', handleMouseUp);
    document.documentElement.addEventListener('mouseleave', handleMouseLeave);
    document.documentElement.addEventListener('mouseenter', handleMouseEnter);

    return () => {
      mediaQuery.removeEventListener('change', updateEnabled);
      document.body.classList.remove('custom-cursor-active');
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mouseup', handleMouseUp);
      document.documentElement.removeEventListener('mouseleave', handleMouseLeave);
      document.documentElement.removeEventListener('mouseenter', handleMouseEnter);
    };
  }, [isVisible, mouseX, mouseY, ringTargetX, ringTargetY]);

  if (!isEnabled) {
    return null;
  }

  return (
    <>
      {/* Outer Magnetic Circular Follower */}
      <motion.div
        className="fixed top-0 left-0 pointer-events-none z-[9999] rounded-full will-change-transform"
        style={{
          x: ringX,
          y: ringY,
          translateX: '-50%',
          translateY: '-50%',
        }}
        initial={{ opacity: 0, scale: 0.4 }}
        animate={{
          opacity: isVisible ? (isInput ? 0.3 : 1) : 0,
          scale: !isVisible
            ? 0.4
            : isClicking
            ? 0.8
            : isHovering
            ? isInput
              ? 0.7
              : 1.6
            : 1,
          width: isHovering && !isInput ? 52 : 34,
          height: isHovering && !isInput ? 52 : 34,
          backgroundColor:
            isHovering && !isInput ? 'rgba(255, 255, 255, 0.12)' : 'rgba(255, 255, 255, 0)',
          borderColor:
            isHovering && !isInput ? 'rgba(255, 255, 255, 0.8)' : 'rgba(255, 255, 255, 0.55)',
          borderWidth: isHovering && !isInput ? '1.5px' : '1px',
          backdropFilter: isHovering && !isInput ? 'blur(2px)' : 'none',
        }}
        transition={{
          scale: { type: 'spring', damping: 20, stiffness: 350 },
          width: { type: 'spring', damping: 24, stiffness: 320 },
          height: { type: 'spring', damping: 24, stiffness: 320 },
          backgroundColor: { duration: 0.18 },
          borderColor: { duration: 0.18 },
          opacity: { duration: 0.15 },
        }}
      >
        {/* Subtle magnetic pulse highlight when hovering interactive items */}
        {isHovering && !isInput && (
          <motion.div
            className="absolute inset-0 rounded-full border border-white/40"
            initial={{ scale: 0.9, opacity: 0.7 }}
            animate={{ scale: 1.3, opacity: 0 }}
            transition={{ repeat: Infinity, duration: 1.4, ease: 'easeOut' }}
          />
        )}
      </motion.div>

      {/* Inner Precision Dot */}
      <motion.div
        className="fixed top-0 left-0 pointer-events-none z-[10000] rounded-full bg-white will-change-transform"
        style={{
          x: dotX,
          y: dotY,
          translateX: '-50%',
          translateY: '-50%',
          boxShadow: '0 0 8px rgba(255, 255, 255, 0.9)',
        }}
        initial={{ opacity: 0 }}
        animate={{
          opacity: isVisible ? (isInput ? 0.2 : 1) : 0,
          scale: !isVisible ? 0 : isClicking ? 0.6 : isHovering && !isInput ? 1.4 : 1,
          width: isHovering && !isInput ? 6 : 5,
          height: isHovering && !isInput ? 6 : 5,
        }}
        transition={{
          scale: { type: 'spring', damping: 24, stiffness: 550 },
          opacity: { duration: 0.15 },
        }}
      />
    </>
  );
}
