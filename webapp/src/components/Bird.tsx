import { useEffect, useRef, useState, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { motion, useAnimation, useSpring, useTransform } from 'framer-motion';

// Define landing spots for each route
const LANDING_SPOTS: Record<string, { selector: string; offsetX: number; offsetY: number }> = {
  '/welcome': { selector: '[data-bird-perch="photos"]', offsetX: 80, offsetY: -24 },
  '/login': { selector: '[data-bird-perch="welcome"]', offsetX: 100, offsetY: -24 },
  '/register': { selector: '[data-bird-perch="start"]', offsetX: 60, offsetY: -24 },
  '/': { selector: '[data-bird-perch="choose"]', offsetX: 70, offsetY: -24 },
  '/upload': { selector: '[data-bird-perch="upload"]', offsetX: 80, offsetY: -24 },
  '/selection': { selector: '[data-bird-perch="select"]', offsetX: 70, offsetY: -24 },
  '/processing': { selector: '[data-bird-perch="processing"]', offsetX: 90, offsetY: -24 },
  '/result': { selector: '[data-bird-perch="result"]', offsetX: 55, offsetY: -24 },
  '/library': { selector: '[data-bird-perch="library"]', offsetX: 90, offsetY: -24 },
  '/account': { selector: '[data-bird-perch="account"]', offsetX: 95, offsetY: -24 },
};

// Elegant pigeon SVG with graceful proportions
const PigeonSVG = ({ 
  headTilt = 0, 
  bodyTilt = 0,
  blinking = false,
  wingPhase = 0, // 0-1 for smooth wing animation
  isPerched = true,
}: { 
  headTilt: number;
  bodyTilt: number;
  blinking: boolean;
  wingPhase: number;
  isPerched: boolean;
}) => {
  // Smooth, subtle head movement
  const headRotation = headTilt * 0.15;
  const headTranslateY = Math.sin(headTilt * 0.02) * 1;
  
  // Wing position based on phase (0 = down, 0.5 = up, 1 = down)
  const wingY = isPerched ? 0 : Math.sin(wingPhase * Math.PI * 2) * 12;
  const wingCurve = isPerched ? 0 : Math.sin(wingPhase * Math.PI * 2) * 8;
  
  return (
    <svg
      width="56"
      height="44"
      viewBox="0 0 56 44"
      fill="none"
      className="text-stone-600"
      style={{ 
        transform: `rotate(${bodyTilt * 0.05}deg)`,
        transition: 'transform 0.3s ease-out'
      }}
    >
      {/* Elegant pigeon body - smooth, rounded form */}
      <path
        d="M18 28 
           C14 28, 10 26, 8 24
           C6 22, 6 20, 8 18
           C10 16, 16 16, 22 16
           C28 16, 34 18, 38 22
           C42 26, 44 30, 42 32
           C40 34, 34 34, 28 34
           C22 34, 18 32, 18 28Z"
        stroke="currentColor"
        strokeWidth="1.2"
        fill="none"
      />
      
      {/* Chest detail - subtle line */}
      <path
        d="M20 24 C22 26, 26 28, 32 28"
        stroke="currentColor"
        strokeWidth="0.8"
        opacity="0.5"
        fill="none"
      />
      
      {/* Left wing */}
      <motion.path
        d={`M22 24 
            C18 ${22 - wingY}, 12 ${20 - wingY - wingCurve}, 6 ${22 - wingY}
            C10 ${24 - wingY * 0.5}, 16 26, 22 26`}
        stroke="currentColor"
        strokeWidth="1.2"
        fill="none"
        style={{ transition: isPerched ? 'none' : 'd 0.08s ease-out' }}
      />
      
      {/* Right wing (behind body) */}
      <motion.path
        d={`M32 24 
            C36 ${22 - wingY}, 42 ${20 - wingY - wingCurve}, 48 ${22 - wingY}
            C44 ${24 - wingY * 0.5}, 38 26, 32 26`}
        stroke="currentColor"
        strokeWidth="1.2"
        fill="none"
        opacity="0.6"
        style={{ transition: isPerched ? 'none' : 'd 0.08s ease-out' }}
      />
      
      {/* Wing feather details when perched */}
      {isPerched && (
        <>
          <path d="M18 26 C16 27, 14 28, 12 28" stroke="currentColor" strokeWidth="0.6" opacity="0.4" />
          <path d="M19 27 C17 28, 15 29, 13 29" stroke="currentColor" strokeWidth="0.6" opacity="0.3" />
        </>
      )}
      
      {/* Elegant tail feathers */}
      <path
        d="M8 24 C4 26, 2 28, 0 32"
        stroke="currentColor"
        strokeWidth="1"
        fill="none"
      />
      <path
        d="M8 24 C5 27, 4 30, 3 34"
        stroke="currentColor"
        strokeWidth="0.8"
        opacity="0.7"
        fill="none"
      />
      <path
        d="M9 25 C7 28, 6 31, 6 35"
        stroke="currentColor"
        strokeWidth="0.6"
        opacity="0.5"
        fill="none"
      />
      
      {/* Head group with smooth rotation */}
      <g 
        style={{ 
          transformOrigin: '38px 14px', 
          transform: `rotate(${headRotation}deg) translateY(${headTranslateY}px)`,
          transition: 'transform 0.2s ease-out'
        }}
      >
        {/* Head - elegant rounded shape */}
        <ellipse cx="40" cy="12" rx="7" ry="6" stroke="currentColor" strokeWidth="1.2" fill="none" />
        
        {/* Subtle neck connection */}
        <path
          d="M34 16 C36 14, 38 14, 40 14"
          stroke="currentColor"
          strokeWidth="1"
          opacity="0.6"
          fill="none"
        />
        
        {/* Beak - refined, curved */}
        <path
          d="M47 11 C50 10, 52 11, 52 12 C52 13, 50 14, 47 13"
          stroke="currentColor"
          strokeWidth="1"
          fill="none"
        />
        
        {/* Eye with expression */}
        {blinking ? (
          <path d="M42 10 C43 10, 44 10, 45 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        ) : (
          <>
            {/* Eye white area suggestion */}
            <circle cx="43" cy="10" r="2.5" stroke="currentColor" strokeWidth="0.8" fill="none" />
            {/* Pupil */}
            <circle cx="43.5" cy="10" r="1.2" fill="currentColor" />
            {/* Highlight */}
            <circle cx="44" cy="9.5" r="0.5" fill="#f8f8f6" />
          </>
        )}
        
        {/* Head feather crest - subtle */}
        <path
          d="M36 8 C37 6, 38 5, 40 6"
          stroke="currentColor"
          strokeWidth="0.8"
          opacity="0.5"
          fill="none"
        />
      </g>
      
      {/* Feet - only when perched */}
      {isPerched && (
        <>
          <g stroke="currentColor" strokeWidth="1" fill="none">
            {/* Left foot */}
            <path d="M24 34 L24 40" />
            <path d="M22 40 L24 38 L26 40" />
            {/* Right foot */}
            <path d="M32 34 L32 40" />
            <path d="M30 40 L32 38 L34 40" />
          </g>
        </>
      )}
    </svg>
  );
};

export const Bird = () => {
  const location = useLocation();
  const controls = useAnimation();
  const [position, setPosition] = useState({ x: 100, y: 100 });
  const [blinking, setBlinking] = useState(false);
  const [isFlying, setIsFlying] = useState(false);
  const [wingPhase, setWingPhase] = useState(0);
  const [isVisible, setIsVisible] = useState(true);
  const lastRouteRef = useRef(location.pathname);
  const birdRef = useRef<HTMLDivElement>(null);
  const mouseRef = useRef({ x: 0, y: 0 });
  const wingAnimationRef = useRef<number>();
  
  // Smooth spring-based head tracking
  const headTiltSpring = useSpring(0, { stiffness: 50, damping: 20 });
  const bodyTiltSpring = useSpring(0, { stiffness: 30, damping: 25 });
  
  // Transform springs to values
  const headTilt = useTransform(headTiltSpring, v => v);
  const bodyTilt = useTransform(bodyTiltSpring, v => v);
  
  const [headTiltValue, setHeadTiltValue] = useState(0);
  const [bodyTiltValue, setBodyTiltValue] = useState(0);

  // Find perch position on current page
  const findPerchPosition = useCallback(() => {
    const spot = LANDING_SPOTS[location.pathname] || LANDING_SPOTS['/welcome'];
    const element = document.querySelector(spot.selector);
    
    if (element) {
      const rect = element.getBoundingClientRect();
      return {
        x: rect.left + spot.offsetX,
        y: rect.top + spot.offsetY + window.scrollY,
      };
    }
    
    return { x: window.innerWidth / 2, y: 150 };
  }, [location.pathname]);

  // Graceful wing flapping animation
  useEffect(() => {
    if (isFlying) {
      let startTime = Date.now();
      const flapSpeed = 0.008; // Slow, graceful flaps
      
      const animate = () => {
        const elapsed = Date.now() - startTime;
        setWingPhase((elapsed * flapSpeed) % 1);
        wingAnimationRef.current = requestAnimationFrame(animate);
      };
      
      wingAnimationRef.current = requestAnimationFrame(animate);
      
      return () => {
        if (wingAnimationRef.current) {
          cancelAnimationFrame(wingAnimationRef.current);
        }
      };
    } else {
      setWingPhase(0);
    }
  }, [isFlying]);

  // Handle route changes - graceful flight to new position
  useEffect(() => {
    if (lastRouteRef.current !== location.pathname) {
      lastRouteRef.current = location.pathname;
      
      setIsFlying(true);
      
      // Graceful takeoff - gentle arc upward
      const startX = position.x;
      const startY = position.y;
      
      controls.start({
        y: startY - 150,
        x: startX + (Math.random() - 0.5) * 100,
        transition: { 
          duration: 0.8, 
          ease: [0.25, 0.1, 0.25, 1] // Smooth ease
        },
      }).then(() => {
        // Wait for new page, then find perch
        setTimeout(() => {
          const newPos = findPerchPosition();
          setPosition(newPos);
          
          // Graceful landing - gentle arc downward
          controls.start({
            x: newPos.x,
            y: newPos.y,
            transition: { 
              duration: 1.0, 
              ease: [0.25, 0.1, 0.25, 1]
            },
          }).then(() => {
            // Small settling bounce
            controls.start({
              y: newPos.y + 2,
              transition: { duration: 0.15, ease: 'easeOut' }
            }).then(() => {
              controls.start({
                y: newPos.y,
                transition: { duration: 0.1, ease: 'easeIn' }
              });
              setIsFlying(false);
            });
          });
        }, 150);
      });
    }
  }, [location.pathname, controls, findPerchPosition, position.x, position.y]);

  // Initial positioning with gentle entrance
  useEffect(() => {
    const timer = setTimeout(() => {
      const pos = findPerchPosition();
      setPosition(pos);
      controls.set({ x: pos.x, y: pos.y - 50, opacity: 0 });
      controls.start({ 
        x: pos.x, 
        y: pos.y, 
        opacity: 1,
        transition: { duration: 0.8, ease: 'easeOut' }
      });
    }, 600);
    
    return () => clearTimeout(timer);
  }, [findPerchPosition, controls]);

  // Reposition on window resize
  useEffect(() => {
    const handleResize = () => {
      if (!isFlying) {
        const pos = findPerchPosition();
        setPosition(pos);
        controls.start({ 
          x: pos.x, 
          y: pos.y, 
          transition: { duration: 0.5, ease: 'easeInOut' } 
        });
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [findPerchPosition, controls, isFlying]);

  // Smooth, organic mouse tracking
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      mouseRef.current = { x: e.clientX, y: e.clientY };
      
      if (birdRef.current && !isFlying) {
        const birdRect = birdRef.current.getBoundingClientRect();
        const birdCenterX = birdRect.left + birdRect.width / 2;
        const birdCenterY = birdRect.top + birdRect.height / 2;
        
        const deltaX = e.clientX - birdCenterX;
        const deltaY = e.clientY - birdCenterY;
        
        // Calculate angle for head tilt
        const angle = Math.atan2(deltaY, deltaX) * (180 / Math.PI);
        
        // Distance affects intensity of reaction
        const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
        const intensity = Math.min(1, 200 / distance);
        
        headTiltSpring.set(angle * intensity);
        bodyTiltSpring.set(deltaX * 0.02 * intensity);
      }
    };

    // Update spring values to state for rendering
    const unsubHead = headTilt.on('change', setHeadTiltValue);
    const unsubBody = bodyTilt.on('change', setBodyTiltValue);

    window.addEventListener('mousemove', handleMouseMove);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      unsubHead();
      unsubBody();
    };
  }, [isFlying, headTilt, bodyTilt, headTiltSpring, bodyTiltSpring]);

  // Natural, random blinking
  useEffect(() => {
    const scheduleBlink = () => {
      const delay = 2000 + Math.random() * 4000; // 2-6 seconds between blinks
      
      return setTimeout(() => {
        setBlinking(true);
        // Quick blink
        setTimeout(() => setBlinking(false), 100 + Math.random() * 50);
        // Occasionally double blink
        if (Math.random() > 0.7) {
          setTimeout(() => {
            setBlinking(true);
            setTimeout(() => setBlinking(false), 80);
          }, 200);
        }
        scheduleBlink();
      }, delay);
    };

    const timeoutId = scheduleBlink();
    return () => clearTimeout(timeoutId);
  }, []);

  // Subtle idle breathing animation
  useEffect(() => {
    if (!isFlying) {
      const breathe = () => {
        controls.start({
          y: position.y + 1,
          transition: { duration: 2, ease: 'easeInOut' }
        }).then(() => {
          controls.start({
            y: position.y,
            transition: { duration: 2, ease: 'easeInOut' }
          }).then(breathe);
        });
      };
      
      const timer = setTimeout(breathe, 1000);
      return () => clearTimeout(timer);
    }
  }, [isFlying, position.y, controls]);

  // Hide bird on admin pages
  useEffect(() => {
    const hiddenRoutes = ['/admin'];
    setIsVisible(!hiddenRoutes.includes(location.pathname));
  }, [location.pathname]);

  if (!isVisible) return null;

  return (
    <motion.div
      ref={birdRef}
      className="pointer-events-none fixed z-50"
      initial={{ opacity: 0 }}
      animate={controls}
      style={{ left: 0, top: 0 }}
    >
      <PigeonSVG 
        headTilt={headTiltValue} 
        bodyTilt={bodyTiltValue}
        blinking={blinking}
        wingPhase={wingPhase}
        isPerched={!isFlying}
      />
    </motion.div>
  );
};

export default Bird;
