import { Badge } from "./ui/badge";
import ReplyForm from "./ReplyForm";
import UpdateTicket from "./UpdateTicket";
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
      {/* Left column — content */}
      <div className="space-y-6">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold leading-tight">{ticket.subject}</h1>
          <p className="text-sm text-muted-foreground">
            From {ticket.senderName} ({ticket.senderEmail})
          </p>
        </div>

        <div className="rounded-lg border bg-white p-5 space-y-1">
          <div className="flex items-center gap-2">
            <p className="font-semibold">Message</p>
            <Badge variant="secondary">Customer</Badge>
          </div>
          <p className="text-sm text-muted-foreground">From {ticket.senderName} · {formatDate(ticket.createdAt)}</p>
          <p className="text-sm pt-2 whitespace-pre-wrap">{ticket.body}</p>
        </div>

        {ticket.messages.length > 0 && (
          <div className="space-y-3">
            {ticket.messages.map((msg) => (
              <div
                key={msg.id}
                className={`rounded-lg border p-5 space-y-1 ${
                  msg.senderType === "AGENT" ? "bg-blue-50 border-blue-100" : "bg-white"
                }`}
              >
                <div className="flex items-center gap-2">
                  <p className="font-semibold">
                    {msg.senderType === "CUSTOMER" ? "Message" : "Reply"}
                  </p>
                  <Badge variant={msg.senderType === "AGENT" ? "default" : "secondary"}>
                    {msg.senderType === "AGENT" ? "Agent" : "Customer"}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  {msg.senderType === "CUSTOMER"
                    ? `From ${ticket.senderName} · ${formatDate(msg.createdAt)}`
                    : `From ${ticket.assignedTo?.name ?? "Agent"} · ${formatDate(msg.createdAt)}`}
                </p>
                <p className="text-sm pt-2 whitespace-pre-wrap">{msg.body}</p>
              </div>
            ))}
          </div>
        )}

        <ReplyForm ticketId={ticket.id} onSuccess={onReplySuccess} />
      </div>

      {/* Right column — sidebar */}
      <UpdateTicket
        ticket={ticket}
        agents={agents}
        onUpdate={onUpdate}
        isPending={isPending}
      />
    </div>
  );
}
