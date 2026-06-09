import { type FC } from 'react'
import { Languages } from 'lucide-react'
import { cn } from '@/lib/utils'

interface LanguageSwitcherProps {
  currentLang: 'vi' | 'en'
  onLangChange: (lang: 'vi' | 'en') => void
  className?: string
}

export const LanguageSwitcher: FC<LanguageSwitcherProps> = ({
  currentLang,
  onLangChange,
  className,
}) => {
  const isEn = currentLang === 'en'

  return (
    <div
      className={cn(
        'inline-flex h-9 items-center rounded-full border border-[var(--separator)] bg-[var(--surface-grouped)]/60 backdrop-blur-md p-1 shadow-sm transition-all duration-200 select-none relative',
        className
      )}
    >
      {/* Globe Icon */}
      <span className="flex size-7 items-center justify-center text-[var(--text-tertiary)] shrink-0 pl-1">
        <Languages size={15} />
      </span>

      {/* Button track */}
      <div className="flex items-center relative h-full">
        {/* Sliding Pill Capsule Background */}
        <div
          className={cn(
            'absolute top-0 bottom-0 w-[38px] rounded-full bg-white dark:bg-zinc-800 border border-zinc-200/10 shadow-xs transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]',
            isEn ? 'translate-x-[38px]' : 'translate-x-0'
          )}
        />

        {/* VI Button */}
        <button
          type="button"
          onClick={() => onLangChange('vi')}
          className={cn(
            'relative z-10 w-[38px] h-7 flex items-center justify-center text-[10px] font-extrabold tracking-wider transition-colors duration-300 cursor-pointer rounded-full outline-none',
            isEn ? 'text-[var(--text-secondary)] hover:text-[var(--text)]' : 'text-[var(--system-blue)] dark:text-white'
          )}
        >
          VI
        </button>

        {/* EN Button */}
        <button
          type="button"
          onClick={() => onLangChange('en')}
          className={cn(
            'relative z-10 w-[38px] h-7 flex items-center justify-center text-[10px] font-extrabold tracking-wider transition-colors duration-300 cursor-pointer rounded-full outline-none',
            isEn ? 'text-[var(--system-blue)] dark:text-white' : 'text-[var(--text-secondary)] hover:text-[var(--text)]'
          )}
        >
          EN
        </button>
      </div>
    </div>
  )
}


