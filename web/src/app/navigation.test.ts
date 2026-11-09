import { describe, it, expect } from "vitest";
import { ADMIN_PERMISSIONS, UserType } from "@runcodes/shared";
import { NAV_SECTIONS, navItemMinType, visibleNavSections } from "./navigation";

describe("navigation lê o catálogo de permissões", () => {
  const adminItems = NAV_SECTIONS.find((s) => s.id === "admin")!.items;

  it("todo item da seção Administração declara permissão do catálogo ou minType explícito", () => {
    for (const item of adminItems) {
      if (item.permission === undefined) {
        // Tela cuja API faz gate por papel no service (tickets, avisos), não pelo catálogo.
        expect(item.minType, item.to).toBeGreaterThanOrEqual(UserType.ADMIN);
        continue;
      }
      expect(item.permission in ADMIN_PERMISSIONS, item.permission).toBe(true);
      expect(navItemMinType(item)).toBe(ADMIN_PERMISSIONS[item.permission]);
    }
  });

  it("professor não vê a seção admin; admin vê todos os itens", () => {
    expect(visibleNavSections(UserType.PROFESSOR).some((s) => s.id === "admin")).toBe(false);
    const admin = visibleNavSections(UserType.ADMIN).find((s) => s.id === "admin")!;
    expect(admin.items).toHaveLength(adminItems.length);
    expect(visibleNavSections(undefined).flatMap((s) => s.items).map((i) => i.to)).toEqual(["/"]);
  });
});
