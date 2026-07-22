import { type FC } from 'react'
import { Languages } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
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
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="ghost" size="icon" className={cn("rounded-full", className)} />
        }
      >
        <Languages className="h-[1.2rem] w-[1.2rem]" />
        <span className="sr-only">Toggle language</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => onLangChange('vi')}>
          Tiếng Việt {currentLang === 'vi' && "✓"}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onLangChange('en')}>
          English {currentLang === 'en' && "✓"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}


