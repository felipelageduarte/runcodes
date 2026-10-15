import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { http, HttpResponse } from "msw";
import { server } from "../../test/msw/server";
import { Toaster } from "@runcodes/ui";
import { LoginPage } from "./LoginPage";

function renderLogin() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const router = createMemoryRouter(
    [
      { path: "/entrar", element: <LoginPage /> },
      { path: "/", element: <div>Painel do aluno</div> },
    ],
    { initialEntries: ["/entrar"] },
  );
  return render(
    <QueryClientProvider client={queryClient}>
      <Toaster />
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
}

describe("LoginPage", () => {
  it("renders the email and password fields", () => {
    renderLogin();
    expect(screen.getByLabelText("Email")).toBeInTheDocument();
    expect(screen.getByLabelText("Senha")).toBeInTheDocument();
  });

  it("shows a validation error without calling the API when fields are empty", async () => {
    renderLogin();
    await userEvent.click(screen.getByRole("button", { name: "Entrar" }));

    expect(await screen.findByText("Informe seu email")).toBeInTheDocument();
  });

  it("shows an error toast on invalid credentials", async () => {
    renderLogin();
    await userEvent.type(screen.getByLabelText("Email"), "a@x.com");
    await userEvent.type(screen.getByLabelText("Senha"), "wrong");
    await userEvent.click(screen.getByRole("button", { name: "Entrar" }));

    expect(await screen.findByText("Email ou senha incorretos")).toBeInTheDocument();
  });

  it("redirects to the dashboard after a successful login", async () => {
    renderLogin();
    await userEvent.type(screen.getByLabelText("Email"), "a@x.com");
    await userEvent.type(screen.getByLabelText("Senha"), "correct");
    await userEvent.click(screen.getByRole("button", { name: "Entrar" }));

    expect(await screen.findByText("Painel do aluno")).toBeInTheDocument();
  });

  it("offers to resend confirmation when the account isn't confirmed yet", async () => {
    server.use(
      http.post("/api/auth/login", () =>
        HttpResponse.json(
          { error: "Account email not confirmed yet", code: "account_not_confirmed" },
          { status: 403 },
        ),
      ),
    );
    renderLogin();
    await userEvent.type(screen.getByLabelText("Email"), "a@x.com");
    await userEvent.type(screen.getByLabelText("Senha"), "correct");
    await userEvent.click(screen.getByRole("button", { name: "Entrar" }));

    expect(await screen.findByText("Sua conta ainda não foi confirmada")).toBeInTheDocument();
  });
});
