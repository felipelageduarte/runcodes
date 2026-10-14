import type { MessageRepository, MessageRecord } from "../repositories/message.repository.js";
import type { UserRepository } from "../repositories/user.repository.js";
import type { EmailSender } from "../repositories/email-sender.js";
import { UserType } from "../lib/constants.js";
import { ForbiddenError, ValidationError } from "../domain/errors.js";
import type { Requester } from "./offering.service.js";

export type BroadcastAudience = "students" | "staff" | "admins" | "all";

// [min, max] inclusive — `max: undefined` means no upper bound. "staff"
// bundles assistant+professor+admin+developer on purpose: the legacy
// Message::getRecipesList() only ever targeted professors exactly,
// never assistants — that reads as an oversight in the original, not a
// product decision worth repeating here.
const AUDIENCE_TYPE_RANGE: Record<BroadcastAudience, [min: number, max: number | undefined]> = {
  students: [UserType.STUDENT, UserType.STUDENT],
  staff: [UserType.ASSISTANT, UserType.ADMIN - 1],
  admins: [UserType.ADMIN, undefined],
  all: [UserType.STUDENT, undefined],
};

const AUDIENCE_LABEL: Record<BroadcastAudience, string> = {
  students: "Alunos",
  staff: "Professores/assistentes",
  admins: "Admins",
  all: "Todos",
};

export interface NewBroadcastInput {
  audience: BroadcastAudience;
  subject: string;
  message: string;
}

/**
 * Admin broadcast email — mirrors MessagesController::sendMail()'s role-
 * based audience buckets (Message::getRecipesList()), simplified on
 * purpose: no open-tracking pixel, no attachments, no blacklist. The
 * legacy pixel logs who opened what, which the gap this closes
 * (docs/roadmap/gap-audit-2026-10.md item 9) explicitly flagged as a
 * privacy trade-off not worth porting — send + history is the whole
 * feature here, not send + surveillance.
 */
export class MessageService {
  constructor(
    private readonly messages: MessageRepository,
    private readonly users: UserRepository,
    private readonly emailSender: EmailSender,
  ) {}

  async send(requester: Requester, input: NewBroadcastInput): Promise<MessageRecord> {
    if (requester.type < UserType.ADMIN) throw new ForbiddenError();
    if (!input.subject.trim() || !input.message.trim()) {
      throw new ValidationError("Subject and message are required", "missing_content");
    }

    const [minType, maxType] = AUDIENCE_TYPE_RANGE[input.audience];
    const recipients = await this.users.listConfirmedEmailsByTypeRange(minType, maxType);

    // Best-effort per recipient — one bad address shouldn't sink the
    // whole broadcast; the history row still records how many were
    // targeted, not how many actually went through.
    await Promise.allSettled(
      recipients.map((to) =>
        this.emailSender.send({ to, subject: `[run.codes] ${input.subject}`, text: input.message }),
      ),
    );

    return this.messages.create({
      senderEmail: requester.email,
      recipes: AUDIENCE_LABEL[input.audience],
      subject: input.subject,
      message: input.message,
      recipientCount: recipients.length,
    });
  }

  async list(page: number, pageSize: number, requester: Requester) {
    if (requester.type < UserType.ADMIN) throw new ForbiddenError();
    const { total, messages } = await this.messages.list(page, pageSize);
    return { total, page, pageSize, messages };
  }
}
