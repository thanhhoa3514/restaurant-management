import { useRef, useState } from 'react'
import { Loader2, Upload, X } from 'lucide-react'

import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { presignUpload } from '@/features/catalog/api'

interface ImageUploaderProps {
  value: string
  onChange: (url: string) => void
  disabled?: boolean
}

export function ImageUploader({ value, onChange, disabled }: ImageUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)

  const handleFile = async (file: File) => {
    if (!file.type.startsWith('image/')) return

    setUploading(true)
    try {
      const ext = file.name.substring(file.name.lastIndexOf('.')) || '.jpg'
      const result = await presignUpload(ext, file.type)

      const resp = await fetch(result.presigned_url, {
        method: 'PUT',
        body: file,
        headers: { 'Content-Type': file.type },
      })
      if (!resp.ok) throw new Error('Upload failed')

      onChange(result.public_url)
    } catch {
      toast.error('Tải ảnh thất bại')
    } finally {
      setUploading(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-start gap-4">
        {/* Preview */}
        <div className="relative size-24 shrink-0 overflow-hidden rounded-[18px] bg-[var(--surface-grouped)]">
          {value ? (
            <>
              <img src={value} alt="Preview" className="size-full object-cover" />
              {!disabled && (
                <button
                  type="button"
                  onClick={() => onChange('')}
                  className="absolute right-1 top-1 flex size-5 cursor-pointer items-center justify-center rounded-full bg-black/50 text-white hover:bg-black/70"
                >
                  <X className="size-3" />
                </button>
              )}
            </>
          ) : (
            <div className="flex size-full items-center justify-center text-[var(--text-tertiary)]">
              <Upload className="size-8" />
            </div>
          )}
        </div>

        {/* Upload button */}
        <div className="flex flex-col gap-2">
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) void handleFile(file)
            }}
            disabled={disabled || uploading}
          />
          <Button
            type="button"
            variant="secondary"
            className="rounded-[12px]"
            disabled={disabled || uploading}
            onClick={() => inputRef.current?.click()}
          >
            {uploading ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Đang tải...
              </>
            ) : (
              <>
                <Upload className="size-4" />
                Chọn ảnh
              </>
            )}
          </Button>
          <input
            type="text"
            placeholder="https://"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="w-full rounded-[10px] bg-[var(--surface-grouped)] px-3 py-2 text-sm text-[var(--text)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:ring-[3px] focus:ring-[var(--system-blue)]/18"
            disabled={disabled}
          />
        </div>
      </div>
    </div>
  )
}
