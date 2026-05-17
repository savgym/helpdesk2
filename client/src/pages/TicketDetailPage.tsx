import { Link, useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { api } from "../lib/api";
import { STATUS_VARIANT } from "../lib/tickets";
import { Badge } from "../components/ui/badge";
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

const CATEGORY_LABEL: Record<TicketCategory, string> = {
  GENERAL_QUESTION: "general question",
  TECHNICAL_QUESTION: "technical question",
  REFUND_REQUEST: "refund request",
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleString();
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

  const { mutate: assign, isPending: isAssigning } = useMutation({
    mutationFn: (assignedToId: string | null) =>
      api.patch<{ id: number; assignedTo: TicketDetail["assignedTo"] }>(
        `/tickets/${id}`,
        { assignedToId }
      ),
    onSuccess: (updated) => {
      queryClient.setQueryData<TicketDetail>(["ticket", id], (prev) =>
        prev ? { ...prev, assignedTo: updated.assignedTo } : prev
      );
    },
  });

  return (
    <div className="max-w-3xl mx-auto space-y-6">
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
        <div className="space-y-4">
          <Skeleton className="h-8 w-2/3" />
          <Skeleton className="h-5 w-1/4" />
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-32 w-full rounded-md" />
        </div>
      ) : ticket ? (
        <>
          {/* Title + badges */}
          <div className="space-y-2">
            <h1 className="text-2xl font-bold leading-tight">{ticket.subject}</h1>
            <div className="flex items-center gap-2">
              <Badge variant={STATUS_VARIANT[ticket.status]} className="lowercase">
                {ticket.status.toLowerCase()}
              </Badge>
              {ticket.category && (
                <span className="text-sm text-muted-foreground">{CATEGORY_LABEL[ticket.category]}</span>
              )}
            </div>
          </div>

          {/* Meta */}
          <div className="grid grid-cols-2 gap-y-2 text-sm">
            <p>
              <span className="text-muted-foreground">From: </span>
              {ticket.senderName} ({ticket.senderEmail})
            </p>
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">Assigned to:</span>
              <Select
                value={ticket.assignedTo?.id ?? "unassigned"}
                onValueChange={(val) => assign(val === "unassigned" ? null : val)}
                disabled={isAssigning}
              >
                <SelectTrigger className="h-7 w-44 text-xs">
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
            </div>
            <p>
              <span className="text-muted-foreground">Created: </span>
              {formatDate(ticket.createdAt)}
            </p>
            <p>
              <span className="text-muted-foreground">Updated: </span>
              {formatDate(ticket.updatedAt)}
            </p>
          </div>

          {/* Original message */}
          <div className="rounded-lg border bg-white p-5 space-y-1">
            <p className="font-semibold">Message</p>
            <p className="text-sm text-muted-foreground">From {ticket.senderName}</p>
            <p className="text-sm pt-2 whitespace-pre-wrap">{ticket.body}</p>
          </div>

          {/* Thread */}
          {ticket.messages.length > 0 && (
            <div className="space-y-3">
              {ticket.messages.map((msg) => (
                <div key={msg.id} className="rounded-lg border bg-white p-5 space-y-1">
                  <p className="font-semibold">
                    {msg.senderType === "CUSTOMER" ? "Message" : "Agent reply"}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    From {msg.senderType === "CUSTOMER" ? ticket.senderName : "Agent"}
                  </p>
                  <p className="text-sm pt-2 whitespace-pre-wrap">{msg.body}</p>
                </div>
              ))}
            </div>
          )}
        </>
      ) : null}
    </div>
  );
}
