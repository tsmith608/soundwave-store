"use client";

import React, { useRef, useState } from "react";
import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";

export interface MagneticFrameProps {
  children: React.ReactNode;
  className?: string;
  maxTilt?: number;
  enableGlare?: boolean;
}

export default function MagneticFrame({
  children,
  className = "",
  maxTilt = 7,
  enableGlare = true,
}: MagneticFrameProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isHovered, setIsHovered] = useState(false);

  // Raw mouse coordinates relative to element center (-0.5 to 0.5)
  const rawX = useMotionValue(0);
  const rawY = useMotionValue(0);

  // Smooth springs for rotation
  const springConfig = { stiffness: 200, damping: 22, mass: 0.5 };
  const smoothX = useSpring(rawX, springConfig);
  const smoothY = useSpring(rawY, springConfig);

  // Calculate 3D tilt
  const rotateX = useTransform(smoothY, [-0.5, 0.5], [`${maxTilt}deg`, `-${maxTilt}deg`]);
  const rotateY = useTransform(smoothX, [-0.5, 0.5], [`-${maxTilt}deg`, `${maxTilt}deg`]);

  // Lighting sheen coordinates for fine-art acrylic glass reflection
  const sheenX = useTransform(smoothX, [-0.5, 0.5], ["10%", "90%"]);
  const sheenY = useTransform(smoothY, [-0.5, 0.5], ["10%", "90%"]);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;
    if (width === 0 || height === 0) return;

    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    // Normalize to [-0.5, 0.5]
    rawX.set(mouseX / width - 0.5);
    rawY.set(mouseY / height - 0.5);
  };

  const handleMouseEnter = () => {
    setIsHovered(true);
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    rawX.set(0);
    rawY.set(0);
  };

  return (
    <div
      style={{ perspective: 1200 }}
      className="inline-block w-full"
    >
      <motion.div
        ref={containerRef}
        onMouseMove={handleMouseMove}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        style={{
          rotateX,
          rotateY,
          transformStyle: "preserve-3d",
        }}
        className={`relative transition-shadow duration-500 will-change-transform ${className}`}
      >
        {children}

        {/* Dynamic fine-art optical acrylic sheen / glare overlay */}
        {enableGlare && (
          <motion.div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 rounded-[inherit] transition-opacity duration-300 z-30"
            style={{
              opacity: isHovered ? 0.45 : 0,
              background: `radial-gradient(circle at ${sheenX.get()} ${sheenY.get()}, rgba(255,255,255,0.7) 0%, rgba(255,255,255,0.15) 30%, rgba(255,255,255,0) 65%)`,
            }}
          />
        )}
      </motion.div>
    </div>
  );
}
