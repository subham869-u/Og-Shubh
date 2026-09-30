import React, { useEffect, useRef, useState, useCallback } from 'react';
import { CustomCursor } from './components/CustomCursor';
import { Magnetic } from './components/MagneticElement';

// Custom typewriter hook according to specification:
// text, speed (default 38ms), startDelay (default 600ms)
// returns { displayed, done }
function useTypewriter({
  text,
  speed = 38,
  startDelay = 600,
}: {
  text: string;
  speed?: number;
  startDelay?: number;
}) {
  const [displayed, setDisplayed] = useState('');
  const [done, setDone] = useState(false);

  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout>;
    let intervalId: ReturnType<typeof setInterval>;
    let charIndex = 0;

    setDisplayed('');
    setDone(false);

    timeoutId = setTimeout(() => {
      intervalId = setInterval(() => {
        if (charIndex < text.length) {
          charIndex++;
          setDisplayed(text.slice(0, charIndex));
          if (charIndex >= text.length) {
            setDone(true);
            clearInterval(intervalId);
          }
        } else {
          setDone(true);
          clearInterval(intervalId);
        }
      }, speed);
    }, startDelay);

    return () => {
      clearTimeout(timeoutId);
      clearInterval(intervalId);
    };
  }, [text, speed, startDelay]);

  return { displayed, done };
}

export default function App() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const prevXRef = useRef<number | null>(null);
  const targetTimeRef = useRef<number>(0);
  const smoothedTimeRef = useRef<number>(0);
  const isSeekingRef = useRef<boolean>(false);
  const isInteractingRef = useRef<boolean>(false);
  const idleResumeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [buttonsVisible, setButtonsVisible] = useState(false);
  const [copiedToast, setCopiedToast] = useState(false);
  const [activeModal, setActiveModal] = useState<string | null>(null);
  const [formSubmitted, setFormSubmitted] = useState(false);

  // Typewriter hook for hero message
  const { displayed, done } = useTypewriter({
    text: 'Glad you stopped in. Good taste tends to find us. Now, what are we building?',
    speed: 38,
    startDelay: 600,
  });

  // Action buttons fade-in and slide-up 400ms after page load
  useEffect(() => {
    const timer = setTimeout(() => {
      setButtonsVisible(true);
    }, 400);
    return () => clearTimeout(timer);
  }, []);

  // Ensure video plays smoothly on mobile with one-touch unlock fallback
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    video.muted = true;
    video.defaultMuted = true;

    const startPlayback = () => {
      const isMobile = window.innerWidth < 768 || 'ontouchstart' in window;
      if (isMobile) {
        video.play().catch(() => {
          const unlock = () => {
            video.play().catch(() => {});
            window.removeEventListener('touchstart', unlock);
            window.removeEventListener('click', unlock);
          };
          window.addEventListener('touchstart', unlock, { once: true, passive: true });
          window.addEventListener('click', unlock, { once: true });
        });
      } else {
        // Desktop: prime initial frame decode
        video.play().then(() => {
          video.pause();
        }).catch(() => {});
      }
    };

    startPlayback();
  }, []);

  // Handler for video seeked event to coordinate next queue item
  const handleSeeked = useCallback(() => {
    isSeekingRef.current = false;
  }, []);

  // Continuous RequestAnimationFrame loop for butter-smooth 60fps seek interpolation
  useEffect(() => {
    let animId: number;

    const tick = () => {
      const video = videoRef.current;
      if (video && video.duration && !isNaN(video.duration)) {
        if (isInteractingRef.current) {
          // Smoothly lerp towards targetTimeRef
          const diff = targetTimeRef.current - smoothedTimeRef.current;
          if (Math.abs(diff) > 0.001) {
            smoothedTimeRef.current += diff * 0.35;
          } else {
            smoothedTimeRef.current = targetTimeRef.current;
          }

          // Seek if decoder is ready and delta exceeds threshold
          if (!isSeekingRef.current && Math.abs(video.currentTime - smoothedTimeRef.current) > 0.015) {
            isSeekingRef.current = true;
            const clamped = Math.max(0, Math.min(video.duration - 0.05, smoothedTimeRef.current));
            const v = video as HTMLVideoElement & { fastSeek?: (t: number) => void };
            if (typeof v.fastSeek === 'function') {
              v.fastSeek(clamped);
            } else {
              v.currentTime = clamped;
            }
          }
        }
      }
      animId = requestAnimationFrame(tick);
    };

    animId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animId);
  }, []);

  // Mouse & Touch Scrub Listeners
  useEffect(() => {
    const SENSITIVITY = 0.8;

    const handlePointerStart = (clientX: number) => {
      prevXRef.current = clientX;
      isInteractingRef.current = true;

      const video = videoRef.current;
      if (video) {
        video.pause();
        targetTimeRef.current = video.currentTime;
        smoothedTimeRef.current = video.currentTime;
      }

      if (idleResumeTimerRef.current) {
        clearTimeout(idleResumeTimerRef.current);
        idleResumeTimerRef.current = null;
      }
    };

    const handlePointerMove = (clientX: number) => {
      const video = videoRef.current;
      if (prevXRef.current === null) {
        prevXRef.current = clientX;
        return;
      }

      const delta = clientX - prevXRef.current;
      prevXRef.current = clientX;

      if (!video || !video.duration || isNaN(video.duration)) return;

      isInteractingRef.current = true;
      const timeOffset = (delta / window.innerWidth) * SENSITIVITY * video.duration;
      let newTarget = targetTimeRef.current + timeOffset;
      newTarget = Math.max(0, Math.min(video.duration, newTarget));
      targetTimeRef.current = newTarget;

      // On mobile: if user stops touching, schedule auto-resume after 1.5s
      const isMobile = window.innerWidth < 768;
      if (isMobile) {
        if (idleResumeTimerRef.current) clearTimeout(idleResumeTimerRef.current);
        idleResumeTimerRef.current = setTimeout(() => {
          isInteractingRef.current = false;
          if (videoRef.current) {
            videoRef.current.play().catch(() => {});
          }
        }, 1500);
      }
    };

    const handlePointerEnd = () => {
      prevXRef.current = null;
      const isMobile = window.innerWidth < 768;
      if (isMobile) {
        if (idleResumeTimerRef.current) clearTimeout(idleResumeTimerRef.current);
        idleResumeTimerRef.current = setTimeout(() => {
          isInteractingRef.current = false;
          if (videoRef.current) {
            videoRef.current.play().catch(() => {});
          }
        }, 800);
      }
    };

    const onMouseMove = (e: MouseEvent) => {
      handlePointerMove(e.clientX);
    };

    const onMouseLeave = () => {
      handlePointerEnd();
    };

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length > 0) {
        handlePointerStart(e.touches[0].clientX);
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length > 0) {
        handlePointerMove(e.touches[0].clientX);
      }
    };

    const onTouchEnd = () => {
      handlePointerEnd();
    };

    window.addEventListener('mousemove', onMouseMove, { passive: true });
    window.addEventListener('mouseleave', onMouseLeave);
    window.addEventListener('touchstart', onTouchStart, { passive: true });
    window.addEventListener('touchmove', onTouchMove, { passive: true });
    window.addEventListener('touchend', onTouchEnd, { passive: true });

    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseleave', onMouseLeave);
      window.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onTouchEnd);
      if (idleResumeTimerRef.current) clearTimeout(idleResumeTimerRef.current);
    };
  }, []);

  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      targetTimeRef.current = videoRef.current.currentTime || 0;
      smoothedTimeRef.current = videoRef.current.currentTime || 0;
    }
  };

  const handleCopyEmail = async (e: React.MouseEvent) => {
    e.preventDefault();
    const email = 'subhamkr1201@gmail.com';
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(email);
      } else {
        const tempInput = document.createElement('textarea');
        tempInput.value = email;
        document.body.appendChild(tempInput);
        tempInput.select();
        document.execCommand('copy');
        document.body.removeChild(tempInput);
      }
    } catch {
      // Ignore clipboard write errors
    }
    setCopiedToast(true);
    setTimeout(() => {
      setCopiedToast(false);
    }, 2400);
  };

  const handleNavClick = (section: string) => {
    setActiveModal(section);
    setFormSubmitted(false);
  };

  return (
    <div className="relative w-screen min-h-screen bg-black text-white select-none overflow-hidden touch-pan-y">
      {/* Framer Motion Custom Circular Magnetic Cursor */}
      <CustomCursor />

      {/* BACKGROUND VIDEO (mouse-scrub controlled & mobile optimized) */}
      <video
        ref={videoRef}
        muted
        loop
        playsInline
        {...{ 'webkit-playsinline': 'true', 'x5-playsinline': 'true' }}
        preload="auto"
        onSeeked={handleSeeked}
        onLoadedMetadata={handleLoadedMetadata}
        className="pointer-events-none"
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 0,
          objectFit: 'cover',
          objectPosition: '70% center',
          width: '100%',
          height: '100%',
          transform: 'translate3d(0, 0, 0)',
          backfaceVisibility: 'hidden',
          WebkitBackfaceVisibility: 'hidden',
        }}
      >
        <source src="/hero-video.mp4" type="video/mp4" />
        <source src="/hero-video.webm" type="video/webm" />
        <source src="https://files.catbox.moe/ptnvqg.webm" type="video/webm" />
        <source src="https://files.catbox.moe/58a2bi.mp4" type="video/mp4" />
      </video>

      {/* Subtle overlay gradient to ensure high readability */}
      <div
        className="fixed inset-0 pointer-events-none z-0 bg-gradient-to-t from-black/80 via-black/30 to-black/20 md:bg-gradient-to-r md:from-black/70 md:via-black/20 md:to-transparent"
        aria-hidden="true"
      />

      {/* NAVBAR (fixed, z-index: 10) */}
      <header className="fixed top-0 left-0 right-0 z-10 w-full px-5 sm:px-8 py-4 sm:py-5 flex row justify-between items-center">
        {/* Logo (left) */}
        <Magnetic strength={0.25}>
          <div
            className="flex row items-center gap-3 cursor-pointer py-1 px-1"
            data-magnetic="true"
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          >
            <span
              className="text-[21px] sm:text-[26px] tracking-tight text-white select-none"
              style={{ fontFamily: 'var(--font-heading)' }}
            >
              OgShubh&reg;
            </span>
            <span
              className="text-[25px] sm:text-[30px] text-white select-none leading-none"
              style={{ letterSpacing: '-0.02em' }}
              aria-hidden="true"
            >
              ✳︎
            </span>
          </div>
        </Magnetic>

        {/* Desktop nav links (center, hidden below md) */}
        <nav className="hidden md:flex flex-row items-center text-[23px] text-white">
          <Magnetic strength={0.28}>
            <button
              type="button"
              onClick={() => handleNavClick('Labs')}
              className="hover:opacity-60 transition-opacity cursor-pointer bg-transparent border-0 p-1 text-inherit font-inherit"
            >
              Labs
            </button>
          </Magnetic>
          <span className="select-none">,&nbsp;</span>
          <Magnetic strength={0.28}>
            <button
              type="button"
              onClick={() => handleNavClick('Studio')}
              className="hover:opacity-60 transition-opacity cursor-pointer bg-transparent border-0 p-1 text-inherit font-inherit"
            >
              Studio
            </button>
          </Magnetic>
          <span className="select-none">,&nbsp;</span>
          <Magnetic strength={0.28}>
            <button
              type="button"
              onClick={() => handleNavClick('Openings')}
              className="hover:opacity-60 transition-opacity cursor-pointer bg-transparent border-0 p-1 text-inherit font-inherit"
            >
              Openings
            </button>
          </Magnetic>
          <span className="select-none">,&nbsp;</span>
          <Magnetic strength={0.28}>
            <button
              type="button"
              onClick={() => handleNavClick('Shop')}
              className="hover:opacity-60 transition-opacity cursor-pointer bg-transparent border-0 p-1 text-inherit font-inherit"
            >
              Shop
            </button>
          </Magnetic>
        </nav>

        {/* Desktop YouTube link (right, hidden below md) */}
        <Magnetic strength={0.35}>
          <a
            href="https://youtube.com/@og_shubhhh?si=0Lv2iS76OkuBmlRu"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="YouTube Channel"
            className="hidden md:flex items-center justify-center text-white hover:text-[#ff0000] transition-colors duration-200 cursor-pointer p-2 rounded-full"
          >
            <svg
              className="w-7 h-7 fill-current"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
            </svg>
          </a>
        </Magnetic>

        {/* Mobile hamburger (visible below md) */}
        <button
          type="button"
          onClick={() => setMobileMenuOpen((prev) => !prev)}
          aria-label="Toggle navigation menu"
          aria-expanded={mobileMenuOpen}
          className="md:hidden flex flex-col justify-center items-center gap-[5px] p-2 cursor-pointer z-20 focus:outline-none"
        >
          <span
            className={`w-6 h-[2px] bg-white transition-all duration-300 ease-in-out ${
              mobileMenuOpen ? 'rotate-45 translate-y-[7px]' : ''
            }`}
          />
          <span
            className={`w-6 h-[2px] bg-white transition-all duration-300 ease-in-out ${
              mobileMenuOpen ? 'opacity-0' : 'opacity-100'
            }`}
          />
          <span
            className={`w-6 h-[2px] bg-white transition-all duration-300 ease-in-out ${
              mobileMenuOpen ? '-rotate-45 -translate-y-[7px]' : ''
            }`}
          />
        </button>
      </header>

      {/* Mobile overlay (z-index: 9) */}
      <div
        className={`fixed inset-0 bg-black/90 backdrop-blur-md z-[9] flex flex-col justify-center items-start px-8 gap-8 md:hidden transition-opacity duration-300 ${
          mobileMenuOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
      >
        <button
          type="button"
          onClick={() => {
            setMobileMenuOpen(false);
            handleNavClick('Labs');
          }}
          className="text-[32px] font-medium text-white hover:opacity-60 transition-opacity text-left bg-transparent border-0 p-0"
        >
          Labs
        </button>
        <button
          type="button"
          onClick={() => {
            setMobileMenuOpen(false);
            handleNavClick('Studio');
          }}
          className="text-[32px] font-medium text-white hover:opacity-60 transition-opacity text-left bg-transparent border-0 p-0"
        >
          Studio
        </button>
        <button
          type="button"
          onClick={() => {
            setMobileMenuOpen(false);
            handleNavClick('Openings');
          }}
          className="text-[32px] font-medium text-white hover:opacity-60 transition-opacity text-left bg-transparent border-0 p-0"
        >
          Openings
        </button>
        <button
          type="button"
          onClick={() => {
            setMobileMenuOpen(false);
            handleNavClick('Shop');
          }}
          className="text-[32px] font-medium text-white hover:opacity-60 transition-opacity text-left bg-transparent border-0 p-0"
        >
          Shop
        </button>
        <a
          href="https://youtube.com/@og_shubhhh?si=0Lv2iS76OkuBmlRu"
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => setMobileMenuOpen(false)}
          className="flex items-center gap-3 text-[32px] font-medium text-white hover:text-[#ff0000] transition-colors"
        >
          <svg
            className="w-8 h-8 fill-current"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
          </svg>
          <span>YouTube</span>
        </a>
      </div>

      {/* HERO SECTION (z-index: 1) */}
      <main className="relative z-[1] w-full h-screen flex flex-col justify-end pb-12 md:justify-center md:pb-0 px-5 sm:px-8 md:px-10 overflow-hidden">
        {/* Content container: max-w-xl, relative z-10 */}
        <div className="max-w-xl relative z-10">
          {/* 1. Blurred intro label */}
          <div
            className="pointer-events-none select-none mb-5 sm:mb-6"
            style={{
              fontSize: 'clamp(18px, 4vw, 26px)',
              lineHeight: 1.3,
              fontWeight: 400,
              color: '#fff',
              filter: 'blur(4px)',
              transform: 'translate3d(0, 0, 0)',
              willChange: 'filter, transform',
            }}
          >
            Hey there, meet A.R.I.A,
            <br />
            OgShubh's Adaptive Response Interface Agent
          </div>

          {/* 2. Typewriter text */}
          <p
            className="text-white mb-5 sm:mb-6"
            style={{
              fontSize: 'clamp(18px, 4vw, 26px)',
              lineHeight: 1.35,
              fontWeight: 400,
              minHeight: '54px',
            }}
          >
            {displayed}
            {!done && (
              <span
                className="inline-block w-[2px] h-[1.1em] bg-white align-middle ml-[2px] cursor-blink"
                aria-hidden="true"
              />
            )}
          </p>

          {/* 3. Action pill buttons */}
          <div
            className="flex flex-wrap gap-y-1"
            style={{
              opacity: buttonsVisible ? 1 : 0,
              transform: buttonsVisible ? 'translateY(0)' : 'translateY(8px)',
              transition: 'opacity 0.4s ease, transform 0.4s ease',
            }}
          >
            {/* 4 action pill buttons with Black background and White text */}
            <Magnetic strength={0.24} className="mx-[0.2em] mb-[0.4em]">
              <button
                type="button"
                onClick={() => handleNavClick('Pitch us an idea')}
                className="inline-flex items-center justify-center bg-black text-white border border-white/30 rounded-full text-[13px] sm:text-[15px] px-4 sm:px-5 py-[0.3em] whitespace-nowrap cursor-pointer transition-colors duration-200 hover:bg-white hover:text-black hover:border-white"
              >
                Pitch us an idea
              </button>
            </Magnetic>

            <Magnetic strength={0.24} className="mx-[0.2em] mb-[0.4em]">
              <button
                type="button"
                onClick={() => handleNavClick('Come work here')}
                className="inline-flex items-center justify-center bg-black text-white border border-white/30 rounded-full text-[13px] sm:text-[15px] px-4 sm:px-5 py-[0.3em] whitespace-nowrap cursor-pointer transition-colors duration-200 hover:bg-white hover:text-black hover:border-white"
              >
                Come work here
              </button>
            </Magnetic>

            <Magnetic strength={0.24} className="mx-[0.2em] mb-[0.4em]">
              <button
                type="button"
                onClick={() => handleNavClick('Send a brief hello')}
                className="inline-flex items-center justify-center bg-black text-white border border-white/30 rounded-full text-[13px] sm:text-[15px] px-4 sm:px-5 py-[0.3em] whitespace-nowrap cursor-pointer transition-colors duration-200 hover:bg-white hover:text-black hover:border-white"
              >
                Send a brief hello
              </button>
            </Magnetic>

            <Magnetic strength={0.24} className="mx-[0.2em] mb-[0.4em]">
              <button
                type="button"
                onClick={() => handleNavClick('See how we operate')}
                className="inline-flex items-center justify-center bg-black text-white border border-white/30 rounded-full text-[13px] sm:text-[15px] px-4 sm:px-5 py-[0.3em] whitespace-nowrap cursor-pointer transition-colors duration-200 hover:bg-white hover:text-black hover:border-white"
              >
                See how we operate
              </button>
            </Magnetic>

            {/* 1 outline transparent pill button */}
            <Magnetic strength={0.24} className="mx-[0.2em] mb-[0.4em]">
              <button
                type="button"
                onClick={handleCopyEmail}
                className="group inline-flex items-center justify-center text-white bg-transparent border border-white rounded-full text-[13px] sm:text-[15px] px-4 sm:px-5 py-[0.3em] whitespace-nowrap gap-2 sm:gap-3 cursor-pointer transition-colors duration-200 hover:bg-white hover:text-black"
                title="Copy email to clipboard"
              >
                <span>
                  Reach us:{' '}
                  <span className="underline underline-offset-1">
                    subhamkr1201@gmail.com
                  </span>
                </span>
                {/* 12x12 copy icon: inline SVG of two overlapping rectangles */}
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 12 12"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  className="shrink-0"
                  aria-hidden="true"
                >
                  <path
                    d="M4 3V1.5C4 1.22386 4.22386 1 4.5 1H10.5C10.7761 1 11 1.22386 11 1.5V7.5C11 7.77614 10.7761 8 10.5 8H9"
                    stroke="currentColor"
                    strokeWidth="1.1"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <rect
                    x="1.5"
                    y="3.5"
                    width="7.5"
                    height="7.5"
                    rx="0.5"
                    stroke="currentColor"
                    strokeWidth="1.1"
                  />
                </svg>
              </button>
            </Magnetic>
          </div>
        </div>
      </main>

      {/* Copy Toast Notification */}
      <div
        className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 py-2 bg-white text-black text-xs sm:text-sm font-medium rounded-full shadow-2xl transition-all duration-300 pointer-events-none flex items-center gap-2 ${
          copiedToast
            ? 'opacity-100 translate-y-0'
            : 'opacity-0 translate-y-2'
        }`}
      >
        <span>✓</span>
        <span>Copied subhamkr1201@gmail.com to clipboard</span>
      </div>

      {/* Interactive Modal Dialog for all sections */}
      {activeModal && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md transition-opacity duration-200"
          onClick={() => setActiveModal(null)}
        >
          <div
            className="relative w-full max-w-lg bg-[#0e0e10] border border-white/20 rounded-2xl p-6 sm:p-8 text-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close button with Magnetic pull */}
            <div className="absolute top-5 right-5">
              <Magnetic strength={0.35}>
                <button
                  type="button"
                  onClick={() => setActiveModal(null)}
                  className="text-neutral-400 hover:text-white text-xl w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/10 transition-colors"
                  aria-label="Close dialog"
                >
                  ✕
                </button>
              </Magnetic>
            </div>

            {/* Modal Header */}
            <div className="flex items-center gap-2 mb-2 text-xs uppercase tracking-widest text-neutral-400 font-mono">
              <span>OgShubh</span>
              <span>/</span>
              <span>{activeModal}</span>
            </div>

            <h2 className="text-2xl sm:text-3xl font-medium tracking-tight mb-4 text-white">
              {activeModal}
            </h2>

            {/* Content switch */}
            {activeModal === 'Pitch us an idea' && (
              <div>
                {formSubmitted ? (
                  <div className="py-6 text-center">
                    <div className="w-12 h-12 rounded-full bg-white/10 text-white flex items-center justify-center mx-auto mb-3 text-lg">
                      ✓
                    </div>
                    <p className="text-lg font-medium text-white mb-1">
                      Brief received by A.R.I.A
                    </p>
                    <p className="text-sm text-neutral-400">
                      Our partners will review your inquiry and reply within 24 hours.
                    </p>
                    <button
                      type="button"
                      onClick={() => setActiveModal(null)}
                      className="mt-6 px-5 py-2 bg-white text-black rounded-full text-sm font-medium hover:bg-neutral-200 transition-colors"
                    >
                      Done
                    </button>
                  </div>
                ) : (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      setFormSubmitted(true);
                    }}
                    className="space-y-4"
                  >
                    <p className="text-sm text-neutral-300">
                      We partner with founders and brands building high-conviction creative technology.
                    </p>
                    <div>
                      <label className="block text-xs text-neutral-400 mb-1">
                        Your Name
                      </label>
                      <input
                        required
                        type="text"
                        placeholder="Alex Vance"
                        className="w-full bg-white/5 border border-white/15 rounded-lg px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-white transition-colors"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-neutral-400 mb-1">
                        Work Email
                      </label>
                      <input
                        required
                        type="email"
                        placeholder="alex@company.com"
                        className="w-full bg-white/5 border border-white/15 rounded-lg px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-white transition-colors"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-neutral-400 mb-1">
                        What are we building?
                      </label>
                      <textarea
                        required
                        rows={3}
                        placeholder="Tell us about the product vision, timeline, and scope..."
                        className="w-full bg-white/5 border border-white/15 rounded-lg px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-white transition-colors resize-none"
                      />
                    </div>
                    <button
                      type="submit"
                      className="w-full py-3 bg-white text-black rounded-full font-medium text-sm hover:bg-neutral-200 transition-colors cursor-pointer"
                    >
                      Transmitting to Studio →
                    </button>
                  </form>
                )}
              </div>
            )}

            {activeModal === 'Come work here' || activeModal === 'Openings' ? (
              <div className="space-y-4">
                <p className="text-sm text-neutral-300">
                  OgShubh is a nimble collective of designers, creative technologists, and engineers.
                </p>
                <div className="divide-y divide-white/10">
                  <div className="py-3 flex justify-between items-center">
                    <div>
                      <div className="font-medium text-sm text-white">Creative Technologist</div>
                      <div className="text-xs text-neutral-400">WebGL · Shaders · Spatial Interfaces</div>
                    </div>
                    <span className="text-xs text-neutral-300 bg-white/10 px-2.5 py-1 rounded-full">
                      Remote / NYC
                    </span>
                  </div>
                  <div className="py-3 flex justify-between items-center">
                    <div>
                      <div className="font-medium text-sm text-white">Lead Design Engineer</div>
                      <div className="text-xs text-neutral-400">React · Motion · Typography Systems</div>
                    </div>
                    <span className="text-xs text-neutral-300 bg-white/10 px-2.5 py-1 rounded-full">
                      London / Remote
                    </span>
                  </div>
                  <div className="py-3 flex justify-between items-center">
                    <div>
                      <div className="font-medium text-sm text-white">Art Director, Motion</div>
                      <div className="text-xs text-neutral-400">3D CGI · Brand Film · Interactive Art</div>
                    </div>
                    <span className="text-xs text-neutral-300 bg-white/10 px-2.5 py-1 rounded-full">
                      Tokyo / Hybrid
                    </span>
                  </div>
                </div>
                <div className="pt-2">
                  <a
                    href="mailto:subhamkr1201@gmail.com"
                    className="inline-block w-full text-center py-2.5 border border-white/30 rounded-full text-sm font-medium hover:bg-white hover:text-black transition-colors"
                  >
                    Send Portfolio (subhamkr1201@gmail.com)
                  </a>
                </div>
              </div>
            ) : null}

            {activeModal === 'Send a brief hello' || activeModal === 'Get in touch' ? (
              <div>
                {formSubmitted ? (
                  <div className="py-6 text-center">
                    <div className="w-12 h-12 rounded-full bg-white/10 text-white flex items-center justify-center mx-auto mb-3 text-lg">
                      ✓
                    </div>
                    <p className="text-lg font-medium text-white mb-1">
                      Note dispatched
                    </p>
                    <p className="text-sm text-neutral-400">
                      We appreciate your greeting and will reach out shortly.
                    </p>
                    <button
                      type="button"
                      onClick={() => setActiveModal(null)}
                      className="mt-6 px-5 py-2 bg-white text-black rounded-full text-sm font-medium hover:bg-neutral-200 transition-colors"
                    >
                      Close
                    </button>
                  </div>
                ) : (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      setFormSubmitted(true);
                    }}
                    className="space-y-4"
                  >
                    <p className="text-sm text-neutral-300">
                      Whether exploring an upcoming commission or saying hello, our door is open.
                    </p>
                    <div>
                      <label className="block text-xs text-neutral-400 mb-1">Name</label>
                      <input
                        required
                        type="text"
                        placeholder="Jordan Lee"
                        className="w-full bg-white/5 border border-white/15 rounded-lg px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-white transition-colors"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-neutral-400 mb-1">Email</label>
                      <input
                        required
                        type="email"
                        placeholder="jordan@domain.com"
                        className="w-full bg-white/5 border border-white/15 rounded-lg px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-white transition-colors"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-neutral-400 mb-1">Note</label>
                      <textarea
                        required
                        rows={3}
                        placeholder="Say hello, share feedback, or ask a question..."
                        className="w-full bg-white/5 border border-white/15 rounded-lg px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-white transition-colors resize-none"
                      />
                    </div>
                    <button
                      type="submit"
                      className="w-full py-3 bg-white text-black rounded-full font-medium text-sm hover:bg-neutral-200 transition-colors cursor-pointer"
                    >
                      Send Message →
                    </button>
                  </form>
                )}
              </div>
            ) : null}

            {activeModal === 'See how we operate' && (
              <div className="space-y-4 text-sm text-neutral-300">
                <div className="p-3 bg-white/5 rounded-xl border border-white/10">
                  <div className="font-semibold text-white text-xs uppercase tracking-wider mb-1">
                    01. High Concurrency, Zero Bureaucracy
                  </div>
                  <p className="text-xs text-neutral-400">
                    We deploy senior talent directly to problem spaces. You work alongside the builders making decisions.
                  </p>
                </div>
                <div className="p-3 bg-white/5 rounded-xl border border-white/10">
                  <div className="font-semibold text-white text-xs uppercase tracking-wider mb-1">
                    02. Prototypes Before Decks
                  </div>
                  <p className="text-xs text-neutral-400">
                    We validate interactive software through working prototypes in days, avoiding slide decks and theoretical debate.
                  </p>
                </div>
                <div className="p-3 bg-white/5 rounded-xl border border-white/10">
                  <div className="font-semibold text-white text-xs uppercase tracking-wider mb-1">
                    03. Craft at Production Scale
                  </div>
                  <p className="text-xs text-neutral-400">
                    Aesthetic obsession coupled with hardened codebases built to withstand millions of daily active users.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveModal(null)}
                  className="w-full py-2.5 bg-white text-black rounded-full font-medium text-sm hover:bg-neutral-200 transition-colors"
                >
                  Understood
                </button>
              </div>
            )}

            {activeModal === 'Labs' && (
              <div className="space-y-4">
                <p className="text-sm text-neutral-300">
                  Experimental spatial computing, generative visual systems, and interaction models authored by OgShubh R&D.
                </p>
                <div className="space-y-2">
                  <div className="p-3 bg-white/5 rounded-xl border border-white/10 flex items-center justify-between">
                    <div>
                      <div className="text-sm font-medium text-white">Project Chrysalis</div>
                      <div className="text-xs text-neutral-400">Adaptive real-time typography renderer</div>
                    </div>
                    <span className="text-[11px] font-mono text-neutral-400">v0.9.4</span>
                  </div>
                  <div className="p-3 bg-white/5 rounded-xl border border-white/10 flex items-center justify-between">
                    <div>
                      <div className="text-sm font-medium text-white">Kinetics SDK</div>
                      <div className="text-xs text-neutral-400">Physics-guided fluid mouse scrubbing & inertia</div>
                    </div>
                    <span className="text-[11px] font-mono text-neutral-400">Open Source</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveModal(null)}
                  className="w-full py-2.5 bg-white text-black rounded-full font-medium text-sm hover:bg-neutral-200 transition-colors"
                >
                  Close Labs
                </button>
              </div>
            )}

            {activeModal === 'Studio' && (
              <div className="space-y-4">
                <p className="text-sm text-neutral-300">
                  Our practice partners with technology pioneers, luxury houses, and cultural institutions globally.
                </p>
                <div className="grid grid-cols-2 gap-2 text-center text-xs">
                  <div className="p-3 bg-white/5 rounded-lg border border-white/10">
                    <div className="text-white font-medium">Design & Motion</div>
                    <div className="text-neutral-400 mt-1">Brand Systems & Identity</div>
                  </div>
                  <div className="p-3 bg-white/5 rounded-lg border border-white/10">
                    <div className="text-white font-medium">Creative Tech</div>
                    <div className="text-neutral-400 mt-1">Interactive WebGL & 3D</div>
                  </div>
                  <div className="p-3 bg-white/5 rounded-lg border border-white/10">
                    <div className="text-white font-medium">Product Engineering</div>
                    <div className="text-neutral-400 mt-1">Next-Gen Web Experiences</div>
                  </div>
                  <div className="p-3 bg-white/5 rounded-lg border border-white/10">
                    <div className="text-white font-medium">AI & Agentic UI</div>
                    <div className="text-neutral-400 mt-1">Adaptive Interfaces</div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveModal(null)}
                  className="w-full py-2.5 bg-white text-black rounded-full font-medium text-sm hover:bg-neutral-200 transition-colors"
                >
                  Back to Experience
                </button>
              </div>
            )}

            {activeModal === 'Shop' && (
              <div className="space-y-4">
                <p className="text-sm text-neutral-300">
                  Limited hardware artifacts, studio typefaces, and archival print editions released biannually.
                </p>
                <div className="space-y-2">
                  <div className="p-3 bg-white/5 rounded-xl border border-white/10 flex justify-between items-center">
                    <div>
                      <div className="text-sm font-medium text-white">MF-01 Dial Controller</div>
                      <div className="text-xs text-neutral-400">Machined anodized aluminum scrub controller</div>
                    </div>
                    <span className="text-xs text-neutral-400 font-mono">Sold Out</span>
                  </div>
                  <div className="p-3 bg-white/5 rounded-xl border border-white/10 flex justify-between items-center">
                    <div>
                      <div className="text-sm font-medium text-white">OgShubh Mono Typeface</div>
                      <div className="text-xs text-neutral-400">Variable font with 12 optical weights</div>
                    </div>
                    <span className="text-xs text-neutral-400 font-mono">$180</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveModal(null)}
                  className="w-full py-2.5 bg-white text-black rounded-full font-medium text-sm hover:bg-neutral-200 transition-colors"
                >
                  Back to Studio
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
