import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAuth } from "../context/AuthContext";

const schema = z.object({
  email: z.string().email({ message: "Enter a valid email address" }),
  password: z.string().min(1, "Password is required"),
});

type FormData = z.infer<typeof schema>;

export default function LoginPage() {
  const { user, isLoading, login } = useAuth();
  const navigate = useNavigate();
  const [serverError, setServerError] = useState("");

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  if (!isLoading && user) {
    return <Navigate to="/dashboard" replace />;
  }

  const onSubmit = async (data: FormData) => {
    setServerError("");
    try {
      await login(data.email, data.password);
      navigate("/dashboard");
    } catch (err) {
      setServerError(err instanceof Error ? err.message : "Login failed");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-full max-w-sm p-8 bg-white rounded-lg shadow">
        <h1 className="text-2xl font-bold text-gray-900">Helpdesk</h1>
        <p className="text-sm text-gray-500 mt-1 mb-6">Sign in to your account</p>
        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          {serverError && (
            <div className="mb-4 px-3 py-2 rounded border border-red-300 bg-red-50 text-sm text-red-700">
              {serverError}
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700" htmlFor="email">
              Email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="admin@example.com"
              {...register("email")}
              className={`mt-1 block w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 ${errors.email ? "border-red-500 focus:ring-red-500" : "border-gray-300 focus:ring-gray-800"}`}
            />
            {errors.email && (
              <p className="mt-1 text-xs text-red-600">{errors.email.message}</p>
            )}
          </div>
          <div className="mt-4">
            <label className="block text-sm font-medium text-gray-700" htmlFor="password">
              Password
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              placeholder="Enter your password"
              {...register("password")}
              className={`mt-1 block w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 ${errors.password ? "border-red-500 focus:ring-red-500" : "border-gray-300 focus:ring-gray-800"}`}
            />
            {errors.password && (
              <p className="mt-1 text-xs text-red-600">{errors.password.message}</p>
            )}
          </div>
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full mt-6 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white py-2 rounded-md text-sm font-medium"
          >
            {isSubmitting ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </div>
    </div>
  );
}
