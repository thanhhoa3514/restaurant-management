import { useState } from 'react'
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  useDraggable,
  type DragEndEvent,
} from '@dnd-kit/core'
import { restrictToParentElement } from '@dnd-kit/modifiers'

import { useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { saveTablePositions } from '@/features/dining/api'
import { WF_LANDMARKS } from '@/features/waiter/data/seed'
import { useStaffTables } from '@/features/waiter/queries/useStaffTables'
import { Save, GripVertical } from 'lucide-react'
import { cn } from '@/lib/utils'

interface TableData {
  id: string
  code: string
  capacity: number
  x: number
  y: number
}

export function FloorBuilder() {
  const { tables: dbTables, isLoading, isError, refetch } = useStaffTables()
  // ponytail: chỉ giữ toạ độ đã kéo trong state, phần còn lại đọc thẳng từ query
  // -> refetch 8s không ghi đè thao tác kéo, không phải đồng bộ hai nguồn.
  const [moved, setMoved] = useState<Record<string, { x: number; y: number }>>({})

  const tables: TableData[] = dbTables.map((t) => ({
    id: t.id,
    code: t.code,
    capacity: t.capacity,
    x: moved[t.id]?.x ?? t.position.x_pct,
    y: moved[t.id]?.y ?? t.position.y_pct,
  }))

  // ponytail: chỉ gửi bàn đã kéo, không gửi cả sơ đồ — bàn chưa đụng tới giữ nguyên toạ độ cũ
  const save = useMutation({
    mutationFn: () =>
      saveTablePositions(
        Object.entries(moved).map(([table_id, p]) => ({
          table_id,
          x: Math.round(p.x),
          y: Math.round(p.y),
        })),
      ),
    onSuccess: () => {
      setMoved({})
      refetch()
      toast.success('Đã lưu sơ đồ bàn')
    },
    onError: (err: Error) => toast.error(err.message || 'Lưu sơ đồ thất bại'),
  })

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(KeyboardSensor),
  )

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, delta } = event
    if (!delta.x && !delta.y) return

    const current = tables.find((t) => t.id === active.id)
    if (!current) return

    // Approximate pixel to percentage conversion based on typical container
    const parentWidth = window.innerWidth > 1280 ? 1100 : window.innerWidth - 100
    const parentHeight = 620

    const dxPct = (delta.x / parentWidth) * 100
    const dyPct = (delta.y / parentHeight) * 100

    setMoved((prev) => ({
      ...prev,
      [current.id]: {
        x: Math.max(0, Math.min(100, current.x + dxPct)),
        y: Math.max(0, Math.min(100, current.y + dyPct)),
      },
    }))
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">Sơ đồ bàn</h2>
          <p className="text-xs text-zinc-500">
            {isLoading
              ? 'Đang tải bàn…'
              : isError
                ? 'Không tải được danh sách bàn'
                : `${tables.length} bàn`}
          </p>
        </div>
        <Button
          disabled={Object.keys(moved).length === 0 || save.isPending}
          onClick={() => save.mutate()}
        >
          <Save className="size-4" />
          {save.isPending ? 'Đang lưu…' : 'Lưu sơ đồ'}
        </Button>
      </div>

      <DndContext sensors={sensors} modifiers={[restrictToParentElement]} onDragEnd={handleDragEnd}>
        <Card className="relative h-[620px] w-full overflow-hidden bg-zinc-50/70 p-0 shadow-inner dark:bg-zinc-950/40">
          <div
            className="pointer-events-none absolute inset-0 opacity-70"
            style={{
              backgroundImage:
                'linear-gradient(rgba(60,60,67,0.10) 1px, transparent 1px), linear-gradient(90deg, rgba(60,60,67,0.10) 1px, transparent 1px)',
              backgroundSize: '36px 36px',
            }}
          />
          <div className="pointer-events-none absolute -left-24 -top-24 size-72 rounded-full bg-blue-400/10 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-28 right-8 size-80 rounded-full bg-emerald-400/10 blur-3xl" />

          {WF_LANDMARKS.map((landmark) => (
            <div
              key={landmark.key}
              className="pointer-events-none absolute flex select-none items-center justify-center rounded-2xl border border-zinc-200/80 bg-white/80 text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-500 shadow-3xs dark:border-zinc-800/80 dark:bg-zinc-900/80 dark:text-zinc-400"
              style={{
                left: `${landmark.x}%`,
                top: `${landmark.y}%`,
                width: `${landmark.w}%`,
                height: `${landmark.h}%`,
              }}
            >
              {landmark.key.replace('landmark_', '')}
            </div>
          ))}

          {tables.map((t: TableData) => (
            <DraggableTable key={t.id} table={t} />
          ))}
        </Card>
      </DndContext>
    </div>
  )
}

function DraggableTable({ table }: { table: TableData }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: table.id,
  })

  // To support accurate percentage drops, we render exactly where it is.
  // We apply the transform from dnd-kit on top of the absolute % position.
  const style: React.CSSProperties = {
    left: `${table.x}%`,
    top: `${table.y}%`,
    transform: transform
      ? `translate(calc(-50% + ${transform.x}px), calc(-50% + ${transform.y}px))`
      : 'translate(-50%, -50%)',
    zIndex: isDragging ? 50 : 10,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'absolute flex h-20 w-20 flex-col items-center justify-center rounded-[22px] border-2 shadow-lg backdrop-blur-xl',
        isDragging
          ? 'scale-110 border-blue-500 bg-blue-50/90 shadow-xl dark:border-blue-400 dark:bg-blue-900/50'
          : 'border-zinc-300 bg-white/90 hover:border-blue-400 dark:border-zinc-700 dark:bg-zinc-800/90 cursor-grab',
      )}
      {...listeners}
      {...attributes}
    >
      <GripVertical className="absolute top-2 size-3 text-zinc-400 opacity-50" />
      <span className="mt-2 text-lg font-bold leading-none tracking-tight text-zinc-800 dark:text-zinc-200">
        {table.code}
      </span>
      <span className="mt-1 text-[10px] font-bold text-zinc-500">CAP: {table.capacity}</span>
    </div>
  )
}
