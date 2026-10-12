import type { Meta, StoryObj } from "@storybook/react-vite";
import { Badge } from "./Badge";

const meta: Meta<typeof Badge> = {
  title: "Design system/Badge",
  component: Badge,
};
export default meta;

type Story = StoryObj<typeof Badge>;

export const AllVariants: Story = {
  render: () => (
    <div className="flex gap-2">
      <Badge variant="neutral">Pendente</Badge>
      <Badge variant="primary">Professor</Badge>
      <Badge variant="success">Aprovado</Badge>
      <Badge variant="danger">Reprovado</Badge>
      <Badge variant="warning">Vence em 6h</Badge>
      <Badge variant="info">Novo</Badge>
    </div>
  ),
};
