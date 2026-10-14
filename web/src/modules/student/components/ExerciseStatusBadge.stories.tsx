import type { Meta, StoryObj } from "@storybook/react-vite";
import { ExerciseStatusBadge } from "./ExerciseStatusBadge";
import type { CommitRecord } from "@runcodes/api-client";

function makeCommit(overrides: Partial<CommitRecord> = {}): CommitRecord {
  return {
    id: 1,
    userEmail: "a@x.com",
    exerciseId: 1,
    commitTime: new Date().toISOString(),
    status: 5,
    hash: "h",
    corrects: 1,
    score: "10",
    compiled: true,
    compiledMessage: null,
    compiledSignal: null,
    awsKey: "key",
    ip: null,
    ...overrides,
  };
}

const meta: Meta<typeof ExerciseStatusBadge> = {
  title: "Student/ExerciseStatusBadge",
  component: ExerciseStatusBadge,
};
export default meta;

type Story = StoryObj<typeof ExerciseStatusBadge>;

export const NotSubmitted: Story = { args: { commit: null } };
export const InProgress: Story = { args: { commit: makeCommit({ status: 0 }) } };
export const Approved: Story = { args: { commit: makeCommit({ status: 5, score: "9.5" }) } };
export const Failed: Story = { args: { commit: makeCommit({ status: 5, score: "3" }) } };
export const CompileError: Story = { args: { commit: makeCommit({ status: 6 }) } };
