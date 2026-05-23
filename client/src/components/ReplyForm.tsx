import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { api } from "../lib/api";
import { createMessageSchema, type CreateMessageInput } from "@helpdesk/core";
import { Textarea } from "./ui/textarea";
import { Button } from "./ui/button";
import ErrorMessage from "./ErrorMessage";

interface Message {
  id: string;
  body: string;
  senderType: "CUSTOMER" | "AGENT";
  createdAt: string;
}

interface Props {
  ticketId: number;
  onSuccess: (message: Message) => void;
}

export default function ReplyForm({ ticketId, onSuccess }: Props) {
  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<CreateMessageInput>({
    resolver: zodResolver(createMessageSchema),
  });

  const draft = watch("body");

  const { mutate, isPending, error } = useMutation({
    mutationFn: (data: CreateMessageInput) =>
      api.post<Message>(`/tickets/${ticketId}/messages`, data),
    onSuccess: (message) => {
      reset();
      onSuccess(message);
    },
  });

  const { mutate: polish, isPending: isPolishing, error: polishError } = useMutation({
    mutationFn: () =>
      api.post<{ polished: string }>(`/tickets/${ticketId}/polish`, { draft }),
    onSuccess: ({ polished }) => {
      setValue("body", polished, { shouldValidate: true });
    },
  });

  return (
    <form
      onSubmit={handleSubmit((data) => mutate(data))}
      noValidate
      className="rounded-lg border bg-card p-5 space-y-3"
    >
      <p className="font-semibold">Reply</p>
      <Textarea
        {...register("body")}
        placeholder="Write your reply..."
        rows={4}
        disabled={isPending || isPolishing}
      />
      <ErrorMessage message={errors.body?.message} />
      {error && <ErrorMessage message={error.message} />}
      {polishError && <ErrorMessage message={polishError.message} />}
      <div className="flex justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          disabled={isPolishing || isPending || !draft?.trim()}
          onClick={() => polish()}
        >
          {isPolishing ? "Polishing…" : "Polish"}
        </Button>
        <Button type="submit" disabled={isPending || isPolishing || !draft?.trim()}>
          {isPending ? "Sending…" : "Send Reply"}
        </Button>
      </div>
    </form>
  );
}
