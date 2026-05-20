import { Sparkles } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { api } from "../lib/api";
import { Button } from "./ui/button";
import ErrorMessage from "./ErrorMessage";

interface Props {
  ticketId: number;
}

export default function TicketSummary({ ticketId }: Props) {
  const { mutate, isPending, data, error } = useMutation({
    mutationFn: () =>
      api.post<{ summary: string }>(`/tickets/${ticketId}/summarize`, {}),
  });

  return (
    <div className="space-y-3">
      <Button
        type="button"
        variant="outline"
        onClick={() => mutate()}
        disabled={isPending}
        className="gap-2"
      >
        <Sparkles className="h-4 w-4" />
        {isPending ? "Summarizing…" : data ? "Re-generate Summary" : "Summarize"}
      </Button>

      {error && <ErrorMessage message={error.message} />}

      {data && (
        <div className="rounded-lg border bg-violet-50 border-violet-100 p-5 space-y-1">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-violet-500" />
            <p className="font-semibold text-violet-900">AI Summary</p>
          </div>
          <p className="text-sm text-violet-800 pt-1">{data.summary}</p>
        </div>
      )}
    </div>
  );
}
