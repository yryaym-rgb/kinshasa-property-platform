import { useState, useMemo, type ReactNode } from 'react';
import { ChevronDown, ChevronUp, ChevronsUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from './Button';
import { LoadingSkeleton } from './LoadingSpinner';
import { EmptyState } from './EmptyState';
import type { DataTableColumn } from '@/types';

export interface DataTableProps<T extends Record<string, unknown>> {
  columns: DataTableColumn<T>[];
  data: T[];
  loading?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  selectable?: boolean;
  pageSize?: number;
  onRowClick?: (row: T) => void;
  getRowId?: (row: T) => string;
}

export function DataTable<T extends Record<string, unknown>>({
  columns,
  data,
  loading = false,
  emptyTitle = 'Aucune donnée',
  emptyDescription,
  selectable = false,
  pageSize = 10,
  onRowClick,
  getRowId,
}: DataTableProps<T>) {
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const sortedData = useMemo(() => {
    if (!sortKey) return data;
    return [...data].sort((a, b) => {
      const aVal = a[sortKey];
      const bVal = b[sortKey];
      if (aVal === bVal) return 0;
      const cmp = String(aVal) < String(bVal) ? -1 : 1;
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [data, sortKey, sortDir]);

  const paginatedData = sortedData.slice(page * pageSize, (page + 1) * pageSize);
  const totalPages = Math.ceil(sortedData.length / pageSize);

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <LoadingSkeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  if (data.length === 0) {
    return <EmptyState title={emptyTitle} description={emptyDescription} />;
  }

  return (
    <div>
      {/* Desktop table */}
      <div className="hidden overflow-x-auto rounded-lg border border-[var(--color-border)] md:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--color-border)] bg-[var(--color-muted)]">
              {selectable && <th className="w-10 p-3" />}
              {columns.map((col) => (
                <th key={String(col.key)} className={cn('p-3 text-left font-medium', col.className)}>
                  {col.sortable ? (
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 hover:text-[var(--color-primary)]"
                      onClick={() => handleSort(String(col.key))}
                    >
                      {col.header}
                      {sortKey === col.key ? (
                        sortDir === 'asc' ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronsUpDown className="h-4 w-4 opacity-50" />
                      )}
                    </button>
                  ) : (
                    col.header
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {paginatedData.map((row, idx) => {
              const rowId = getRowId?.(row) ?? String(idx);
              return (
                <tr
                  key={rowId}
                  className={cn(
                    'border-b border-[var(--color-border)] last:border-0',
                    onRowClick && 'cursor-pointer hover:bg-[var(--color-muted)]',
                  )}
                  onClick={() => onRowClick?.(row)}
                >
                  {selectable && (
                    <td className="p-3">
                      <input
                        type="checkbox"
                        checked={selected.has(rowId)}
                        onChange={() => toggleSelect(rowId)}
                        onClick={(e) => e.stopPropagation()}
                        aria-label={`Sélectionner la ligne ${idx + 1}`}
                      />
                    </td>
                  )}
                  {columns.map((col) => (
                    <td key={String(col.key)} className={cn('p-3', col.className)}>
                      {col.render
                        ? col.render(row)
                        : (row[String(col.key)] as ReactNode)}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="space-y-3 md:hidden">
        {paginatedData.map((row, idx) => {
          const rowId = getRowId?.(row) ?? String(idx);
          return (
            <div
              key={rowId}
              className={cn(
                'rounded-lg border border-[var(--color-border)] p-4',
                onRowClick && 'cursor-pointer active:bg-[var(--color-muted)]',
              )}
              onClick={() => onRowClick?.(row)}
            >
              {columns.map((col) => (
                <div key={String(col.key)} className="flex justify-between py-1">
                  <span className="text-[var(--color-muted-foreground)]">{col.header}</span>
                  <span className="font-medium">
                    {col.render ? col.render(row) : (row[String(col.key)] as ReactNode)}
                  </span>
                </div>
              ))}
            </div>
          );
        })}
      </div>

      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between">
          <span className="text-sm text-[var(--color-muted-foreground)]">
            Page {page + 1} sur {totalPages} ({sortedData.length} résultats)
          </span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
              Précédent
            </Button>
            <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage((p) => p + 1)}>
              Suivant
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
