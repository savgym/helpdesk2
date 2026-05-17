import axios from "axios";

const client = axios.create({
  baseURL: "/api",
  withCredentials: true,
  headers: { "Content-Type": "application/json" },
});

client.interceptors.response.use(
  (res) => res,
  (err) => {
    const message =
      err.response?.data?.message ||
      err.response?.data?.error ||
      "Request failed";
    return Promise.reject(new Error(message));
  }
);

export const api = {
  get: <T>(path: string, params?: Record<string, string>) =>
    client.get<T>(path, { params }).then((r) => r.data),
  post: <T>(path: string, body: unknown) =>
    client.post<T>(path, body).then((r) => r.data),
  patch: <T>(path: string, body: unknown) =>
    client.patch<T>(path, body).then((r) => r.data),
  delete: <T>(path: string) => client.delete<T>(path).then((r) => r.data),
};
