
import React from 'react';

interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  color?: string; // Tailwind color class e.g., 'text-blue-500'
}

const Spinner: React.FC<SpinnerProps> = ({ size = 'md', color = 'text-sky-400' }) => {
  const sizeClasses = {
    sm: 'w-4 h-4 border-2',
    md: 'w-8 h-8 border-4',
    lg: 'w-12 h-12 border-[6px]',
  };

  return (
    <div className={`animate-spin rounded-full ${sizeClasses[size]} ${color} border-t-transparent`} role="status">
      <span className="sr-only">Loading...</span>
    </div>
  );
};

export default Spinner;
    