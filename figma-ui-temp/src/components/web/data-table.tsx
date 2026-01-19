import * as React from "react"
import { ChevronUp, ChevronDown, MoreVertical } from "lucide-react"
import { cn } from "../ui/utils"

export interface DataTableColumn<T = any> {
  id: string
  header: string
  accessor?: keyof T | ((row: T) => React.ReactNode)
  sortable?: boolean
  width?: string
  align?: "left" | "center" | "right"
  render?: (value: any, row: T, index: number) => React.ReactNode
}

export interface DataTableAction<T = any> {
  id: string
  label: string
  icon?: React.ReactNode
  onClick: (row: T) => void
  variant?: "default" | "destructive"
}

export interface WebDataTableProps<T = any> {
  columns: DataTableColumn<T>[]
  data: T[]
  selectable?: boolean
  selectedRows?: Set<string>
  onSelectionChange?: (selectedIds: Set<string>) => void
  onRowClick?: (row: T, index: number) => void
  rowActions?: DataTableAction<T>[]
  keyField?: keyof T
  emptyState?: React.ReactNode
  className?: string
  rowClassName?: (row: T, index: number) => string
}

function WebDataTable<T = any>({
  columns,
  data,
  selectable = false,
  selectedRows = new Set(),
  onSelectionChange,
  onRowClick,
  rowActions,
  keyField = "id" as keyof T,
  emptyState,
  className,
  rowClassName,
}: WebDataTableProps<T>) {
  const [sortColumn, setSortColumn] = React.useState<string | null>(null)
  const [sortDirection, setSortDirection] = React.useState<"asc" | "desc">("asc")
  const [openActionMenu, setOpenActionMenu] = React.useState<string | null>(null)
  const [focusedRowIndex, setFocusedRowIndex] = React.useState<number>(-1)

  // Handle sort
  const handleSort = (columnId: string) => {
    if (sortColumn === columnId) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc")
    } else {
      setSortColumn(columnId)
      setSortDirection("asc")
    }
  }

  // Handle select all
  const handleSelectAll = () => {
    if (selectedRows.size === data.length) {
      onSelectionChange?.(new Set())
    } else {
      const allIds = new Set(data.map((row) => String(row[keyField])))
      onSelectionChange?.(allIds)
    }
  }

  // Handle select row
  const handleSelectRow = (row: T, event: React.MouseEvent) => {
    event.stopPropagation()
    const id = String(row[keyField])
    const newSelection = new Set(selectedRows)
    if (newSelection.has(id)) {
      newSelection.delete(id)
    } else {
      newSelection.add(id)
    }
    onSelectionChange?.(newSelection)
  }

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent, index: number) => {
    if (e.key === "ArrowDown") {
      e.preventDefault()
      setFocusedRowIndex(Math.min(index + 1, data.length - 1))
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      setFocusedRowIndex(Math.max(index - 1, 0))
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault()
      onRowClick?.(data[index], index)
    }
  }

  // Focus management
  React.useEffect(() => {
    if (focusedRowIndex >= 0) {
      const row = document.querySelector(`[data-row-index="${focusedRowIndex}"]`) as HTMLElement
      row?.focus()
    }
  }, [focusedRowIndex])

  const isAllSelected = data.length > 0 && selectedRows.size === data.length
  const isSomeSelected = selectedRows.size > 0 && selectedRows.size < data.length

  // Get cell value
  const getCellValue = (row: T, column: DataTableColumn<T>, index: number) => {
    if (column.render) {
      const value = typeof column.accessor === "function"
        ? column.accessor(row)
        : column.accessor
        ? row[column.accessor]
        : null
      return column.render(value, row, index)
    }
    if (typeof column.accessor === "function") {
      return column.accessor(row)
    }
    return column.accessor ? row[column.accessor] : null
  }

  return (
    <div className={cn("w-full", className)}>
      <div className="border border-border rounded-lg overflow-hidden bg-card">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-muted/50 border-b border-border">
              <tr>
                {selectable && (
                  <th className="w-12 px-4 py-3 text-left">
                    <input
                      type="checkbox"
                      checked={isAllSelected}
                      ref={(input) => {
                        if (input) input.indeterminate = isSomeSelected
                      }}
                      onChange={handleSelectAll}
                      className="rounded border-border"
                      aria-label="Select all rows"
                    />
                  </th>
                )}
                {columns.map((column) => (
                  <th
                    key={column.id}
                    className={cn(
                      "px-4 py-3 text-sm font-medium text-muted-foreground",
                      column.align === "center" && "text-center",
                      column.align === "right" && "text-right",
                      column.sortable && "cursor-pointer hover:text-foreground select-none"
                    )}
                    style={{ width: column.width }}
                    onClick={() => column.sortable && handleSort(column.id)}
                  >
                    <div className="flex items-center gap-2">
                      <span>{column.header}</span>
                      {column.sortable && (
                        <div className="flex flex-col">
                          <ChevronUp
                            className={cn(
                              "w-3 h-3 -mb-1",
                              sortColumn === column.id && sortDirection === "asc"
                                ? "text-foreground"
                                : "text-muted-foreground/50"
                            )}
                          />
                          <ChevronDown
                            className={cn(
                              "w-3 h-3",
                              sortColumn === column.id && sortDirection === "desc"
                                ? "text-foreground"
                                : "text-muted-foreground/50"
                            )}
                          />
                        </div>
                      )}
                    </div>
                  </th>
                ))}
                {rowActions && rowActions.length > 0 && (
                  <th className="w-12 px-4 py-3">
                    <span className="sr-only">Actions</span>
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {data.length === 0 ? (
                <tr>
                  <td colSpan={columns.length + (selectable ? 1 : 0) + (rowActions ? 1 : 0)}>
                    {emptyState || (
                      <div className="py-12 text-center text-muted-foreground">
                        No data available
                      </div>
                    )}
                  </td>
                </tr>
              ) : (
                data.map((row, index) => {
                  const rowId = String(row[keyField])
                  const isSelected = selectedRows.has(rowId)
                  const isFocused = focusedRowIndex === index

                  return (
                    <tr
                      key={rowId}
                      data-row-index={index}
                      tabIndex={0}
                      onClick={() => onRowClick?.(row, index)}
                      onKeyDown={(e) => handleKeyDown(e, index)}
                      className={cn(
                        "transition-colors",
                        onRowClick && "cursor-pointer hover:bg-accent/50",
                        isSelected && "bg-primary/5",
                        isFocused && "ring-2 ring-inset ring-ring",
                        rowClassName?.(row, index)
                      )}
                    >
                      {selectable && (
                        <td className="px-4 py-3">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={(e) => handleSelectRow(row, e as any)}
                            onClick={(e) => e.stopPropagation()}
                            className="rounded border-border"
                            aria-label={`Select row ${index + 1}`}
                          />
                        </td>
                      )}
                      {columns.map((column) => (
                        <td
                          key={column.id}
                          className={cn(
                            "px-4 py-3 text-sm",
                            column.align === "center" && "text-center",
                            column.align === "right" && "text-right"
                          )}
                        >
                          {getCellValue(row, column, index)}
                        </td>
                      ))}
                      {rowActions && rowActions.length > 0 && (
                        <td className="px-4 py-3">
                          <div className="relative">
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                setOpenActionMenu(openActionMenu === rowId ? null : rowId)
                              }}
                              className="p-1 hover:bg-accent rounded transition-colors"
                              aria-label="Open actions menu"
                            >
                              <MoreVertical className="w-4 h-4" />
                            </button>
                            {openActionMenu === rowId && (
                              <>
                                <div
                                  className="fixed inset-0 z-10"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    setOpenActionMenu(null)
                                  }}
                                />
                                <div className="absolute right-0 top-full mt-1 w-48 bg-popover border border-border rounded-lg shadow-[var(--elevation-3)] py-1 z-20">
                                  {rowActions.map((action) => (
                                    <button
                                      key={action.id}
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        action.onClick(row)
                                        setOpenActionMenu(null)
                                      }}
                                      className={cn(
                                        "w-full flex items-center gap-2 px-4 py-2 text-sm hover:bg-accent transition-colors text-left",
                                        action.variant === "destructive" && "text-destructive"
                                      )}
                                    >
                                      {action.icon}
                                      {action.label}
                                    </button>
                                  ))}
                                </div>
                              </>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Keyboard Navigation Hint */}
      {data.length > 0 && (
        <div className="mt-2 text-xs text-muted-foreground text-center">
          Use <kbd className="px-1.5 py-0.5 bg-muted rounded border border-border">↑</kbd>{" "}
          <kbd className="px-1.5 py-0.5 bg-muted rounded border border-border">↓</kbd> to navigate,{" "}
          <kbd className="px-1.5 py-0.5 bg-muted rounded border border-border">Enter</kbd> to open
        </div>
      )}
    </div>
  )
}

WebDataTable.displayName = "WebDataTable"

export { WebDataTable }
