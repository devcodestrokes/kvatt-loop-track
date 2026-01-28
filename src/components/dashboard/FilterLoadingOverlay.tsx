import { useEffect, useState, useRef } from 'react';

interface FilterLoadingOverlayProps {
  isLoading: boolean;
  message?: string;
}

const MIN_DISPLAY_TIME = 600; // Minimum display time in ms so users can see the bar

export function FilterLoadingOverlay({ isLoading }: FilterLoadingOverlayProps) {
  const [progress, setProgress] = useState(0);
  const [visible, setVisible] = useState(false);
  const startTimeRef = useRef<number>(0);
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (isLoading) {
      setVisible(true);
      setProgress(0);
      startTimeRef.current = Date.now();
      
      // Clear any existing interval
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
      }
      
      // Animate progress like YouTube - fast start, then slows down
      progressIntervalRef.current = setInterval(() => {
        setProgress(prev => {
          if (prev >= 90) {
            if (progressIntervalRef.current) {
              clearInterval(progressIntervalRef.current);
            }
            return 90;
          }
          // Fast start, slow down as it approaches 90
          const increment = Math.max(0.5, (90 - prev) / 8);
          return Math.min(90, prev + increment);
        });
      }, 50);

      return () => {
        if (progressIntervalRef.current) {
          clearInterval(progressIntervalRef.current);
        }
      };
    } else if (visible) {
      // Clear the progress interval
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
      }
      
      // Ensure minimum display time before completing
      const elapsed = Date.now() - startTimeRef.current;
      const remainingTime = Math.max(0, MIN_DISPLAY_TIME - elapsed);
      
      // Quickly finish progress to 100%
      const finishTimeout = setTimeout(() => {
        setProgress(100);
        
        // Then fade out after animation completes
        const hideTimeout = setTimeout(() => {
          setVisible(false);
          setProgress(0);
        }, 300);
        
        return () => clearTimeout(hideTimeout);
      }, remainingTime);
      
      return () => clearTimeout(finishTimeout);
    }
  }, [isLoading, visible]);

  if (!visible) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-[9999] h-[3px]">
      {/* Background track - subtle */}
      <div className="absolute inset-0 bg-primary/20" />
      
      {/* Progress bar - YouTube-style with gradient and glow */}
      <div 
        className="absolute top-0 left-0 h-full transition-all duration-150 ease-out"
        style={{ 
          width: `${progress}%`,
          background: 'linear-gradient(90deg, hsl(var(--primary)) 0%, hsl(var(--primary)) 80%, hsl(var(--primary) / 0.8) 100%)',
          boxShadow: '0 0 12px 2px hsl(var(--primary) / 0.6), 0 0 4px 1px hsl(var(--primary) / 0.8)'
        }}
      >
        {/* Bright shimmer effect on the leading edge */}
        {isLoading && progress < 100 && (
          <div 
            className="absolute right-0 top-0 h-full w-20 overflow-hidden"
          >
            <div 
              className="h-full w-20"
              style={{
                background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.5), transparent)',
                animation: 'shimmer 0.8s infinite'
              }}
            />
          </div>
        )}
      </div>
      
      {/* Add shimmer keyframes */}
      <style>{`
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
      `}</style>
    </div>
  );
}
