import { useEffect, useRef, useState, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { motion, useAnimation, AnimatePresence } from 'framer-motion';

// Define landing spots for each route - the bird will land on different words
const LANDING_SPOTS: Record<string, { selector: string; offsetX: number; offsetY: number }> = {
  '/welcome': { selector: '[data-bird-perch="photos"]', offsetX: 45, offsetY: -28 },
  '/login': { selector: '[data-bird-perch="welcome"]', offsetX: 60, offsetY: -28 },
  '/register': { selector: '[data-bird-perch="start"]', offsetX: 35, offsetY: -28 },
  '/': { selector: '[data-bird-perch="choose"]', offsetX: 50, offsetY: -28 },
  '/upload': { selector: '[data-bird-perch="upload"]', offsetX: 45, offsetY: -28 },
  '/selection': { selector: '[data-bird-perch="select"]', offsetX: 40, offsetY: -28 },
  '/processing': { selector: '[data-bird-perch="processing"]', offsetX: 70, offsetY: -28 },
  '/result': { selector: '[data-bird-perch="result"]', offsetX: 45, offsetY: -28 },
  '/library': { selector: '[data-bird-perch="library"]', offsetX: 50, offsetY: -28 },
  '/account': { selector: '[data-bird-perch="account"]', offsetX: 55, offsetY: -28 },
};

// Line-drawing bird SVG component
const BirdSVG = ({ 
  lookAngle = 0, 
  blinking = false,
  flapping = false,
}: { 
  lookAngle: number;
  blinking: boolean;
  flapping: boolean;
}) => {
  // Head rotation based on mouse position (-15 to 15 degrees)
  const headRotation = Math.max(-15, Math.min(15, lookAngle * 0.3));
  
  return (
    <svg
      width="48"
      height="40"
      viewBox="0 0 48 40"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="text-stone-700"
    >
      {/* Body */}
      <ellipse cx="24" cy="28" rx="12" ry="8" />
      
      {/* Wing */}
      <motion.path
        d="M16 26 C12 22, 8 24, 6 28"
        animate={{ 
          d: flapping 
            ? ["M16 26 C12 22, 8 24, 6 28", "M16 26 C12 18, 8 16, 6 20", "M16 26 C12 22, 8 24, 6 28"]
            : "M16 26 C12 22, 8 24, 6 28"
        }}
        transition={{ duration: 0.15, repeat: flapping ? Infinity : 0 }}
      />
      <motion.path
        d="M32 26 C36 22, 40 24, 42 28"
        animate={{ 
          d: flapping 
            ? ["M32 26 C36 22, 40 24, 42 28", "M32 26 C36 18, 40 16, 42 20", "M32 26 C36 22, 40 24, 42 28"]
            : "M32 26 C36 22, 40 24, 42 28"
        }}
        transition={{ duration: 0.15, repeat: flapping ? Infinity : 0 }}
      />
      
      {/* Head group with rotation */}
      <g style={{ transformOrigin: '24px 18px', transform: `rotate(${headRotation}deg)` }}>
        {/* Head */}
        <circle cx="24" cy="14" r="8" />
        
        {/* Beak */}
        <path d="M32 14 L38 12 L32 16 Z" fill="currentColor" />
        
        {/* Eye */}
        {blinking ? (
          <line x1="26" y1="12" x2="30" y2="12" strokeWidth="2" />
        ) : (
          <>
            <circle cx="28" cy="12" r="2.5" fill="currentColor" />
            <circle cx="29" cy="11" r="0.8" fill="white" />
          </>
        )}
      </g>
      
      {/* Tail feathers */}
      <path d="M12 32 L4 36" />
      <path d="M12 30 L2 32" />
      <path d="M12 34 L6 40" />
      
      {/* Feet (only show when perched) */}
      {!flapping && (
        <>
          <path d="M20 36 L20 40 M18 40 L22 40" />
          <path d="M28 36 L28 40 M26 40 L30 40" />
        </>
      )}
    </svg>
  );
};

export const Bird = () => {
  const location = useLocation();
  const controls = useAnimation();
  const [position, setPosition] = useState({ x: 100, y: 100 });
  const [lookAngle, setLookAngle] = useState(0);
  const [blinking, setBlinking] = useState(false);
  const [isFlying, setIsFlying] = useState(false);
  const [isVisible, setIsVisible] = useState(true);
  const lastRouteRef = useRef(location.pathname);
  const birdRef = useRef<HTMLDivElement>(null);

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
    
    // Fallback position
    return { x: window.innerWidth / 2, y: 150 };
  }, [location.pathname]);

  // Handle route changes - bird flies to new position
  useEffect(() => {
    if (lastRouteRef.current !== location.pathname) {
      lastRouteRef.current = location.pathname;
      
      // Start flying animation
      setIsFlying(true);
      
      // Fly up and off screen first
      controls.start({
        y: -100,
        x: position.x + (Math.random() - 0.5) * 200,
        transition: { duration: 0.4, ease: 'easeIn' },
      }).then(() => {
        // Wait for new page to render, then find perch
        setTimeout(() => {
          const newPos = findPerchPosition();
          setPosition(newPos);
          
          // Fly down to new perch
          controls.start({
            x: newPos.x,
            y: newPos.y,
            transition: { duration: 0.6, ease: 'easeOut' },
          }).then(() => {
            setIsFlying(false);
          });
        }, 100);
      });
    }
  }, [location.pathname, controls, findPerchPosition, position.x]);

  // Initial positioning
  useEffect(() => {
    const timer = setTimeout(() => {
      const pos = findPerchPosition();
      setPosition(pos);
      controls.set({ x: pos.x, y: pos.y });
    }, 500);
    
    return () => clearTimeout(timer);
  }, [findPerchPosition, controls]);

  // Reposition on window resize
  useEffect(() => {
    const handleResize = () => {
      if (!isFlying) {
        const pos = findPerchPosition();
        setPosition(pos);
        controls.start({ x: pos.x, y: pos.y, transition: { duration: 0.3 } });
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [findPerchPosition, controls, isFlying]);

  // Mouse tracking for head movement
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (birdRef.current && !isFlying) {
        const birdRect = birdRef.current.getBoundingClientRect();
        const birdCenterX = birdRect.left + birdRect.width / 2;
        const birdCenterY = birdRect.top + birdRect.height / 2;
        
        // Calculate angle from bird to mouse
        const deltaX = e.clientX - birdCenterX;
        const deltaY = e.clientY - birdCenterY;
        const angle = Math.atan2(deltaY, deltaX) * (180 / Math.PI);
        
        setLookAngle(angle);
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, [isFlying]);

  // Random blinking
  useEffect(() => {
    const blinkInterval = setInterval(() => {
      if (Math.random() > 0.7) {
        setBlinking(true);
        setTimeout(() => setBlinking(false), 150);
      }
    }, 2000);

    return () => clearInterval(blinkInterval);
  }, []);

  // Hide bird on certain pages (like admin)
  useEffect(() => {
    const hiddenRoutes = ['/admin'];
    setIsVisible(!hiddenRoutes.includes(location.pathname));
  }, [location.pathname]);

  if (!isVisible) return null;

  return (
    <AnimatePresence>
      <motion.div
        ref={birdRef}
        className="pointer-events-none fixed z-50"
        initial={{ x: position.x, y: position.y }}
        animate={controls}
        style={{ 
          left: 0, 
          top: 0,
          transform: `translate(${position.x}px, ${position.y}px)`,
        }}
      >
        <motion.div
          animate={isFlying ? { rotate: [0, -10, 10, -5, 5, 0] } : { rotate: 0 }}
          transition={{ duration: 0.3, repeat: isFlying ? Infinity : 0 }}
        >
          <BirdSVG 
            lookAngle={lookAngle} 
            blinking={blinking}
            flapping={isFlying}
          />
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default Bird;
