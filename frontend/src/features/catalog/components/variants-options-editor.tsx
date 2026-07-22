import { Plus, Trash2, Layers, CheckSquare } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { AdminMenuVariantDTO, AdminMenuOptionGroupDTO, AdminMenuOptionDTO } from '@/features/catalog/types'

interface VariantsOptionsEditorProps {
  variants: AdminMenuVariantDTO[]
  optionGroups: AdminMenuOptionGroupDTO[]
  onVariantsChange: (variants: AdminMenuVariantDTO[]) => void
  onOptionGroupsChange: (groups: AdminMenuOptionGroupDTO[]) => void
}

export function VariantsOptionsEditor({
  variants,
  optionGroups,
  onVariantsChange,
  onOptionGroupsChange,
}: VariantsOptionsEditorProps) {
  // --- Variants Handlers ---
  const handleAddVariant = () => {
    const newVariant: AdminMenuVariantDTO = {
      name: '',
      unit: '',
      price_vnd: 0,
      is_default: variants.length === 0,
      is_available: true,
      display_order: variants.length + 1,
    }
    onVariantsChange([...variants, newVariant])
  }

  const handleUpdateVariant = (index: number, patch: Partial<AdminMenuVariantDTO>) => {
    const updated = variants.map((v, i) => (i === index ? { ...v, ...patch } : v))
    onVariantsChange(updated)
  }

  const handleRemoveVariant = (index: number) => {
    onVariantsChange(variants.filter((_, i) => i !== index))
  }

  // --- Option Groups Handlers ---
  const handleAddOptionGroup = () => {
    const newGroup: AdminMenuOptionGroupDTO = {
      name: '',
      description: '',
      selection_type: 'SINGLE',
      is_required: false,
      min_selections: 0,
      max_selections: 1,
      display_order: optionGroups.length + 1,
      options: [
        {
          name: '',
          price_delta_vnd: 0,
          is_default: true,
          is_available: true,
          display_order: 1,
        },
      ],
    }
    onOptionGroupsChange([...optionGroups, newGroup])
  }

  const handleUpdateOptionGroup = (groupIndex: number, patch: Partial<AdminMenuOptionGroupDTO>) => {
    const updated = optionGroups.map((g, i) => (i === groupIndex ? { ...g, ...patch } : g))
    onOptionGroupsChange(updated)
  }

  const handleRemoveOptionGroup = (groupIndex: number) => {
    onOptionGroupsChange(optionGroups.filter((_, i) => i !== groupIndex))
  }

  // --- Option Items inside Group Handlers ---
  const handleAddOption = (groupIndex: number) => {
    const group = optionGroups[groupIndex]
    if (!group) return
    const newOption: AdminMenuOptionDTO = {
      name: '',
      price_delta_vnd: 0,
      is_default: false,
      is_available: true,
      display_order: (group.options?.length ?? 0) + 1,
    }
    handleUpdateOptionGroup(groupIndex, {
      options: [...(group.options ?? []), newOption],
    })
  }

  const handleUpdateOption = (groupIndex: number, optionIndex: number, patch: Partial<AdminMenuOptionDTO>) => {
    const group = optionGroups[groupIndex]
    if (!group) return
    const updatedOptions = (group.options ?? []).map((opt, i) =>
      i === optionIndex ? { ...opt, ...patch } : opt
    )
    handleUpdateOptionGroup(groupIndex, { options: updatedOptions })
  }

  const handleRemoveOption = (groupIndex: number, optionIndex: number) => {
    const group = optionGroups[groupIndex]
    if (!group) return
    const updatedOptions = (group.options ?? []).filter((_, i) => i !== optionIndex)
    handleUpdateOptionGroup(groupIndex, { options: updatedOptions })
  }

  return (
    <div className="space-y-6 pt-2">
      {/* ---------------- 1. BIẾN THỂ (VARIANTS: Size, Suất...) ---------------- */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers className="size-4 text-[var(--system-blue)]" />
            <h4 className="text-sm font-bold text-[var(--text)]">Biến thể món ăn (Size / Kích cỡ / Suất)</h4>
            <span className="text-xs text-[var(--text-tertiary)]">({variants.length})</span>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 rounded-xl text-xs font-semibold gap-1 text-[var(--system-blue)] border-[var(--system-blue)]/30 hover:bg-[var(--system-blue)]/10 cursor-pointer"
            onClick={handleAddVariant}
          >
            <Plus className="size-3.5" />
            Thêm biến thể
          </Button>
        </div>

        {variants.length === 0 ? (
          <div className="rounded-xl border border-dashed border-[var(--separator)] p-4 text-center text-xs text-[var(--text-tertiary)] bg-[var(--surface-grouped)]/40">
            Chưa có biến thể. Bấm "Thêm biến thể" nếu món có các Size hoặc Suất khác nhau (ví dụ: Nhỏ / Vừa / Lớn).
          </div>
        ) : (
          <div className="space-y-2">
            {variants.map((v, idx) => (
              <Card key={idx} className="p-3 bg-[var(--surface-grouped)] border-0 shadow-none rounded-xl">
                <div className="grid grid-cols-12 gap-2 items-center">
                  <div className="col-span-5 sm:col-span-4">
                    <Input
                      placeholder="Tên size (VD: Size L)"
                      value={v.name}
                      onChange={(e) => handleUpdateVariant(idx, { name: e.target.value })}
                      className="h-9 text-xs"
                    />
                  </div>
                  <div className="col-span-4 sm:col-span-4">
                    <Input
                      type="number"
                      min={0}
                      step={1000}
                      placeholder="Giá VND"
                      value={v.price_vnd}
                      onChange={(e) => handleUpdateVariant(idx, { price_vnd: Number(e.target.value) })}
                      className="h-9 text-xs font-mono"
                    />
                  </div>
                  <div className="col-span-2 sm:col-span-3 flex items-center gap-2">
                    <Input
                      placeholder="Đơn vị (đĩa/tô)"
                      value={v.unit ?? ''}
                      onChange={(e) => handleUpdateVariant(idx, { unit: e.target.value })}
                      className="h-9 text-xs hidden sm:block"
                    />
                  </div>
                  <div className="col-span-1 flex justify-end">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-8 text-zinc-400 hover:text-red-500 rounded-lg"
                      onClick={() => handleRemoveVariant(idx)}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* ---------------- 2. NHÓM TÙY CHỌN (OPTION GROUPS: Đường, Đá, Topping...) ---------------- */}
      <div className="space-y-3 pt-2 border-t border-[var(--separator)]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckSquare className="size-4 text-[var(--system-purple)]" />
            <h4 className="text-sm font-bold text-[var(--text)]">Nhóm Tùy chọn (Topping / Yêu cầu thêm)</h4>
            <span className="text-xs text-[var(--text-tertiary)]">({optionGroups.length})</span>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 rounded-xl text-xs font-semibold gap-1 text-[var(--system-purple)] border-[var(--system-purple)]/30 hover:bg-[var(--system-purple)]/10 cursor-pointer"
            onClick={handleAddOptionGroup}
          >
            <Plus className="size-3.5" />
            Thêm nhóm tùy chọn
          </Button>
        </div>

        {optionGroups.length === 0 ? (
          <div className="rounded-xl border border-dashed border-[var(--separator)] p-4 text-center text-xs text-[var(--text-tertiary)] bg-[var(--surface-grouped)]/40">
            Chưa có nhóm tùy chọn. Bấm "Thêm nhóm tùy chọn" để tạo yêu cầu kèm món (ví dụ: Mức đường, đá, topping thêm).
          </div>
        ) : (
          <div className="space-y-4">
            {optionGroups.map((group, gIdx) => (
              <Card key={gIdx} className="p-4 bg-[var(--surface-grouped)]/80 border border-[var(--separator)] rounded-2xl space-y-3">
                {/* Group Header Info */}
                <div className="grid grid-cols-12 gap-2 items-center">
                  <div className="col-span-6 sm:col-span-5">
                    <Input
                      placeholder="Tên nhóm (VD: Chọn Mức Đường)"
                      value={group.name}
                      onChange={(e) => handleUpdateOptionGroup(gIdx, { name: e.target.value })}
                      className="h-9 text-xs font-bold"
                    />
                  </div>
                  <div className="col-span-4 sm:col-span-4">
                    <Select
                      value={group.selection_type}
                      onValueChange={(val) => handleUpdateOptionGroup(gIdx, { selection_type: val || 'SINGLE' })}
                    >
                      <SelectTrigger className="h-9 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="SINGLE">Chọn 1 (Radio)</SelectItem>
                        <SelectItem value="MULTIPLE">Chọn nhiều (Checkbox)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="col-span-2 sm:col-span-3 flex justify-end items-center gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-8 text-zinc-400 hover:text-red-500 rounded-lg"
                      onClick={() => handleRemoveOptionGroup(gIdx)}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </div>

                {/* Sub-Options List inside Group */}
                <div className="pl-3 border-l-2 border-[var(--system-purple)]/30 space-y-2 pt-1">
                  <div className="flex items-center justify-between text-xs text-[var(--text-secondary)] font-medium">
                    <span>Danh sách tùy chọn con ({group.options?.length ?? 0}):</span>
                    <button
                      type="button"
                      onClick={() => handleAddOption(gIdx)}
                      className="text-[var(--system-blue)] hover:underline flex items-center gap-1 text-[11px] font-semibold cursor-pointer"
                    >
                      <Plus className="size-3" /> Thêm tùy chọn
                    </button>
                  </div>

                  {(group.options ?? []).map((opt, oIdx) => (
                    <div key={oIdx} className="grid grid-cols-12 gap-2 items-center">
                      <div className="col-span-6">
                        <Input
                          placeholder="Tên tùy chọn (VD: Trân châu phô mai)"
                          value={opt.name}
                          onChange={(e) => handleUpdateOption(gIdx, oIdx, { name: e.target.value })}
                          className="h-8 text-xs bg-white/80 dark:bg-zinc-900/80"
                        />
                      </div>
                      <div className="col-span-5">
                        <Input
                          type="number"
                          min={0}
                          step={1000}
                          placeholder="+ Phụ thu VND"
                          value={opt.price_delta_vnd}
                          onChange={(e) => handleUpdateOption(gIdx, oIdx, { price_delta_vnd: Number(e.target.value) })}
                          className="h-8 text-xs font-mono bg-white/80 dark:bg-zinc-900/80"
                        />
                      </div>
                      <div className="col-span-1 flex justify-end">
                        <button
                          type="button"
                          className="text-zinc-400 hover:text-red-500 p-1"
                          onClick={() => handleRemoveOption(gIdx, oIdx)}
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
