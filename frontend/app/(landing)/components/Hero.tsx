"use client";
import { ThreeDMarquee } from "@/components/ui/3d-marquee";
import Header from "@/components/Header";
import { useMemo } from "react";
import { motion } from "motion/react";
import image1 from "@/public/1.png";
import image2 from "@/public/2.png";
import image3 from "@/public/3.png";
import image4 from "@/public/4.png";
import image5 from "@/public/5.png";
import image6 from "@/public/6.png";
import image7 from "@/public/7.png";
import image8 from "@/public/8.png";
import image9 from "@/public/9.png";
import image10 from "@/public/10.png";
import image11 from "@/public/11.png";
import image12 from "@/public/12.png";
import Link from "next/link";

export function Hero() {
  const baseImages = [
    image1, image2, image3, image4, image5, image6,
    image7, image8, image9, image10, image11, image12
  ];

  // Create a stable random arrangement using useMemo
  const randomImages = useMemo(() => {
    const repeated = [...baseImages, ...baseImages, ...baseImages];
    // Use a seeded random arrangement
    const arranged = repeated.map((item, index) => ({
      item,
      sort: Math.sin(index) // Using sin for deterministic "random" values
    }))
    .sort((a, b) => a.sort - b.sort)
    .map(({ item }) => item);
    
    return arranged;
  }, []); // Empty dependency array ensures this only runs once

  return (
    <div className="flex min-h-screen w-full flex-col items-center">
      <div className="relative flex flex-1 w-full flex-col items-center overflow-hidden">
       
        {/* Header */}
        <div className="sticky top-0 z-50 w-full">
          <div className="w-full bg-background/30 backdrop-blur-md border-b border-border/50 shadow-sm">
            <Header />
          </div>
        </div>
        
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="flex flex-1 w-full flex-col items-center justify-center px-4 relative z-20"
        >
          {/* Main content container */}
          <div className="relative mx-auto max-w-4xl rounded-2xl glass-effect p-8 md:p-12">
            <motion.h2 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.8 }}
              className="text-center text-3xl font-bold text-balance md:text-5xl lg:text-7xl"
            >
              Streamline Your ISP Operations with{" "}
              <span className="inline-block text-gradient-custom font-extrabold">
                Smart Management
              </span>
            </motion.h2>

            <motion.p 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4, duration: 0.8 }}
              className="text-center  text-lg mt-6 max-w-2xl mx-auto"
            >
              Manage your ISP business efficiently with our comprehensive platform. 
              From customer management to billing, we've got everything you need to 
              grow your business.
            </motion.p>

            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6, duration: 0.8 }}
              className="flex flex-wrap items-center justify-center gap-4 mt-8"
            >
              <Link href="/organizations" className="rounded-xl bg-gradient-custom px-8 py-4 text-base font-semibold text-white hover:text-white transition-all duration-300 hover:scale-105 hover:shadow-xl hover:shadow-primary/20 focus:ring-2 focus:ring-primary/50 focus:ring-offset-2 focus:ring-offset-background focus:outline-none">
                Get Started
              </Link>
              <Link href="/pricing" className="rounded-xl glass-effect px-8 py-4 text-base font-semibold text-foreground transition-all duration-300 hover:scale-105 hover:bg-accent hover:shadow-xl focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background focus:outline-none">
                Pricing
              </Link>
            </motion.div>
          </div>
        </motion.div>

        {/* Background elements */}
        <div className="absolute inset-0 z-0">
          <ThreeDMarquee
            className="pointer-events-none absolute inset-0 h-full w-full"
            images={randomImages.map((image) => image.src)}
          />
        </div>
      </div>
    </div>
  );
}
