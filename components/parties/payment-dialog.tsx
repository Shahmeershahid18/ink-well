'use client'

import * as React from 'react'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { humanError } from '@/lib/utils'
import { today } from '@/lib/format'
import { PAYMENT_METHODS } from '@/lib/constants'
import { useRecordPayment, type PartyKind } from '@/lib/queries/parties'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface PaymentDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  kind: PartyKind
  partyId: string
  partyName: string
  /** Optional document this payment settles, so its paid amount moves too. */
  refTable?: 'purchases' | 'sales'
  refId?: string
  suggestedAmount?: number
}

export function PaymentDialog({
  open,
  onOpenChange,
  kind,
  partyId,
  partyName,
  refTable,
  refId,
  suggestedAmount,
}: PaymentDialogProps) {
  const record = useRecordPayment()
  const [amount, setAmount] = React.useState('')
  const [method, setMethod] = React.useState('cash')
  const [reference, setReference] = React.useState('')
  const [paidOn, setPaidOn] = React.useState(today())

  // Re-seed on the closed->open edge, during render rather than in an effect.
  const [wasOpen, setWasOpen] = React.useState(open)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) {
      setAmount(suggestedAmount && suggestedAmount > 0 ? String(suggestedAmount.toFixed(2)) : '')
      setMethod('cash')
      setReference('')
      setPaidOn(today())
    }
  }

  const value = Number(amount)
  const valid = Number.isFinite(value) && value > 0

  async function submit() {
    try {
      await record.mutateAsync({
        party_type: kind,
        party_id: partyId,
        amount: value,
        method,
        reference: reference || null,
        paid_on: paidOn,
        ref_table: refTable ?? null,
        ref_id: refId ?? null,
      })
      toast.success(kind === 'supplier' ? 'Payment sent' : 'Payment received')
      onOpenChange(false)
    } catch (error) {
      toast.error(humanError(error))
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {kind === 'supplier' ? 'Record payment to' : 'Record payment from'} {partyName}
          </DialogTitle>
          <DialogDescription>
            {refTable
              ? 'This will also update the paid amount on the document.'
              : 'Recorded against the account balance.'}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="pay-amount">Amount</Label>
            <Input
              id="pay-amount"
              type="number"
              step="0.01"
              min="0"
              autoFocus
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Method</Label>
              <Select value={method} onValueChange={setMethod}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAYMENT_METHODS.map((m) => (
                    <SelectItem key={m.value} value={m.value}>
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pay-date">Date</Label>
              <Input
                id="pay-date"
                type="date"
                value={paidOn}
                onChange={(e) => setPaidOn(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="pay-ref">Reference</Label>
            <Input
              id="pay-ref"
              placeholder="Cheque number, transfer ID"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={!valid || record.isPending}>
            {record.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Record payment
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
