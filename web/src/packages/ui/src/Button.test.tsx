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
});
