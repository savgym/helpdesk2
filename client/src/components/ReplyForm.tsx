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
    formState: { errors },
  } = useForm<CreateMessageInput>({
    resolver: zodResolver(createMessageSchema),
  });

  const { mutate, isPending, error } = useMutation({
    mutationFn: (data: CreateMessageInput) =>
      api.post<Message>(`/tickets/${ticketId}/messages`, data),
    onSuccess: (message) => {
      reset();
      onSuccess(message);
    },
  });

  return (
    <form
      onSubmit={handleSubmit((data) => mutate(data))}
      noValidate
      className="rounded-lg border bg-white p-5 space-y-3"
    >
      <p className="font-semibold">Reply</p>
      <Textarea
        {...register("body")}
        placeholder="Write your reply..."
        rows={4}
        disabled={isPending}
      />
      <ErrorMessage message={errors.body?.message} />
      {error && <ErrorMessage message={error.message} />}
      <div className="flex justify-end">
        <Button type="submit" disabled={isPending}>
          {isPending ? "Sending…" : "Send Reply"}
        </Button>
      </div>
    </form>
  );
}
