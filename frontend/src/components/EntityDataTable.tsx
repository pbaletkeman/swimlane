/**
 * Generic data table with sorting, selection, pagination, and search powered by PrimeReact DataTable.
 */
import { useMemo, useState } from 'react'
import type { ChangeEvent, MouseEvent, ReactNode } from 'react'
import { Button } from 'primereact/button'
import { Checkbox } from 'primereact/checkbox'
import { DataTable } from 'primereact/datatable'
import { IconField } from 'primereact/iconfield'
import { InputText } from 'primereact/inputtext'
import { Skeleton } from 'primereact/skeleton'
import type { CheckboxRootChangeEvent } from '@primereact/types/primitive/checkbox'
import type {
  DataTablePaginationExposes,
  DataTableSelectionEvent,
  DataTableSelectionExposes,
} from '@primereact/types/primitive/datatable'

/** Describes a single column in the entity data table. */
export interface EntityDataTableColumn<T> {
  field: string
  header: string
  sortable?: boolean
  className?: string
  body?: (row: T) => ReactNode
}

/** Props for the EntityDataTable component. */
export interface EntityDataTableProps<T> {
  data: T[]
  columns: EntityDataTableColumn<T>[]
  dataKey: string
  loading?: boolean
  emptyMessage?: string
  searchableFields?: string[]
  searchPlaceholder?: string
  rowsPerPage?: number
  rowsPerPageOptions?: number[]
  defaultSortField?: string
  defaultSortOrder?: 1 | -1 | 0
  actions?: (row: T) => ReactNode
  actionsHeader?: string
  selectable?: boolean
  selectedKeys?: Record<string, boolean>
  onSelectionChange?: (keys: Record<string, boolean>) => void
}

/** Renders a searchable, sortable, paginated data table with optional row selection. */
export function EntityDataTable<T>({
  data,
  columns,
  dataKey,
  loading = false,
  emptyMessage = 'No records found.',
  searchableFields,
  searchPlaceholder = 'Search',
  rowsPerPage = 10,
  rowsPerPageOptions = [5, 10, 25, 50],
  defaultSortField,
  defaultSortOrder,
  actions,
  actionsHeader = '',
  selectable = false,
  selectedKeys,
  onSelectionChange,
}: EntityDataTableProps<T>) {
  const [globalFilter, setGlobalFilter] = useState('')

  const resolvedColumns = useMemo(() => {
    let resolved = columns
    if (selectable) {
      resolved = [
        { field: '__select', header: '', className: 'entity-datatable-select', body: () => null },
        ...resolved,
      ]
    }
    if (actions) {
      resolved = [...resolved, { field: '__actions', header: actionsHeader, body: (row: T) => actions(row) }]
    }
    return resolved
  }, [columns, actions, actionsHeader, selectable])

  const filterFields = useMemo(
    () => searchableFields ?? resolvedColumns.map((column) => column.field).filter((field) => field !== '__select'),
    [searchableFields, resolvedColumns],
  )

  return (
    <DataTable.Root
      data={data as object[]}
      dataKey={dataKey}
      loading={loading}
      paginator
      defaultRows={rowsPerPage}
      rowsPerPageOptions={rowsPerPageOptions}
      globalFilter={globalFilter}
      globalFilterFields={filterFields}
      defaultSortField={defaultSortField}
      defaultSortOrder={defaultSortOrder}
      removableSort
      stripedRows
      size="small"
      selectionMode={selectable ? 'multiple' : undefined}
      selectionKeys={selectable ? selectedKeys : undefined}
      onSelectionChange={
        selectable
          ? (event: DataTableSelectionEvent) => onSelectionChange?.(event.value)
          : undefined
      }
    >
      <DataTable.Header>
        <IconField.Root>
          <IconField.Inset>
            <i className="pi pi-search" />
          </IconField.Inset>
          <InputText
            value={globalFilter}
            onChange={(event: ChangeEvent<HTMLInputElement>) => setGlobalFilter(event.target.value)}
            placeholder={searchPlaceholder}
            aria-label="Search"
          />
        </IconField.Root>
      </DataTable.Header>
      <DataTable.TableContainer>
        <DataTable.Table>
          <DataTable.THead>
            <DataTable.THeadRow>
              {resolvedColumns.map((column) => (
                <DataTable.THeadCell key={column.field} className={column.className}>
                  {column.field === '__select' ? (
                    <DataTable.Selection>
                      {({ isAllSelected, isSomeSelected, toggleAll }: DataTableSelectionExposes) => (
                        <Checkbox.Root
                          checked={isAllSelected}
                          indeterminate={isSomeSelected}
                          aria-label="Select all rows"
                          onCheckedChange={(event: CheckboxRootChangeEvent) => toggleAll(event.originalEvent)}
                        />
                      )}
                    </DataTable.Selection>
                  ) : column.sortable ? (
                    <DataTable.Sort field={column.field}>
                      <span className="entity-datatable-sort-label">{column.header}</span>
                      <DataTable.SortIndicator match="asc">
                        <i className="pi pi-sort-up" />
                      </DataTable.SortIndicator>
                      <DataTable.SortIndicator match="desc">
                        <i className="pi pi-sort-down" />
                      </DataTable.SortIndicator>
                      <DataTable.SortIndicator match="unsorted">
                        <i className="pi pi-sort" />
                      </DataTable.SortIndicator>
                    </DataTable.Sort>
                  ) : (
                    column.header
                  )}
                </DataTable.THeadCell>
              ))}
            </DataTable.THeadRow>
          </DataTable.THead>
          <DataTable.TBody>
            {({ item, index }: { item: Record<string, unknown>; index: number }) => (
              <DataTable.Row
                style={index % 2 === 1 ? { background: 'color-mix(in srgb, var(--p-content-background) 92%, var(--p-text-muted-color) 8%)' } : undefined}
              >
                {resolvedColumns.map((column) => (
                  <DataTable.Cell key={column.field} className={column.className}>
                    {column.field === '__select' ? (
                      <DataTable.Selection>
                        {({ isSelected, toggle }: DataTableSelectionExposes) => (
                          <Checkbox.Root
                            checked={isSelected}
                            aria-label="Select row"
                            onCheckedChange={(event: CheckboxRootChangeEvent) => toggle(event.originalEvent)}
                          />
                        )}
                      </DataTable.Selection>
                    ) : column.body ? (
                      column.body(item as T)
                    ) : (
                      String(item[column.field] ?? '')
                    )}
                  </DataTable.Cell>
                ))}
              </DataTable.Row>
            )}
          </DataTable.TBody>
          <DataTable.EmptyTBody>
            <DataTable.Row>
              <DataTable.Cell colSpan={resolvedColumns.length} className="entity-datatable-empty">
                {emptyMessage}
              </DataTable.Cell>
            </DataTable.Row>
          </DataTable.EmptyTBody>
        </DataTable.Table>
      </DataTable.TableContainer>
      <DataTable.Loading>
        <div className="entity-datatable-loading">
          <div className="entity-datatable-loading-rows">
            {Array.from({ length: 5 }).map((_, rowIndex) => (
              <div className="entity-datatable-loading-row" key={rowIndex}>
                {resolvedColumns.map((column) => (
                  <Skeleton
                    key={column.field}
                    width="70%"
                    height="1rem"
                    borderRadius="0.375rem"
                    animation="wave"
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
      </DataTable.Loading>
      <DataTable.Pagination>
        {({
          page,
          pageCount,
          rows,
          totalRecords,
          canPrev,
          canNext,
          onPageChange,
          onRowsChange,
        }: DataTablePaginationExposes) => (
          <div className="entity-datatable-paginator">
            <span className="entity-datatable-paginator-total">
              {totalRecords} record{totalRecords === 1 ? '' : 's'}
            </span>
            <div className="entity-datatable-paginator-controls">
              <select
                aria-label="Rows per page"
                value={rows}
                onChange={(event: ChangeEvent<HTMLSelectElement>) => onRowsChange(event, Number(event.target.value))}
              >
                {rowsPerPageOptions.map((option) => (
                  <option key={option} value={option}>
                    {option} per page
                  </option>
                ))}
              </select>
              <Button
                type="button"
                variant="text"
                iconOnly
                disabled={!canPrev}
                aria-label="Previous page"
                onClick={(event: MouseEvent<HTMLButtonElement>) => onPageChange(event, page - 1)}
              >
                <i className="pi pi-chevron-left" />
              </Button>
              <span className="entity-datatable-paginator-page">
                {page + 1} / {pageCount}
              </span>
              <Button
                type="button"
                variant="text"
                iconOnly
                disabled={!canNext}
                aria-label="Next page"
                onClick={(event: MouseEvent<HTMLButtonElement>) => onPageChange(event, page + 1)}
              >
                <i className="pi pi-chevron-right" />
              </Button>
            </div>
          </div>
        )}
      </DataTable.Pagination>
    </DataTable.Root>
  )
}