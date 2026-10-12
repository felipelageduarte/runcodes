import type { Meta, StoryObj } from "@storybook/react-vite";
import { Input } from "./Input";
import { FormField } from "./FormField";

const meta: Meta<typeof Input> = {
  title: "Design system/Input",
  component: Input,
};
export default meta;

type Story = StoryObj<typeof Input>;

export const Default: Story = { args: { placeholder: "aluno@usp.br" } };
export const Disabled: Story = { args: { disabled: true, value: "aluno@usp.br" } };
export const Invalid: Story = { args: { invalid: true, defaultValue: "não-é-um-email" } };

export const WithLabelAndError: Story = {
  render: () => (
    <FormField label="Email" htmlFor="story-email" error="Informe seu email">
      <Input id="story-email" invalid />
    </FormField>
  ),
};

export const WithHint: Story = {
  render: () => (
    <FormField label="Senha" htmlFor="story-password" hint="Mínimo de 8 caracteres">
      <Input id="story-password" type="password" />
    </FormField>
  ),
};
