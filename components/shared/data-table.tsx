'use client'

import * as React from 'react'
import { ArrowDown, ArrowUp, ChevronsUpDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { TableSkeleton } from '@/components/ui/skeleton'

export interface Column<T> {
  key: string
  header: React.ReactNode
  /** Numeric columns are right-aligned and tabular by default. */
  align?: 'left' | 'right' | 'center'
  numeric?: boolean
  width?: string
  className?: string
  cell: (row: T, index: number) => React.ReactNode
  /** Return a comparable value to make the column sortable. */
  sortValue?: (row: T) => string | number | null | undefined
  /** Hide below the given breakpoint on narrow screens. */
  hideBelow?: 'sm' | 'md' | 'lg'
}

interface DataTableProps<T> {
  columns: Column<T>[]
  rows: T[] | undefined
  loading?: boolean
  rowKey: (row: T) => string
  onRowClick?: (row: T) => void
  empty?: React.ReactNode
  footer?: React.ReactNode
  /** Initial sort, e.g. { key: 'date', dir: 'desc' } */
  defaultSort?: { key: string; dir: 'asc' | 'desc' }
  className?: string
  rowClassName?: (row: T) => string | undefined
}

const hideClass = {
  sm: 'hidden sm:table-cell',
  md: 'hidden md:table-cell',
  lg: 'hidden lg:table-cell',
}

export function DataTable<T>({
  columns,
  rows,
  loading,
  rowKey,
  onRowClick,
  empty,
  footer,
  defaultSort,
  className,
  rowClassName,
}: DataTableProps<T>) {
  const [sort, setSort] = React.useState(defaultSort ?? null)

  const sorted = React.useMemo(() => {
    if (!rows) return rows
    if (!sort) return rows
    const col = columns.find((c) => c.key === sort.key)
    if (!col?.sortValue) return rows
    const copy = [...rows]
    copy.sort((a, b) => {
      const av = col.sortValue!(a)
      const bv = col.sortValue!(b)
      if (av == null && bv == null) return 0
      if (av == null) return 1
      if (bv == null) return -1
      const r = typeof av === 'number' && typeof bv === 'number'
        ? av - bv
        : String(av).localeCompare(String(bv))
      return sort.dir === 'asc' ? r : -r
    })
    return copy
  }, [rows, sort, columns])

  function toggleSort(col: Column<T>) {
    if (!col.sortValue) return
    setSort((s) =>
      s?.key === col.key
        ? { key: col.key, dir: s.dir === 'asc' ? 'desc' : 'asc' }
        : { key: col.key, dir: col.numeric ? 'desc' : 'asc' },
    )
  }

  if (loading) {
    return (
      <div className={cn('rounded-lg border border-[var(--border)] bg-[var(--card)]', className)}>
        <TableSkeleton cols={Math.min(columns.length, 6)} />
      </div>
    )
  }

  if (!sorted || sorted.length === 0) {
    return (
      <div className={cn('rounded-lg border border-[var(--border)] bg-[var(--card)]', className)}>
        {empty}
      </div>
    )
  }

  return (
    <div
      className={cn(
        'overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--card)]',
        className,
      )}
    >
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            {columns.map((col) => {
              const active = sort?.key === col.key
              return (
                <TableHead
                  key={col.key}
                  style={col.width ? { width: col.width } : undefined}
                  className={cn(
                    (col.align === 'right' || col.numeric) && 'text-right',
                    col.align === 'center' && 'text-center',
                    col.hideBelow && hideClass[col.hideBelow],
                    col.sortValue && 'cursor-pointer select-none hover:text-[var(--foreground)]',
                    col.className,
                  )}
                  onClick={() => toggleSort(col)}
                >
                  <span
                    className={cn(
                      'inline-flex items-center gap-1',
                      (col.align === 'right' || col.numeric) && 'flex-row-reverse',
                    )}
                  >
                    {col.header}
                    {col.sortValue &&
                      (active ? (
                        sort!.dir === 'asc' ? (
                          <ArrowUp className="h-3 w-3" />
                        ) : (
                          <ArrowDown className="h-3 w-3" />
                        )
                      ) : (
                        <ChevronsUpDown className="h-3 w-3 opacity-30" />
                      ))}
                  </span>
                </TableHead>
              )
            })}
          </TableRow>
        </TableHeader>

        <TableBody>
          {sorted.map((row, i) => (
            <TableRow
              key={rowKey(row)}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              className={cn(onRowClick && 'cursor-pointer', rowClassName?.(row))}
            >
              {columns.map((col) => (
                <TableCell
                  key={col.key}
                  className={cn(
                    col.numeric && 'num text-right',
                    col.align === 'right' && 'text-right',
                    col.align === 'center' && 'text-center',
                    col.hideBelow && hideClass[col.hideBelow],
                    col.className,
                  )}
                >
                  {col.cell(row, i)}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>

        {footer && <TableFooter>{footer}</TableFooter>}
      </Table>
    </div>
  )
}
