import type { Meta, StoryObj } from "@storybook/react-vite";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "./Card";
import { Button } from "./Button";

const meta: Meta<typeof Card> = {
  title: "Design system/Card",
  component: Card,
};
export default meta;

type Story = StoryObj<typeof Card>;

export const Default: Story = {
  render: () => (
    <Card className="w-80">
      <CardHeader>
        <CardTitle>Lista de Exercícios</CardTitle>
        <CardDescription>MAC0101 — Introdução à Computação</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">3 exercícios abertos, 1 vencendo em 6h.</p>
      </CardContent>
      <CardFooter>
        <Button size="sm">Ver turma</Button>
      </CardFooter>
    </Card>
  ),
};
