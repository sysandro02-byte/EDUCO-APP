import React from 'react';

interface LoadingDotsProps {
  className?: string;
  dotClassName?: string;
}

export const LoadingDots: React.FC<LoadingDotsProps> = ({ className = '', dotClassName = 'w-1.5 h-1.5' }) => (
  <span className={`inline-flex items-center gap-1 ml-1.5 align-middle ${className}`}>
    <span className={`${dotClassName} rounded-full bg-current animate-bounce [animation-delay:-0.3s]`}></span>
    <span className={`${dotClassName} rounded-full bg-current animate-bounce [animation-delay:-0.15s]`}></span>
    <span className={`${dotClassName} rounded-full bg-current animate-bounce`}></span>
  </span>
);

export default LoadingDots;
