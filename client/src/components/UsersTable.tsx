import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "./ui/alert-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "./ui/table";
import { Skeleton } from "./ui/skeleton";

interface User {
  id: string;
  name: string;
  email: string;
  role: "ADMIN" | "AGENT";
  createdAt: string;
}

export function UsersTable() {
  const { user: currentUser } = useAuth();
  const queryClient = useQueryClient();

  const {
    data: users = [],
    isLoading,
    error,
  } = useQuery<User[], Error>({
    queryKey: ["users"],
    queryFn: () => api.get<User[]>("/users"),
  });

  const deleteUser = useMutation({
    mutationFn: (id: string) => api.delete<void>(`/users/${id}`),
    onSuccess: (_data, id) => {
      queryClient.setQueryData<User[]>(["users"], (prev = []) =>
        prev.filter((u) => u.id !== id)
      );
    },
  });

  const errorMessage = error?.message ?? deleteUser.error?.message;

  return (
    <div className="space-y-4">
      {errorMessage && (
        <div className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-md px-4 py-3">
          {errorMessage}
        </div>
      )}

      <div className="rounded-md border bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Joined</TableHead>
              <TableHead className="w-20" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-48" /></TableCell>
                  <TableCell><Skeleton className="h-7 w-24 rounded-md" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                  <TableCell />
                </TableRow>
              ))
            ) : (
              <>
                {users.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={5}
                      className="text-center text-muted-foreground py-8"
                    >
                      No users found.
                    </TableCell>
                  </TableRow>
                )}
                {users.map((u) => {
                  const isSelf = u.id === currentUser?.id;
                  return (
                    <TableRow key={u.id}>
                      <TableCell className="font-medium">
                        {u.name}
                        {isSelf && (
                          <span className="ml-2 text-xs text-muted-foreground">
                            (you)
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {u.email}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={u.role === "ADMIN" ? "default" : "secondary"}
                        >
                          {u.role}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {new Date(u.createdAt).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        {!isSelf && (
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                disabled={
                                  deleteUser.isPending &&
                                  deleteUser.variables === u.id
                                }
                              >
                                {deleteUser.isPending &&
                                deleteUser.variables === u.id
                                  ? "Deleting…"
                                  : "Delete"}
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete user?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  This will permanently delete{" "}
                                  <strong>{u.name}</strong> ({u.email}) and all
                                  their session data. This action cannot be
                                  undone.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                  onClick={() => deleteUser.mutate(u.id)}
                                >
                                  Delete
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
