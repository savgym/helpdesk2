import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  createColumnHelper,
  type SortingState,
} from "@tanstack/react-table";
import { ArrowUp, ArrowDown, ArrowUpDown } from "lucide-react";
import { api } from "../lib/api";
import { Badge } from "./ui/badge";
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

const STATUS_VARIANT: Record<TicketStatus, "default" | "secondary" | "outline"> = {
  OPEN: "default",
  RESOLVED: "secondary",
  CLOSED: "outline",
};

const CATEGORY_LABEL: Record<TicketCategory, string> = {
  GENERAL_QUESTION: "General",
  TECHNICAL_QUESTION: "Technical",
  REFUND_REQUEST: "Refund",
};

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
    cell: (info) => (
      <Badge variant={STATUS_VARIANT[info.getValue() as TicketStatus]}>
        {(info.getValue() as string).toLowerCase()}
      </Badge>
    ),
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

export function TicketsTable() {
  const [sorting, setSorting] = useState<SortingState>([
    { id: "createdAt", desc: true },
  ]);

  const sortBy = (sorting[0]?.id ?? "createdAt") as TicketSortBy;
  const sortOrder: TicketSortOrder = sorting[0]?.desc === false ? "asc" : "desc";

  const {
    data: tickets = [],
    isLoading,
    error,
  } = useQuery<Ticket[], Error>({
    queryKey: ["tickets", sortBy, sortOrder],
    queryFn: () => api.get<Ticket[]>("/tickets", { sortBy, sortOrder }),
  });

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

  return (
    <div className="space-y-4">
      {error && (
        <div className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-md px-4 py-3">
          {error.message}
        </div>
      )}

      <div className="rounded-md border bg-white">
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
                  No tickets yet.
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
      </div>
    </div>
  );
}
