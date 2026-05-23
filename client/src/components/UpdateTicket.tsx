import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import { STATUS_LABEL, CATEGORY_LABEL } from "../lib/tickets";
import type { TicketStatus, TicketCategory } from "@helpdesk/core";
import type { Ticket, Agent, UpdateTicketPayload } from "./TicketDetail";

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

interface Props {
  ticket: Pick<Ticket, "status" | "category" | "assignedTo" | "createdAt" | "updatedAt">;
  agents: Agent[];
  onUpdate: (payload: UpdateTicketPayload) => void;
  isPending: boolean;
}

export default function UpdateTicket({ ticket, agents, onUpdate, isPending }: Props) {
  return (
    <div className="space-y-5 rounded-lg border bg-card p-5">
      <SidebarField label="Status">
        <Select
          value={ticket.status}
          onValueChange={(val) => onUpdate({ status: val as TicketStatus })}
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
            onUpdate({ category: val === "none" ? null : (val as TicketCategory) })
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
            onUpdate({ assignedToId: val === "unassigned" ? null : val })
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
  );
}
