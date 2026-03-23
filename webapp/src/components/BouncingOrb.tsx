import { useEffect, useState } from 'react';

export function BouncingOrb() {
  const [position, setPosition] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const orbSize = 500;
    let animationId: number;
    let currentPos = { x: window.innerWidth * 0.6, y: window.innerHeight * 0.2 };
    // Very slow, calm velocity
    let currentVel = { x: 0.35, y: 0.22 };

    const animate = () => {
      currentPos.x += currentVel.x;
      currentPos.y += currentVel.y;

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
      className="pointer-events-none fixed h-[500px] w-[500px] rounded-full opacity-50 blur-3xl"
      style={{
        background: 'radial-gradient(circle, #f97316 0%, #fbbf24 45%, transparent 70%)',
        transform: `translate(${position.x}px, ${position.y}px)`,
        willChange: 'transform',
        zIndex: 5,
      }}
    />
  );
}
