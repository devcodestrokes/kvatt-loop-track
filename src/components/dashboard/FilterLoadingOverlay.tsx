import { useEffect, useState } from 'react';

interface FilterLoadingOverlayProps {
  isLoading: boolean;
  message?: string;
}

export function FilterLoadingOverlay({ isLoading }: FilterLoadingOverlayProps) {
  const [progress, setProgress] = useState(0);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (isLoading) {
      setVisible(true);
      setProgress(0);
      
      // Animate progress like YouTube - fast start, then slows down
      const interval = setInterval(() => {
        setProgress(prev => {
          if (prev >= 90) {
            clearInterval(interval);
            return 90;
          }
          // Fast start, slow down as it approaches 90
          const increment = Math.max(0.5, (90 - prev) / 8);
          return Math.min(90, prev + increment);
        });
      }, 50);

      return () => clearInterval(interval);
    } else if (visible) {
      // Complete the progress bar quickly then fade out
      setProgress(100);
      const timeout = setTimeout(() => {
        setVisible(false);
        setProgress(0);
      }, 400);
      return () => clearTimeout(timeout);
    }
  }, [isLoading, visible]);

  if (!visible) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-[100] h-1">
      {/* Background track */}
      <div className="absolute inset-0 bg-primary/10" />
      
      {/* Progress bar with YouTube-style gradient and glow */}
      <div 
        className="absolute top-0 left-0 h-full bg-primary transition-all duration-150 ease-out"
        style={{ 
          width: `${progress}%`,
          boxShadow: '0 0 10px hsl(var(--primary)), 0 0 5px hsl(var(--primary))'
        }}
      >
        {/* Shimmer effect on the leading edge */}
        <div 
          className="absolute right-0 top-0 h-full w-24 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-pulse"
          style={{ 
            opacity: isLoading ? 1 : 0,
            transition: 'opacity 200ms'
          }}
        />
      </div>
    </div>
  );
}
