import React from "react";
import { render } from "@testing-library/react";
import type { RenderOptions, RenderResult } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

export function renderWithQuery(
  ui: React.ReactElement,
  options?: Omit<RenderOptions, "wrapper">
): RenderResult {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>,
    options
  );
}
