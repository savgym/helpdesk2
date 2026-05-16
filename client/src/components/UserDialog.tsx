import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { Button } from "./ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { Input } from "./ui/input";
import { Label } from "./ui/label";

interface User {
  id: string;
  name: string;
  email: string;
  role: "ADMIN" | "AGENT";
  createdAt: string;
}

interface Props {
  user?: User;
  open: boolean;
  onClose: () => void;
}

type FormValues = { name: string; email: string; password: string };

// Password must be ≥ 8 chars or empty. Empty is only allowed in edit mode.
function makeSchema(isEdit: boolean) {
  return z.object({
    name: z.string().trim().min(3, "Name must be at least 3 characters"),
    email: z.email({ error: "A valid email is required" }),
    password: z
      .string()
      .min(8, "Password must be at least 8 characters")
      .or(z.literal(""))
      .refine((v) => isEdit || v !== "", "Password must be at least 8 characters"),
  });
}

export function UserDialog({ user, open, onClose }: Props) {
  const isEdit = Boolean(user);
  const queryClient = useQueryClient();

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(makeSchema(isEdit)),
    defaultValues: { name: user?.name ?? "", email: user?.email ?? "", password: "" },
  });

  const mutation = useMutation({
    mutationFn: (data: FormValues) => {
      if (isEdit) {
        return api.patch<User>(`/users/${user!.id}`, {
          name: data.name,
          email: data.email,
          password: data.password || undefined,
        });
      }
      return api.post<User>("/users", data);
    },
    onSuccess: (result) => {
      if (isEdit) {
        queryClient.setQueryData<User[]>(["users"], (prev = []) =>
          prev.map((u) => (u.id === result.id ? result : u))
        );
      } else {
        queryClient.setQueryData<User[]>(["users"], (prev = []) => [...prev, result]);
      }
      handleClose();
    },
    onError: (error) => {
      if (error.message.toLowerCase().includes("email")) {
        setError("email", { message: error.message });
      }
    },
  });

  function handleClose() {
    reset({ name: user?.name ?? "", email: user?.email ?? "", password: "" });
    mutation.reset();
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit user" : "Create new user"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit((data) => mutation.mutate(data))} noValidate>
          <div className="space-y-4 py-2">
            {mutation.error && !errors.email && (
              <p className="text-sm text-destructive">{mutation.error.message}</p>
            )}
            <div className="space-y-1">
              <Label htmlFor="user-name">Name</Label>
              <Input
                id="user-name"
                aria-invalid={!!errors.name}
                {...register("name")}
              />
              {errors.name && (
                <p className="text-xs text-destructive">{errors.name.message}</p>
              )}
            </div>
            <div className="space-y-1">
              <Label htmlFor="user-email">Email</Label>
              <Input
                id="user-email"
                type="email"
                autoComplete="off"
                aria-invalid={!!errors.email}
                {...register("email")}
              />
              {errors.email && (
                <p className="text-xs text-destructive">{errors.email.message}</p>
              )}
            </div>
            <div className="space-y-1">
              <Label htmlFor="user-password">Password</Label>
              <Input
                id="user-password"
                type="password"
                autoComplete="new-password"
                placeholder={isEdit ? "Leave blank to keep current password" : undefined}
                aria-invalid={!!errors.password}
                {...register("password")}
              />
              {errors.password && (
                <p className="text-xs text-destructive">{errors.password.message}</p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending
                ? (isEdit ? "Saving…" : "Creating…")
                : (isEdit ? "Save changes" : "Create user")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
