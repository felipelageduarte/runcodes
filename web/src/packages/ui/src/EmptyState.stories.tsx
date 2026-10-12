import type { Meta, StoryObj } from "@storybook/react-vite";
import { Inbox } from "lucide-react";
import { EmptyState } from "./EmptyState";
import { Button } from "./Button";

const meta: Meta<typeof EmptyState> = {
  title: "Design system/EmptyState",
  component: EmptyState,
};
export default meta;

type Story = StoryObj<typeof EmptyState>;

export const Default: Story = {
  args: {
    icon: <Inbox className="size-8" />,
    title: "Você ainda não entrou em nenhuma turma",
    description: "Peça o código de matrícula pro seu professor.",
    action: <Button size="sm">Entrar em turma</Button>,
  },
};

export const WithoutAction: Story = {
  args: { title: "Nenhum resultado encontrado" },
};
