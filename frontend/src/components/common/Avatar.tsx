import { HTMLAttributes, forwardRef } from 'react'
import { clsx } from 'clsx'

export type AvatarSize = 'sm' | 'md' | 'lg' | 'xl'

interface AvatarProps extends HTMLAttributes<HTMLDivElement> {
  name: string
  src?: string
  size?: AvatarSize
  showOnline?: boolean
}

const sizeStyles: Record<AvatarSize, string> = {
  sm: 'w-8 h-8 text-sm',
  md: 'w-10 h-10 text-base',
  lg: 'w-12 h-12 text-base',
  xl: 'w-16 h-16 text-lg',
}

export const Avatar = forwardRef<HTMLDivElement, AvatarProps>(
  ({ className, name, src, size = 'md', showOnline, ...props }, ref) => {
    const initials = name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)

    return (
      <div
        ref={ref}
        className={clsx(
          'relative shrink-0 select-none',
          'rounded-full bg-gradient-to-br from-primary-400 to-primary-600',
          'flex items-center justify-center text-white font-semibold',
          sizeStyles[size],
          className
        )}
        {...props}
      >
        {src ? (
          <img
            src={src}
            alt={name}
            className="w-full h-full rounded-full object-cover"
          />
        ) : (
          initials
        )}

        {showOnline && (
          <span className="absolute bottom-0 right-0 w-3 h-3 bg-success-500 border-2 border-white rounded-full" />
        )}
      </div>
    )
  }
)

Avatar.displayName = 'Avatar'
