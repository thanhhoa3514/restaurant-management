import { type FC, useMemo } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'

import { Button } from '@/components/ui/button'

export interface PaginationMeta {
  page: number
  page_size: number
  total_items: number
  total_pages: number
  has_next: boolean
  has_prev: boolean
}

interface PaginationProps {
  meta: PaginationMeta
  onPageChange: (page: number) => void
  lang?: 'vi' | 'en'
}

export const Pagination: FC<PaginationProps> = ({
  meta,
  onPageChange,
  lang = 'vi',
}) => {
  const { page, page_size, total_items, total_pages, has_next, has_prev } = meta

  // Calculate items range (e.g., Showing 1-20 of 145 items)
  const { from, to } = useMemo(() => {
    if (total_items === 0) return { from: 0, to: 0 }
    const start = (page - 1) * page_size + 1
    const end = Math.min(page * page_size, total_items)
    return { from: start, to: end }
  }, [page, page_size, total_items])

  // Advanced pagination number layout generation with ellipses (1 ... 9 10 11 ... 50)
  const pageNumbers = useMemo(() => {
    const pages: Array<number | '...'> = []

    if (total_pages <= 7) {
      for (let i = 1; i <= total_pages; i++) {
        pages.push(i)
      }
    } else {
      // Always show page 1
      pages.push(1)

      if (page > 3) {
        pages.push('...')
      }

      // Render middle pages surrounding the active page
      const start = Math.max(2, page - 1)
      const end = Math.min(total_pages - 1, page + 1)

      for (let i = start; i <= end; i++) {
        pages.push(i)
      }

      if (page < total_pages - 2) {
        pages.push('...')
      }

      // Always show the last page
      pages.push(total_pages)
    }

    return pages
  }, [page, total_pages])

  if (total_pages <= 1) return null

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 py-4 px-2 w-full border-t border-[var(--separator)]">
      {/* Range Info Label */}
      <div className="text-xs text-[var(--text-secondary)] font-medium">
        {lang === 'vi' ? (
          <>
            Hiển thị <span className="font-semibold text-[var(--text)] tabular-nums">{from} - {to}</span> trong số{' '}
            <span className="font-semibold text-[var(--text)] tabular-nums">{total_items}</span> mục
          </>
        ) : (
          <>
            Showing <span className="font-semibold text-[var(--text)] tabular-nums">{from} - {to}</span> of{' '}
            <span className="font-semibold text-[var(--text)] tabular-nums">{total_items}</span> items
          </>
        )}
      </div>

      {/* Pagination Controls */}
      <div className="flex items-center gap-1.5 shrink-0">
        {/* Previous Button */}
        <Button
          variant="outline"
          size="sm"
          className="rounded-[var(--radius-md)] h-9 px-3 text-xs gap-1 cursor-pointer"
          disabled={!has_prev}
          onClick={() => onPageChange(page - 1)}
        >
          <ChevronLeft size={12} />
          {lang === 'vi' ? 'Trước' : 'Prev'}
        </Button>

        {/* Page Numbers */}
        <div className="flex items-center gap-1">
          {pageNumbers.map((num, idx) => {
            if (num === '...') {
              return (
                <span
                  key={`ellipsis-${idx}`}
                  className="inline-flex size-9 items-center justify-center text-xs text-[var(--text-tertiary)] font-bold tabular-nums selection:bg-transparent select-none"
                >
                  &middot;&middot;&middot;
                </span>
              )
            }

            const isSelected = num === page

            return (
              <Button
                key={`page-${num}`}
                variant={isSelected ? 'default' : 'ghost'}
                size="sm"
                className={`size-9 rounded-[var(--radius-md)] p-0 text-xs font-semibold tabular-nums cursor-pointer ${
                  isSelected 
                    ? 'bg-[var(--system-blue)] text-white shadow-sm' 
                    : 'text-[var(--text-secondary)] hover:bg-[var(--surface-grouped)]'
                }`}
                onClick={() => onPageChange(num)}
              >
                {num}
              </Button>
            )
          })}
        </div>

        {/* Next Button */}
        <Button
          variant="outline"
          size="sm"
          className="rounded-[var(--radius-md)] h-9 px-3 text-xs gap-1 cursor-pointer"
          disabled={!has_next}
          onClick={() => onPageChange(page + 1)}
        >
          {lang === 'vi' ? 'Sau' : 'Next'}
          <ChevronRight size={12} />
        </Button>
      </div>
    </div>
  )
}

export default Pagination
