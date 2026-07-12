import React, { useEffect, useState } from 'react';
import { motion, useAnimation } from 'framer-motion';

const AnimatedHeroArtwork = () => {
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const eyeControls = useAnimation();

  useEffect(() => {
    const handleMouseMove = (e) => {
      // Normalize mouse coordinates (-1 to 1)
      const x = (e.clientX / window.innerWidth) * 2 - 1;
      const y = (e.clientY / window.innerHeight) * 2 - 1;
      setMousePos({ x, y });
      
      eyeControls.start({
        x: x * 15,
        y: y * 15,
        transition: { type: 'spring', stiffness: 50, damping: 20 }
      });
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, [eyeControls]);

  // Generate 24 spokes for Ashok Chakra
  const spokes = Array.from({ length: 24 }).map((_, i) => (
    <line
      key={i}
      x1="200" y1="200" x2="200" y2="175"
      stroke="#000080" strokeWidth="1.5"
      transform={`rotate(${i * 15} 200 200)`}
    />
  ));

  return (
    <div style={{
      position: 'absolute',
      top: 0, left: 0, right: 0, bottom: 0,
      overflow: 'hidden',
      pointerEvents: 'none',
      zIndex: 0
    }}>
      
      {/* Background radial gradient to draw focus to the center */}
      <motion.div
        animate={{
          background: `radial-gradient(circle at ${50 + mousePos.x * 5}% ${50 + mousePos.y * 5}%, rgba(20, 25, 40, 1) 0%, rgba(9, 10, 15, 1) 70%)`
        }}
        style={{
          position: 'absolute', width: '100%', height: '100%'
        }}
      />

      <svg width="100%" height="100%" viewBox="0 0 1000 500" preserveAspectRatio="xMidYMid slice" style={{ position: 'absolute' }}>
        <defs>
          <radialGradient id="eyeGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="rgba(255, 255, 255, 0.15)" />
            <stop offset="100%" stopColor="rgba(255, 255, 255, 0)" />
          </radialGradient>
          <filter id="blurFilter">
            <feGaussianBlur stdDeviation="4" />
          </filter>
        </defs>

        {/* --- Left Hands (Corrupt forces) --- */}
        <motion.g
          initial={{ x: -100, opacity: 0 }}
          animate={{ x: 0, opacity: 0.2 }}
          transition={{ duration: 3, ease: 'easeOut' }}
        >
          {/* Abstract Hand 1 */}
          <motion.path
            d="M -50,150 Q 150,200 250,250 Q 150,230 100,300 Q -20,280 -50,150"
            fill="none"
            stroke="rgba(255, 255, 255, 0.6)"
            strokeWidth="2"
            animate={{
              d: [
                "M -50,150 Q 150,200 250,250 Q 150,230 100,300 Q -20,280 -50,150",
                "M -50,140 Q 160,190 260,250 Q 140,240  90,310 Q -20,270 -50,140",
                "M -50,150 Q 150,200 250,250 Q 150,230 100,300 Q -20,280 -50,150"
              ]
            }}
            transition={{ repeat: Infinity, duration: 6, ease: "easeInOut" }}
          />
          {/* Abstract Hand 2 */}
          <motion.path
            d="M 50,450 Q 200,350 300,320 Q 220,380 150,480 Q 80,450 50,450"
            fill="none"
            stroke="rgba(255, 255, 255, 0.4)"
            strokeWidth="1.5"
            animate={{
              d: [
                "M 50,450 Q 200,350 300,320 Q 220,380 150,480 Q 80,450 50,450",
                "M 40,460 Q 210,340 310,330 Q 210,390 140,490 Q 70,440 40,460",
                "M 50,450 Q 200,350 300,320 Q 220,380 150,480 Q 80,450 50,450"
              ]
            }}
            transition={{ repeat: Infinity, duration: 8, ease: "easeInOut", delay: 1 }}
          />
        </motion.g>

        {/* --- Right Hands (Corrupt forces) --- */}
        <motion.g
          initial={{ x: 100, opacity: 0 }}
          animate={{ x: 0, opacity: 0.2 }}
          transition={{ duration: 3, ease: 'easeOut', delay: 0.5 }}
        >
          {/* Abstract Hand 3 */}
          <motion.path
            d="M 1050,150 Q 850,200 750,250 Q 850,230 900,300 Q 1020,280 1050,150"
            fill="none"
            stroke="rgba(255, 255, 255, 0.6)"
            strokeWidth="2"
            animate={{
              d: [
                "M 1050,150 Q 850,200 750,250 Q 850,230 900,300 Q 1020,280 1050,150",
                "M 1050,140 Q 840,190 740,250 Q 860,240 910,310 Q 1020,270 1050,140",
                "M 1050,150 Q 850,200 750,250 Q 850,230 900,300 Q 1020,280 1050,150"
              ]
            }}
            transition={{ repeat: Infinity, duration: 7, ease: "easeInOut", delay: 0.5 }}
          />
          {/* Abstract Hand 4 */}
          <motion.path
            d="M 950,450 Q 800,350 700,320 Q 780,380 850,480 Q 920,450 950,450"
            fill="none"
            stroke="rgba(255, 255, 255, 0.4)"
            strokeWidth="1.5"
            animate={{
              d: [
                "M 950,450 Q 800,350 700,320 Q 780,380 850,480 Q 920,450 950,450",
                "M 960,460 Q 790,340 690,330 Q 790,390 860,490 Q 930,440 960,460",
                "M 950,450 Q 800,350 700,320 Q 780,380 850,480 Q 920,450 950,450"
              ]
            }}
            transition={{ repeat: Infinity, duration: 9, ease: "easeInOut", delay: 1.5 }}
          />
        </motion.g>

        {/* --- Central Eye of Watchfulness --- */}
        <motion.g
          animate={eyeControls}
          initial={{ scale: 0.8, opacity: 0 }}
          whileInView={{ scale: 1, opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 1.5, ease: "easeOut" }}
          transform="translate(300, 50)"
        >
          {/* Pulsing Outer Glow */}
          <motion.circle
            cx="200" cy="200" r="150"
            fill="url(#eyeGlow)"
            animate={{ r: [150, 180, 150], opacity: [0.5, 0.8, 0.5] }}
            transition={{ repeat: Infinity, duration: 4, ease: "easeInOut" }}
          />

          {/* Eye Shape Sclera - Saffron Top */}
          <path d="M 50,200 Q 200,80 350,200 Z" fill="#FF9933" />
          
          {/* Eye Shape Sclera - Green Bottom */}
          <path d="M 50,200 Q 200,320 350,200 Z" fill="#138808" />

          {/* Eye Shape Sclera - White Center Layer */}
          <path d="M 55,200 Q 200,100 345,200 Q 200,300 55,200 Z" fill="#FFFFFF" />

          {/* Eye Outline */}
          <path d="M 50,200 Q 200,80 350,200 Q 200,320 50,200 Z" fill="none" stroke="#fff" strokeWidth="4" />

          {/* Iris (Ashok Chakra Blue base) */}
          <circle cx="200" cy="200" r="40" fill="#000080" />
          
          {/* Iris White Inner */}
          <circle cx="200" cy="200" r="35" fill="#FFFFFF" />
          
          {/* Rotating Ashok Chakra Spokes & Hub */}
          <motion.g
            animate={{ rotate: 360 }}
            transition={{ repeat: Infinity, duration: 20, ease: "linear" }}
            style={{ originX: "200px", originY: "200px" }}
          >
            {spokes}
            <circle cx="200" cy="200" r="8" fill="#000080" />
            <circle cx="200" cy="200" r="35" fill="none" stroke="#000080" strokeWidth="3" />
            
            {/* 24 inner dots */}
            {Array.from({ length: 24 }).map((_, i) => (
              <circle
                key={`dot-${i}`}
                cx="200" cy="168" r="1.5"
                fill="#000080"
                transform={`rotate(${i * 15 + 7.5} 200 200)`}
              />
            ))}
          </motion.g>

          {/* Pupil Glow */}
          <circle cx="200" cy="200" r="15" fill="#000080" />
          <circle cx="203" cy="197" r="4" fill="#FFFFFF" opacity="0.8" />
        </motion.g>

      </svg>
      
      {/* Top/Bottom Fade Gradients */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '150px', background: 'linear-gradient(to bottom, #090a0f, transparent)' }} />
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '150px', background: 'linear-gradient(to top, #090a0f, transparent)' }} />
    </div>
  );
};

export default AnimatedHeroArtwork;
