import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  createColumnHelper,
  type SortingState,
} from "@tanstack/react-table";
import {
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  Search,
  X,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";
import { api } from "../lib/api";
import { STATUS_VARIANT, STATUS_LABEL, CATEGORY_LABEL } from "../lib/tickets";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import { Skeleton } from "./ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "./ui/table";
import type {
  TicketStatus,
  TicketCategory,
  TicketSortBy,
  TicketSortOrder,
} from "@helpdesk/core";

interface Ticket {
  id: number;
  subject: string;
  status: TicketStatus;
  category: TicketCategory | null;
  senderEmail: string;
  senderName: string;
  createdAt: string;
}

interface TicketsResponse {
  data: Ticket[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}


const ALL_STATUSES: TicketStatus[] = ["OPEN", "RESOLVED", "CLOSED"];
const ALL_CATEGORIES: Array<TicketCategory | "NONE"> = [
  "GENERAL_QUESTION",
  "TECHNICAL_QUESTION",
  "REFUND_REQUEST",
  "NONE",
];

function formatDate(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

const columnHelper = createColumnHelper<Ticket>();

const columns = [
  columnHelper.accessor("subject", {
    header: "Subject",
    cell: (info) => (
      <Link
        to={`/tickets/${info.row.original.id}`}
        className="hover:underline truncate block"
      >
        {info.getValue() as string}
      </Link>
    ),
  }),
  columnHelper.accessor("senderName", {
    header: "Sender",
    cell: (info) => (
      <div>
        <div className="text-sm">{info.getValue() as string}</div>
        <div className="text-xs text-muted-foreground">
          {info.row.original.senderEmail}
        </div>
      </div>
    ),
  }),
  columnHelper.accessor("status", {
    header: "Status",
    cell: (info) => {
      const status = info.getValue() as TicketStatus;
      const styles: Record<TicketStatus, { dot: string; badge: string }> = {
        OPEN:       { dot: "bg-pink-400",  badge: "bg-pink-50 text-pink-600 border-pink-200" },
        RESOLVED:   { dot: "bg-green-400", badge: "bg-green-50 text-green-700 border-green-200" },
        CLOSED:     { dot: "bg-gray-400",  badge: "bg-gray-100 text-gray-600 border-gray-200" },
        NEW:        { dot: "bg-blue-400",  badge: "bg-blue-50 text-blue-600 border-blue-200" },
        PROCESSING: { dot: "bg-amber-400", badge: "bg-amber-50 text-amber-700 border-amber-200" },
      };
      const s = styles[status];
      return (
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border ${s.badge}`}>
          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${s.dot}`} />
          {STATUS_LABEL[status]}
        </span>
      );
    },
  }),
  columnHelper.accessor("category", {
    header: "Category",
    cell: (info) => {
      const cat = info.getValue() as TicketCategory | null;
      return cat ? (
        <Badge variant="secondary">{CATEGORY_LABEL[cat]}</Badge>
      ) : (
        <span className="text-muted-foreground text-sm">—</span>
      );
    },
  }),
  columnHelper.accessor("createdAt", {
    header: "Created",
    cell: (info) => (
      <span className="text-sm text-muted-foreground whitespace-nowrap">
        {formatDate(info.getValue() as string)}
      </span>
    ),
  }),
];

function toggle<T>(arr: T[], value: T): T[] {
  return arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value];
}

export function TicketsTable() {
  const [sorting, setSorting] = useState<SortingState>([
    { id: "createdAt", desc: true },
  ]);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<TicketStatus[]>([]);
  const [categoryFilter, setCategoryFilter] = useState<Array<TicketCategory | "NONE">>([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const sortBy = (sorting[0]?.id ?? "createdAt") as TicketSortBy;
  const sortOrder: TicketSortOrder = sorting[0]?.desc === false ? "asc" : "desc";

  // Reset to page 1 whenever filters or sort changes
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, statusFilter, categoryFilter, sortBy, sortOrder]);

  const params: Record<string, string> = {
    sortBy,
    sortOrder,
    page: String(page),
    pageSize: String(pageSize),
  };
  if (debouncedSearch) params.search = debouncedSearch;
  if (statusFilter.length) params.status = statusFilter.join(",");
  if (categoryFilter.length) params.category = categoryFilter.join(",");

  const hasFilters = !!debouncedSearch || statusFilter.length > 0 || categoryFilter.length > 0;

  const { data: response, isLoading, error } = useQuery<TicketsResponse, Error>({
    queryKey: ["tickets", params],
    queryFn: () => api.get<TicketsResponse>("/tickets", params),
    placeholderData: keepPreviousData,
  });

  const tickets = response?.data ?? [];
  const total = response?.total ?? 0;
  const totalPages = response?.totalPages ?? 1;
  const rangeStart = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const rangeEnd = Math.min(page * pageSize, total);

  const table = useReactTable({
    data: tickets,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    manualSorting: true,
    enableSortingRemoval: false,
    sortDescFirst: false,
  });

  function clearFilters() {
    setSearch("");
    setStatusFilter([]);
    setCategoryFilter([]);
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-md px-4 py-3">
          {error.message}
        </div>
      )}

      {/* Filter bar */}
      <div className="space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by subject or sender…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Status</span>
            {ALL_STATUSES.map((s) => {
              const active = statusFilter.includes(s);
              return (
                <button
                  key={s}
                  onClick={() => setStatusFilter((prev) => toggle(prev, s))}
                  className={[
                    "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors border",
                    active
                      ? "bg-foreground text-background border-foreground"
                      : "bg-transparent text-muted-foreground border-border hover:border-foreground hover:text-foreground",
                  ].join(" ")}
                >
                  {STATUS_LABEL[s]}
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Category</span>
            {ALL_CATEGORIES.map((c) => {
              const active = categoryFilter.includes(c);
              const label = c === "NONE" ? "Uncategorized" : CATEGORY_LABEL[c];
              return (
                <button
                  key={c}
                  onClick={() => setCategoryFilter((prev) => toggle(prev, c))}
                  className={[
                    "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors border",
                    active
                      ? "bg-foreground text-background border-foreground"
                      : "bg-transparent text-muted-foreground border-border hover:border-foreground hover:text-foreground",
                  ].join(" ")}
                >
                  {label}
                </button>
              );
            })}
          </div>

          {hasFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearFilters}
              className="h-7 gap-1 text-muted-foreground hover:text-foreground ml-auto"
            >
              <X className="h-3.5 w-3.5" />
              Clear filters
            </Button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="rounded-md border bg-card">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead
                    key={header.id}
                    onClick={header.column.getToggleSortingHandler()}
                    className="cursor-pointer select-none"
                  >
                    <span className="inline-flex items-center gap-1">
                      {flexRender(
                        header.column.columnDef.header,
                        header.getContext()
                      )}
                      {header.column.getIsSorted() === "asc" && (
                        <ArrowUp
                          className="h-4 w-4"
                          data-testid={`sort-icon-${header.column.id}-asc`}
                        />
                      )}
                      {header.column.getIsSorted() === "desc" && (
                        <ArrowDown
                          className="h-4 w-4"
                          data-testid={`sort-icon-${header.column.id}-desc`}
                        />
                      )}
                      {!header.column.getIsSorted() && (
                        <ArrowUpDown
                          className="h-4 w-4 text-muted-foreground"
                          data-testid={`sort-icon-${header.column.id}-none`}
                        />
                      )}
                    </span>
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-4 w-56" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-40" /></TableCell>
                  <TableCell><Skeleton className="h-6 w-20 rounded-md" /></TableCell>
                  <TableCell><Skeleton className="h-6 w-20 rounded-md" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-28" /></TableCell>
                </TableRow>
              ))
            ) : tickets.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={5}
                  className="text-center text-muted-foreground py-8"
                >
                  {hasFilters ? "No tickets match the current filters." : "No tickets yet."}
                </TableCell>
              </TableRow>
            ) : (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell
                      key={cell.id}
                      className={
                        cell.column.id === "subject" ? "font-medium max-w-xs" : undefined
                      }
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>

        {/* Pagination footer */}
        <div className="flex items-center justify-between border-t px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Rows per page</span>
            <Select
              value={String(pageSize)}
              onValueChange={(v) => {
                setPageSize(Number(v));
                setPage(1);
              }}
            >
              <SelectTrigger className="h-8 w-20">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="10">10</SelectItem>
                <SelectItem value="20">20</SelectItem>
                <SelectItem value="50">50</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground">
              {total === 0
                ? "No results"
                : `${rangeStart}–${rangeEnd} of ${total}`}
            </span>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                aria-label="First page"
                onClick={() => setPage(1)}
                disabled={page <= 1}
              >
                <ChevronsLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                aria-label="Previous page"
                onClick={() => setPage((p) => p - 1)}
                disabled={page <= 1}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                aria-label="Next page"
                onClick={() => setPage((p) => p + 1)}
                disabled={page >= totalPages}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                aria-label="Last page"
                onClick={() => setPage(totalPages)}
                disabled={page >= totalPages}
              >
                <ChevronsRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
