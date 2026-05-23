import { User, Bot } from "lucide-react";
import ReplyForm from "./ReplyForm";
import UpdateTicket from "./UpdateTicket";
import TicketSummary from "./TicketSummary";
import type { TicketStatus, TicketCategory } from "@helpdesk/core";

export interface Message {
  id: string;
  body: string;
  senderType: "CUSTOMER" | "AGENT";
  createdAt: string;
}

export interface Agent {
  id: string;
  name: string;
  email: string;
  role: "ADMIN" | "AGENT";
}

export interface Ticket {
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

export interface UpdateTicketPayload {
  status?: TicketStatus;
  category?: TicketCategory | null;
  assignedToId?: string | null;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString();
}

const STATUS_STYLES: Record<TicketStatus, { dot: string; badge: string; label: string }> = {
  OPEN:       { dot: "bg-pink-400",  badge: "bg-pink-50 text-pink-600 border-pink-200",       label: "Open" },
  RESOLVED:   { dot: "bg-green-400", badge: "bg-green-50 text-green-700 border-green-200",     label: "Resolved" },
  CLOSED:     { dot: "bg-gray-400",  badge: "bg-gray-100 text-gray-600 border-gray-200",       label: "Closed" },
  NEW:        { dot: "bg-blue-400",  badge: "bg-blue-50 text-blue-600 border-blue-200",        label: "New" },
  PROCESSING: { dot: "bg-amber-400", badge: "bg-amber-50 text-amber-700 border-amber-200",     label: "Processing" },
};

function StatusBadge({ status }: { status: TicketStatus }) {
  const s = STATUS_STYLES[status] ?? STATUS_STYLES.OPEN;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${s.badge}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
      {s.label}
    </span>
  );
}

function CustomerAvatar() {
  return (
    <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center shrink-0">
      <User className="h-4 w-4 text-muted-foreground" />
    </div>
  );
}

function AgentAvatar() {
  return (
    <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center shrink-0">
      <Bot className="h-4 w-4 text-primary-foreground" />
    </div>
  );
}

interface Props {
  ticket: Ticket;
  agents: Agent[];
  onUpdate: (payload: UpdateTicketPayload) => void;
  isPending: boolean;
  onReplySuccess: (message: Message) => void;
}

export default function TicketDetail({ ticket, agents, onUpdate, isPending, onReplySuccess }: Props) {
  return (
    <div className="grid grid-cols-[1fr_260px] gap-8 items-start">
      {/* Left column */}
      <div className="space-y-6">
        {/* Title + status badge */}
        <div className="space-y-1.5">
          <div className="flex items-start justify-between gap-4">
            <h1 className="text-2xl font-bold leading-tight">{ticket.subject}</h1>
            <StatusBadge status={ticket.status} />
          </div>
          <p className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">From:</span>{" "}
            {ticket.senderName} ({ticket.senderEmail})
            {"  ·  "}
            <span className="font-medium text-foreground">Created:</span>{" "}
            {formatDate(ticket.createdAt)}
            {"  ·  "}
            <span className="font-medium text-foreground">Updated:</span>{" "}
            {formatDate(ticket.updatedAt)}
          </p>
        </div>

        {/* Original message — no avatar, just body */}
        <div className="rounded-lg border bg-card p-5">
          <p className="text-sm whitespace-pre-wrap text-foreground">{ticket.body}</p>
        </div>

        <TicketSummary ticketId={ticket.id} />

        {/* Replies */}
        {ticket.messages.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-base font-semibold">Replies</h2>
            {ticket.messages.map((msg) => {
              const isAgent = msg.senderType === "AGENT";
              const senderName = isAgent
                ? (ticket.assignedTo?.name ?? "Agent")
                : ticket.senderName;
              return (
                <div
                  key={msg.id}
                  className={[
                    "rounded-lg border p-4 space-y-2",
                    isAgent ? "bg-primary/5 border-primary/20" : "bg-card",
                  ].join(" ")}
                >
                  <div className="flex items-center gap-2.5">
                    {isAgent ? <AgentAvatar /> : <CustomerAvatar />}
                    <div>
                      <p className="text-sm font-semibold leading-none">{senderName}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {isAgent ? "Agent" : "Customer"} · {formatDate(msg.createdAt)}
                      </p>
                    </div>
                  </div>
                  <p className="text-sm whitespace-pre-wrap text-foreground pl-[42px]">{msg.body}</p>
                </div>
              );
            })}
          </div>
        )}

        <ReplyForm ticketId={ticket.id} onSuccess={onReplySuccess} />
      </div>

      {/* Right sidebar */}
      <UpdateTicket
        ticket={ticket}
        agents={agents}
        onUpdate={onUpdate}
        isPending={isPending}
      />
    </div>
  );
}
