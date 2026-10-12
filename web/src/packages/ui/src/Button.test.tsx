import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Button } from "./Button";

describe("Button", () => {
  it("fires onClick when clicked", async () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Enviar</Button>);

    await userEvent.click(screen.getByRole("button", { name: "Enviar" }));

    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("is disabled and does not fire onClick while loading", async () => {
    const onClick = vi.fn();
    render(
      <Button onClick={onClick} loading>
        Enviar
      </Button>,
    );

    const button = screen.getByRole("button", { name: "Enviar" });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("aria-busy", "true");

    await userEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it("respects an explicit disabled prop independent of loading", () => {
    render(<Button disabled>Enviar</Button>);
    expect(screen.getByRole("button", { name: "Enviar" })).toBeDisabled();
  });

  it("renders asChild onto a single element child without Radix Slot's \"expected single child\" crash", () => {
    // Regression: Button used to always render `{loading && <Spinner/>}`
    // alongside children — with asChild, Slot received 2 children (the
    // `false` from a falsy `loading` plus the real one) and crashed with
    // "Slot failed to slot onto its children", found manually testing
    // the Google Calendar export link and every "Ir pro login" button.
    render(
      <Button asChild>
        <a href="https://example.com">Ir pro login</a>
      </Button>,
    );
    const link = screen.getByRole("link", { name: "Ir pro login" });
    expect(link).toBeInTheDocument();
    expect(link.tagName).toBe("A");
  });
});
