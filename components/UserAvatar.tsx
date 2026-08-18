import React, { useState, useEffect } from 'react';

interface UserAvatarProps {
  src?: string | null;
  name?: string | null;
  role?: string | null;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  className?: string;
  showStatus?: boolean;
  status?: 'Actif' | 'Inactif' | 'active' | 'inactive' | string;
  alt?: string;
}

const SIZE_CLASSES = {
  xs: 'w-6 h-6 text-[10px]',
  sm: 'w-8 h-8 text-xs',
  md: 'w-10 h-10 text-sm',
  lg: 'w-12 h-12 text-base',
  xl: 'w-16 h-16 text-xl',
  '2xl': 'w-24 h-24 text-2xl font-black'
};

const COLOR_PALETTES = [
  'bg-emerald-600 text-white',
  'bg-blue-600 text-white',
  'bg-indigo-600 text-white',
  'bg-purple-600 text-white',
  'bg-teal-600 text-white',
  'bg-amber-600 text-white',
  'bg-rose-600 text-white',
  'bg-sky-600 text-white',
  'bg-[#1F4A59] text-white',
];

export const UserAvatar: React.FC<UserAvatarProps> = ({
  src,
  name = 'Utilisateur',
  role,
  size = 'md',
  className = '',
  showStatus = false,
  status = 'Actif',
  alt
}) => {
  const [imageError, setImageError] = useState(false);

  useEffect(() => {
    setImageError(false);
  }, [src]);

  // Extract clean 2-letter initials
  const initials = (name || 'U')
    .trim()
    .split(/\s+/)
    .map(part => part.charAt(0).toUpperCase())
    .slice(0, 2)
    .join('') || 'U';

  // Deterministic color based on name hash
  const colorIndex = Math.abs(
    (name || 'User').split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)
  ) % COLOR_PALETTES.length;

  const bgPalette = COLOR_PALETTES[colorIndex];
  const sizeClass = SIZE_CLASSES[size] || SIZE_CLASSES.md;

  const isValidUrl = Boolean(
    src && 
    typeof src === 'string' && 
    src.trim().length > 0 && 
    !src.includes('placeholder.com') && 
    !src.includes('via.placeholder') &&
    !imageError
  );

  const isActive = status === 'Actif' || status === 'active';

  return (
    <div className={`relative inline-flex items-center justify-center shrink-0 ${className}`}>
      {isValidUrl ? (
        <img
          src={src!}
          alt={alt || name || 'Avatar'}
          onError={() => setImageError(true)}
          className={`${sizeClass} rounded-2xl object-cover border border-slate-200 dark:border-slate-700 shadow-2xs`}
        />
      ) : (
        <div
          className={`${sizeClass} ${bgPalette} rounded-2xl font-bold flex items-center justify-center border border-white/20 shadow-2xs select-none`}
        >
          <span>{initials}</span>
        </div>
      )}

      {showStatus && (
        <span
          className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white dark:border-slate-800 ${
            isActive ? 'bg-emerald-500' : 'bg-rose-500'
          }`}
          title={isActive ? 'Compte Actif' : 'Compte Inactif'}
        />
      )}
    </div>
  );
};

export default UserAvatar;
