"use client";

import React from "react";
import { motion, TargetAndTransition, Transition } from "framer-motion";

export interface FadeInProps {
  children: React.ReactNode;
  delay?: number;
  duration?: number;
  direction?: "up" | "down" | "left" | "right" | "none";
  distance?: number;
  className?: string;
  viewportOnce?: boolean;
}

export default function FadeIn({
  children,
  delay = 0,
  duration = 0.75,
  direction = "up",
  distance = 24,
  className = "",
  viewportOnce = true,
}: FadeInProps) {
  const getInitialPosition = () => {
    switch (direction) {
      case "up":
        return { y: distance, x: 0, opacity: 0 };
      case "down":
        return { y: -distance, x: 0, opacity: 0 };
      case "left":
        return { x: distance, y: 0, opacity: 0 };
      case "right":
        return { x: -distance, y: 0, opacity: 0 };
      case "none":
      default:
        return { x: 0, y: 0, opacity: 0 };
    }
  };

  const targetState: TargetAndTransition = {
    x: 0,
    y: 0,
    opacity: 1,
  };

  const luxuryTransition: Transition = {
    duration,
    delay,
    ease: [0.22, 1, 0.36, 1], // Luxury cubic-bezier
  };

  return (
    <motion.div
      initial={getInitialPosition()}
      whileInView={targetState}
      viewport={{ once: viewportOnce, margin: "-40px" }}
      transition={luxuryTransition}
      className={className}
    >
      {children}
    </motion.div>
  );
}
