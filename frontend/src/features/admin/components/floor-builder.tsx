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

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { WF_TABLE_LAYOUT, WF_LANDMARKS } from '@/features/waiter/data/seed'
import { Save, Plus, GripVertical } from 'lucide-react'
import { cn } from '@/lib/utils'

interface TableData {
  id: string
  number: number
  capacity: number
  x: number
  y: number
}

export function FloorBuilder() {
  const [tables, setTables] = useState<TableData[]>(() =>
    WF_TABLE_LAYOUT.map((t: { number: number, capacity: number, x: number, y: number }) => ({ ...t, id: `T${t.number}` }))
  )
  const [isSaving, setIsSaving] = useState(false)

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(KeyboardSensor)
  )

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, delta } = event
    if (!delta.x && !delta.y) return

    setTables((prev: TableData[]) =>
      prev.map((t: TableData) => {
        if (t.id === active.id) {
          // Approximate pixel to percentage conversion based on typical container
          // You'd calculate the actual width/height of the container ideally
          // but for this mock, a simplistic scaling works.
          const parentWidth = window.innerWidth > 1280 ? 1100 : window.innerWidth - 100
          const parentHeight = 620
          
          const dxPct = (delta.x / parentWidth) * 100
          const dyPct = (delta.y / parentHeight) * 100
          
          return {
            ...t,
            x: Math.max(0, Math.min(100, t.x + dxPct)),
            y: Math.max(0, Math.min(100, t.y + dyPct)),
          }
        }
        return t
      })
    )
  }

  const handleSave = () => {
    setIsSaving(true)
    setTimeout(() => {
      setIsSaving(false)
      // Toast notification would go here in a real app
    }, 1000)
  }

  const handleAddTable = () => {
    const nextNum = Math.max(...tables.map((t: TableData) => t.number)) + 1
    setTables([
      ...tables,
      { id: `T${nextNum}`, number: nextNum, capacity: 4, x: 50, y: 50 },
    ])
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">Floor Plan Builder</h2>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleAddTable}>
            <Plus className="size-4" />
            Add Table
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            <Save className="size-4" />
            {isSaving ? 'Saving...' : 'Save Layout'}
          </Button>
        </div>
      </div>

      <DndContext
        sensors={sensors}
        modifiers={[restrictToParentElement]}
        onDragEnd={handleDragEnd}
      >
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
      <span className="mt-2 text-2xl font-bold leading-none tracking-tight tabular-nums text-zinc-800 dark:text-zinc-200">
        {table.number}
      </span>
      <span className="mt-1 text-[10px] font-bold text-zinc-500">
        CAP: {table.capacity}
      </span>
    </div>
  )
}
