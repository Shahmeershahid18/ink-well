'use client'

import * as React from 'react'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { humanError } from '@/lib/utils'
import { formatKg } from '@/lib/format'
import { useAdjustStock } from '@/lib/queries/materials'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

interface AdjustStockDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  itemType: 'raw' | 'ink'
  itemId: string
  itemName: string
  currentStockKg: number
}

export function AdjustStockDialog({
  open,
  onOpenChange,
  itemType,
  itemId,
  itemName,
  currentStockKg,
}: AdjustStockDialogProps) {
  const adjust = useAdjustStock()
  const [counted, setCounted] = React.useState('')
  const [reason, setReason] = React.useState('')

  // Seed on the closed->open edge, during render rather than in an effect.
  const [wasOpen, setWasOpen] = React.useState(open)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) {
      setCounted(String(currentStockKg))
      setReason('')
    }
  }

  const value = Number(counted)
  const valid = Number.isFinite(value) && value >= 0 && reason.trim().length > 0
  const diff = Number.isFinite(value) ? value - currentStockKg : 0

  async function submit() {
    try {
      await adjust.mutateAsync({
        item_type: itemType,
        item_id: itemId,
        new_qty: value,
        reason: reason.trim(),
      })
      toast.success(`Stock adjusted to ${formatKg(value)} kg`)
      onOpenChange(false)
    } catch (error) {
      toast.error(humanError(error))
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Adjust stock — {itemName}</DialogTitle>
          <DialogDescription>
            Enter what you actually counted. The difference is written to the ledger; the average
            cost is left alone.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>On record</Label>
              <div className="num flex h-9 items-center rounded-md border border-[var(--border)] bg-[var(--muted)] px-3 text-sm">
                {formatKg(currentStockKg)} kg
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="counted">Counted (kg)</Label>
              <Input
                id="counted"
                type="number"
                step="0.001"
                min="0"
                autoFocus
                value={counted}
                onChange={(e) => setCounted(e.target.value)}
              />
            </div>
          </div>

          {Math.abs(diff) > 0.0005 && (
            <Alert variant={diff < 0 ? 'danger' : 'ok'}>
              <AlertDescription>
                {diff > 0 ? 'Increase' : 'Decrease'} of{' '}
                <span className="num font-medium">{formatKg(Math.abs(diff))} kg</span> will be
                recorded as an adjustment.
              </AlertDescription>
            </Alert>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="reason">Reason *</Label>
            <Input
              id="reason"
              placeholder="Stock count 26 Aug, spillage, damaged drum"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={!valid || adjust.isPending}>
            {adjust.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Adjust stock
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
