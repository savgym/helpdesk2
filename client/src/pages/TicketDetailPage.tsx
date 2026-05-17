import { Link, useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { api } from "../lib/api";
import { STATUS_LABEL, CATEGORY_LABEL } from "../lib/tickets";
import { Skeleton } from "../components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import type { TicketStatus, TicketCategory } from "@helpdesk/core";

interface Message {
  id: string;
  body: string;
  senderType: "CUSTOMER" | "AGENT";
  createdAt: string;
}

interface Agent {
  id: string;
  name: string;
  email: string;
  role: "ADMIN" | "AGENT";
}

interface TicketDetail {
  id: number;
  subject: string;
  body: string;
  status: TicketStatus;
  category: TicketCategory | null;
  senderEmail: string;
  senderName: string;
  createdAt: string;
  updatedAt: string;
  assignedTo: { id: string; name: string; email: string } | null;
  messages: Message[];
}

interface UpdateTicketPayload {
  status?: TicketStatus;
  category?: TicketCategory | null;
  assignedToId?: string | null;
}

interface UpdateTicketResponse {
  id: number;
  status: TicketStatus;
  category: TicketCategory | null;
  assignedTo: TicketDetail["assignedTo"];
}

const ALL_STATUSES: TicketStatus[] = ["OPEN", "RESOLVED", "CLOSED"];
const ALL_CATEGORIES: TicketCategory[] = [
  "GENERAL_QUESTION",
  "TECHNICAL_QUESTION",
  "REFUND_REQUEST",
];

function formatDate(iso: string) {
  return new Date(iso).toLocaleString();
}

function SidebarField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</p>
      {children}
    </div>
  );
}

export default function TicketDetailPage() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();

  const { data: ticket, isLoading, error } = useQuery<TicketDetail, Error>({
    queryKey: ["ticket", id],
    queryFn: () => api.get<TicketDetail>(`/tickets/${id}`),
    enabled: !!id,
  });

  const { data: agents = [] } = useQuery<Agent[], Error>({
    queryKey: ["users"],
    queryFn: () => api.get<Agent[]>("/users"),
  });

  const { mutate: update, isPending } = useMutation({
    mutationFn: (payload: UpdateTicketPayload) =>
      api.patch<UpdateTicketResponse>(`/tickets/${id}`, payload),
    onSuccess: (updated) => {
      queryClient.setQueryData<TicketDetail>(["ticket", id], (prev) =>
        prev
          ? { ...prev, status: updated.status, category: updated.category, assignedTo: updated.assignedTo }
          : prev
      );
    },
  });

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <Link
        to="/tickets"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to tickets
      </Link>

      {error && (
        <div className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-md px-4 py-3">
          {error.message}
        </div>
      )}

      {isLoading ? (
        <div className="grid grid-cols-[1fr_260px] gap-8">
          <div className="space-y-4">
            <Skeleton className="h-8 w-2/3" />
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-40 w-full rounded-md" />
          </div>
          <div className="space-y-6">
            <Skeleton className="h-16 w-full rounded-md" />
            <Skeleton className="h-16 w-full rounded-md" />
            <Skeleton className="h-16 w-full rounded-md" />
          </div>
        </div>
      ) : ticket ? (
        <div className="grid grid-cols-[1fr_260px] gap-8 items-start">
          {/* Left column — content */}
          <div className="space-y-6">
            <div className="space-y-1">
              <h1 className="text-2xl font-bold leading-tight">{ticket.subject}</h1>
              <p className="text-sm text-muted-foreground">
                From {ticket.senderName} ({ticket.senderEmail})
              </p>
            </div>

            <div className="rounded-lg border bg-white p-5 space-y-1">
              <p className="font-semibold">Message</p>
              <p className="text-sm text-muted-foreground">From {ticket.senderName}</p>
              <p className="text-sm pt-2 whitespace-pre-wrap">{ticket.body}</p>
            </div>

            {ticket.messages.length > 0 && (
              <div className="space-y-3">
                {ticket.messages.map((msg) => (
                  <div key={msg.id} className="rounded-lg border bg-white p-5 space-y-1">
                    <p className="font-semibold">
                      {msg.senderType === "CUSTOMER" ? "Message" : "Agent Reply"}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      From {msg.senderType === "CUSTOMER" ? ticket.senderName : "Agent"}
                    </p>
                    <p className="text-sm pt-2 whitespace-pre-wrap">{msg.body}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Right column — sidebar */}
          <div className="space-y-5 rounded-lg border bg-white p-5">
            <SidebarField label="Status">
              <Select
                value={ticket.status}
                onValueChange={(val) => update({ status: val as TicketStatus })}
                disabled={isPending}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ALL_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {STATUS_LABEL[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </SidebarField>

            <SidebarField label="Category">
              <Select
                value={ticket.category ?? "none"}
                onValueChange={(val) =>
                  update({ category: val === "none" ? null : (val as TicketCategory) })
                }
                disabled={isPending}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Uncategorized</SelectItem>
                  {ALL_CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {CATEGORY_LABEL[c]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </SidebarField>

            <SidebarField label="Assigned To">
              <Select
                value={ticket.assignedTo?.id ?? "unassigned"}
                onValueChange={(val) =>
                  update({ assignedToId: val === "unassigned" ? null : val })
                }
                disabled={isPending}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unassigned">Unassigned</SelectItem>
                  {agents.map((agent) => (
                    <SelectItem key={agent.id} value={agent.id}>
                      {agent.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </SidebarField>

            <div className="border-t pt-4 space-y-1 text-xs text-muted-foreground">
              <p><span className="font-medium">Created</span> {formatDate(ticket.createdAt)}</p>
              <p><span className="font-medium">Updated</span> {formatDate(ticket.updatedAt)}</p>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
