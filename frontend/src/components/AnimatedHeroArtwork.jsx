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
        x: x * 20,
        y: y * 20,
        transition: { type: 'spring', stiffness: 50, damping: 20 }
      });
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, [eyeControls]);

  // Generate 24 spokes for Ashok Chakra (Centered at 500, 250)
  const spokes = Array.from({ length: 24 }).map((_, i) => (
    <line
      key={i}
      x1="500" y1="250" x2="500" y2="215"
      stroke="#000080" strokeWidth="2"
      transform={`rotate(${i * 15} 500 250)`}
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

      <svg width="100%" height="100%" viewBox="0 0 1000 500" preserveAspectRatio="xMidYMid slice" style={{ position: 'absolute', opacity: 0.25 }}>
        <defs>
          <radialGradient id="eyeGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="rgba(255, 255, 255, 0.4)" />
            <stop offset="100%" stopColor="rgba(255, 255, 255, 0)" />
          </radialGradient>
        </defs>

        {/* --- Left Hands (Corrupt forces) --- */}
        <motion.g
          initial={{ x: -50, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ duration: 3, ease: 'easeOut' }}
        >
          {/* Top Left Hand */}
          <motion.path
            d="M -50,150 C 150,150 200,200 350,220 C 320,240 250,220 150,250 C 80,260 0,200 -50,150 Z"
            fill="none"
            stroke="rgba(255, 255, 255, 0.5)"
            strokeWidth="1.5"
            animate={{
              d: [
                "M -50,150 C 150,150 200,200 350,220 C 320,240 250,220 150,250 C 80,260 0,200 -50,150 Z",
                "M -50,140 C 160,160 210,190 360,230 C 330,250 260,230 160,260 C 90,270 0,210 -50,140 Z",
                "M -50,150 C 150,150 200,200 350,220 C 320,240 250,220 150,250 C 80,260 0,200 -50,150 Z"
              ]
            }}
            transition={{ repeat: Infinity, duration: 6, ease: "easeInOut" }}
          />
          {/* Bottom Left Hand */}
          <motion.path
            d="M -50,400 C 120,400 180,350 350,300 C 330,320 230,360 140,420 C 60,450 0,420 -50,400 Z"
            fill="none"
            stroke="rgba(255, 255, 255, 0.3)"
            strokeWidth="1"
            animate={{
              d: [
                "M -50,400 C 120,400 180,350 350,300 C 330,320 230,360 140,420 C 60,450 0,420 -50,400 Z",
                "M -50,410 C 130,390 190,340 360,290 C 340,310 240,350 150,410 C 70,440 0,430 -50,410 Z",
                "M -50,400 C 120,400 180,350 350,300 C 330,320 230,360 140,420 C 60,450 0,420 -50,400 Z"
              ]
            }}
            transition={{ repeat: Infinity, duration: 8, ease: "easeInOut", delay: 1 }}
          />
        </motion.g>

        {/* --- Right Hands (Corrupt forces) --- */}
        <motion.g
          initial={{ x: 50, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ duration: 3, ease: 'easeOut', delay: 0.5 }}
        >
          {/* Top Right Hand */}
          <motion.path
            d="M 1050,150 C 850,150 800,200 650,220 C 680,240 750,220 850,250 C 920,260 1000,200 1050,150 Z"
            fill="none"
            stroke="rgba(255, 255, 255, 0.5)"
            strokeWidth="1.5"
            animate={{
              d: [
                "M 1050,150 C 850,150 800,200 650,220 C 680,240 750,220 850,250 C 920,260 1000,200 1050,150 Z",
                "M 1050,140 C 840,160 790,190 640,230 C 670,250 740,230 840,260 C 910,270 1000,210 1050,140 Z",
                "M 1050,150 C 850,150 800,200 650,220 C 680,240 750,220 850,250 C 920,260 1000,200 1050,150 Z"
              ]
            }}
            transition={{ repeat: Infinity, duration: 7, ease: "easeInOut", delay: 0.5 }}
          />
          {/* Bottom Right Hand */}
          <motion.path
            d="M 1050,400 C 880,400 820,350 650,300 C 670,320 770,360 860,420 C 940,450 1000,420 1050,400 Z"
            fill="none"
            stroke="rgba(255, 255, 255, 0.3)"
            strokeWidth="1"
            animate={{
              d: [
                "M 1050,400 C 880,400 820,350 650,300 C 670,320 770,360 860,420 C 940,450 1000,420 1050,400 Z",
                "M 1050,410 C 870,390 810,340 640,290 C 660,310 760,350 850,410 C 930,440 1000,430 1050,410 Z",
                "M 1050,400 C 880,400 820,350 650,300 C 670,320 770,360 860,420 C 940,450 1000,420 1050,400 Z"
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
        >
          {/* Pulsing Outer Glow */}
          <motion.circle
            cx="500" cy="250" r="180"
            fill="url(#eyeGlow)"
            animate={{ r: [160, 200, 160], opacity: [0.6, 1, 0.6] }}
            transition={{ repeat: Infinity, duration: 4, ease: "easeInOut" }}
          />

          {/* Eye Shape Sclera - Saffron Top */}
          <path d="M 320,250 Q 500,100 680,250 Z" fill="#FF9933" />
          
          {/* Eye Shape Sclera - Green Bottom */}
          <path d="M 320,250 Q 500,400 680,250 Z" fill="#138808" />

          {/* Eye Shape Sclera - White Center Layer */}
          <path d="M 325,250 Q 500,120 675,250 Q 500,380 325,250 Z" fill="#FFFFFF" />

          {/* Eye Outline */}
          <path d="M 320,250 Q 500,100 680,250 Q 500,400 320,250 Z" fill="none" stroke="#fff" strokeWidth="4" />

          {/* Iris (Ashok Chakra Blue base) */}
          <circle cx="500" cy="250" r="45" fill="#000080" />
          
          {/* Iris White Inner */}
          <circle cx="500" cy="250" r="40" fill="#FFFFFF" />
          
          {/* Rotating Ashok Chakra Spokes & Hub */}
          <motion.g
            animate={{ rotate: 360 }}
            transition={{ repeat: Infinity, duration: 20, ease: "linear" }}
            style={{ transformOrigin: "500px 250px" }}
          >
            {spokes}
            <circle cx="500" cy="250" r="8" fill="#000080" />
            <circle cx="500" cy="250" r="40" fill="none" stroke="#000080" strokeWidth="3" />
            
            {/* 24 inner dots */}
            {Array.from({ length: 24 }).map((_, i) => (
              <circle
                key={`dot-${i}`}
                cx="500" cy="214" r="2"
                fill="#000080"
                transform={`rotate(${i * 15 + 7.5} 500 250)`}
              />
            ))}
          </motion.g>

          {/* Pupil Glow */}
          <circle cx="500" cy="250" r="15" fill="#000080" />
          <circle cx="503" cy="247" r="4" fill="#FFFFFF" opacity="0.8" />
        </motion.g>

      </svg>
      
      {/* Top/Bottom Fade Gradients */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '150px', background: 'linear-gradient(to bottom, #090a0f, transparent)' }} />
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '150px', background: 'linear-gradient(to top, #090a0f, transparent)' }} />
    </div>
  );
};

export default AnimatedHeroArtwork;
