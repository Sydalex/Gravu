import { motion } from 'framer-motion';
import { ReactNode, useEffect, useState } from 'react';

interface PageWrapperProps {
  children: ReactNode;
  className?: string;
}

const pageVariants = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
};

// Bouncing orb component that moves around the viewport
function BouncingOrb() {
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [velocity, setVelocity] = useState({ x: 0.3, y: 0.2 });
  
  useEffect(() => {
    const orbSize = 500;
    let animationId: number;
    let currentPos = { x: window.innerWidth * 0.7, y: window.innerHeight * 0.2 };
    let currentVel = { x: 0.4, y: 0.3 };
    
    const animate = () => {
      // Update position
      currentPos.x += currentVel.x;
      currentPos.y += currentVel.y;
      
      // Bounce off walls
      if (currentPos.x <= -orbSize / 2 || currentPos.x >= window.innerWidth - orbSize / 2) {
        currentVel.x *= -1;
        currentPos.x = Math.max(-orbSize / 2, Math.min(currentPos.x, window.innerWidth - orbSize / 2));
      }
      if (currentPos.y <= -orbSize / 2 || currentPos.y >= window.innerHeight - orbSize / 2) {
        currentVel.y *= -1;
        currentPos.y = Math.max(-orbSize / 2, Math.min(currentPos.y, window.innerHeight - orbSize / 2));
      }
      
      setPosition({ x: currentPos.x, y: currentPos.y });
      animationId = requestAnimationFrame(animate);
    };
    
    animationId = requestAnimationFrame(animate);
    
    return () => cancelAnimationFrame(animationId);
  }, []);

  return (
    <div
      className="pointer-events-none fixed h-[500px] w-[500px] rounded-full opacity-40 blur-3xl"
      style={{
        background: 'radial-gradient(circle, #f97316 0%, #fbbf24 50%, transparent 70%)',
        transform: `translate(${position.x}px, ${position.y}px)`,
        willChange: 'transform',
      }}
    />
  );
}

export function PageWrapper({ children, className = '' }: PageWrapperProps) {
  return (
    <motion.div
      variants={pageVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      transition={{ duration: 0.4, ease: 'easeOut' }}
      className={`relative min-h-screen bg-[#f8f8f6] overflow-hidden ${className}`}
    >
      {/* Bouncing warm gradient orb */}
      <BouncingOrb />

      {/* Content */}
      <div className="relative z-10">{children}</div>
    </motion.div>
  );
}
