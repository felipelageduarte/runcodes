import { describe, it, expect } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { http, HttpResponse } from "msw";
import { server } from "../../../test/msw/server";
import { useSession } from "./useSession";

function wrapper({ children }: { children: React.ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

describe("useSession", () => {
  it("resolves to unauthenticated on a 401 from /me (default handler)", async () => {
    const { result } = renderHook(() => useSession(), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.user).toBeNull();
  });

  it("resolves to authenticated when /me returns a user", async () => {
    server.use(
      http.get("/api/auth/me", () =>
        HttpResponse.json({ email: "a@x.com", name: "A", type: 0 }),
      ),
    );

    const { result } = renderHook(() => useSession(), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.user).toEqual({ email: "a@x.com", name: "A", type: 0 });
  });
});
