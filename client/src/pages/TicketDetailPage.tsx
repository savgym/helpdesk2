import { useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import BackLink from "../components/BackLink";
import TicketDetailSkeleton from "../components/TicketDetailSkeleton";
import TicketDetail, {
  type Ticket,
  type Agent,
  type Message,
  type UpdateTicketPayload,
} from "../components/TicketDetail";

interface UpdateTicketResponse {
  id: number;
  status: Ticket["status"];
  category: Ticket["category"];
  assignedTo: Ticket["assignedTo"];
}

export default function TicketDetailPage() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();

  const { data: ticket, isLoading, error } = useQuery<Ticket, Error>({
    queryKey: ["ticket", id],
    queryFn: () => api.get<Ticket>(`/tickets/${id}`),
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
      queryClient.setQueryData<Ticket>(["ticket", id], (prev) =>
        prev
          ? { ...prev, status: updated.status, category: updated.category, assignedTo: updated.assignedTo }
          : prev
      );
    },
  });

  function handleReplySuccess(msg: Message) {
    queryClient.setQueryData<Ticket>(["ticket", id], (prev) =>
      prev ? { ...prev, messages: [...prev.messages, msg] } : prev
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <BackLink to="/tickets" label="Back to tickets" />

      {error && (
        <div className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-md px-4 py-3">
          {error.message}
        </div>
      )}

      {isLoading ? (
        <TicketDetailSkeleton />
      ) : ticket ? (
        <TicketDetail
          ticket={ticket}
          agents={agents}
          onUpdate={update}
          isPending={isPending}
          onReplySuccess={handleReplySuccess}
        />
      ) : null}
    </div>
  );
}
