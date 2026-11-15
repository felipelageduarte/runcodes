import bcrypt from "bcryptjs";
import type {
  UserRepository,
  UserRecord,
  AdminUserListFilter,
  AdminUserPatch,
} from "../repositories/user.repository.js";
import type { AuditRepository } from "../repositories/audit.repository.js";
import type { EmailSender } from "../repositories/email-sender.js";
import {
  NotFoundError,
  ConflictError,
  UnauthorizedError,
  ForbiddenError,
  ValidationError,
} from "../domain/errors.js";
import type { AuthService } from "./auth.service.js";
import type { Requester } from "./offering.service.js";
import type { SessionRevoker } from "../lib/session-state.js";
import { generateToken, hashToken } from "../lib/tokens.js";

/** Validade do convite (spec F3): 72 h. */
export const INVITE_TOKEN_TTL_MS = 72 * 60 * 60 * 1000;
export const USER_HISTORY_MAX = 100;

export interface NewUserByAdminInput {
  email: string;
  name: string;
  password: string;
  type: number;
  universityId: number | null;
}

export interface InviteUserInput {
  email: string;
  name: string;
  type: number;
  universityId: number | null;
}

/** Edição pelo admin. `confirmTypeChange` só vale junto de `type`: trocar o
 * papel de alguém muda o que a conta pode fazer, então o cliente precisa
 * dizer que viu isso (a tela pede confirmação antes de mandar). */
export type AdminUserUpdate = AdminUserPatch & { confirmTypeChange?: boolean };

/** Mirrors UsersController::index/view/edit — admin managing accounts.
 * Split from UserService (self-service signup/confirm/reset) for the
 * same reason OfferingMembershipService is split from EnrollmentService:
 * different actor, different authorization shape, same aggregate.
 *
 * O route layer só garante "é admin" (requirePermission). A trava de rank
 * mora aqui, no servidor, e vale para toda escrita: o ator não mexe em quem
 * tem rank igual ou maior, nem em si mesmo, e não concede rank maior que o
 * dele (spec F3). O rank do ator é o EFETIVO: um dev em view-as de admin
 * age como admin. */
export class AdminUserService {
  constructor(
    private readonly users: UserRepository,
    private readonly auth: AuthService,
    private readonly emailSender: EmailSender,
    private readonly appBaseUrl: string,
    private readonly audit?: AuditRepository,
    private readonly sessions?: SessionRevoker,
  ) {}

  async list(filter: AdminUserListFilter) {
    const { total, users } = await this.users.listForAdmin(filter);
    return { total, page: filter.page, pageSize: filter.pageSize, users: users.map(present) };
  }

  async getByEmail(email: string) {
    const user = await this.users.findByEmail(email);
    if (!user) throw new NotFoundError("User not found");
    return present(user);
  }

  async update(actor: Requester, email: string, input: AdminUserUpdate) {
    const { confirmTypeChange, ...patch } = input;
    const target = await this.requireManageable(actor, email);

    if (patch.type !== undefined && patch.type !== target.type) {
      assertCanGrant(actor, patch.type);
      if (!confirmTypeChange) {
        throw new ValidationError("Changing the account type needs confirmation", "type_change_not_confirmed");
      }
    }

    const updated = await this.users.updateByAdmin(email, patch);
    if (!updated) throw new NotFoundError("User not found");
    // Rebaixar, promover ou desconfirmar vale para a sessão corrente do
    // alvo, não só para o próximo login (spec F2/G2).
    if (patch.type !== undefined || patch.confirmed !== undefined) {
      await this.sessions?.revoke(email);
    }
    return present(updated);
  }

  /** Mirrors UsersController::insert() — pre-confirmed, unlike self-signup. */
  async create(actor: Requester, input: NewUserByAdminInput) {
    assertCanGrant(actor, input.type);
    if (await this.users.existsByEmail(input.email)) {
      throw new ConflictError("An account with this email already exists", "email_already_registered");
    }
    const passwordHash = await bcrypt.hash(input.password, 12);
    const created = await this.users.createByAdmin({ ...input, passwordHash });
    return present(created);
  }

  /** Convite: cria a conta sem senha utilizável e manda o link de 72 h; a
   * pessoa escolhe a senha no aceite (UserService.acceptInvite). */
  async invite(actor: Requester, input: InviteUserInput) {
    assertCanGrant(actor, input.type);
    if (await this.users.existsByEmail(input.email)) {
      throw new ConflictError("An account with this email already exists", "email_already_registered");
    }
    const token = generateToken();
    // Senha aleatória descartada: a coluna é NOT NULL e ninguém a conhece.
    const passwordHash = await bcrypt.hash(generateToken(), 12);
    const created = await this.users.createInvited({
      ...input,
      passwordHash,
      tokenHash: hashToken(token),
      tokenExpiresAt: new Date(Date.now() + INVITE_TOKEN_TTL_MS),
    });
    await this.sendInviteEmail(input.email, input.name, token);
    return present(created);
  }

  /** Reenvio: novo token (o anterior morre) e novos 72 h. Só para convite
   * ainda não aceito. */
  async resendInvite(actor: Requester, email: string) {
    const target = await this.requireManageable(actor, email);
    if (!target.invitedAt) throw new ConflictError("This account was not created by invite", "not_invited");
    if (target.confirmed) throw new ConflictError("This invite was already accepted", "invite_already_accepted");
    const token = generateToken();
    await this.users.renewInvite(email, hashToken(token), new Date(Date.now() + INVITE_TOKEN_TTL_MS));
    await this.sendInviteEmail(email, target.name, token);
    return present((await this.users.findByEmail(email)) ?? target);
  }

  /** Desativar em vez de excluir: a conta fica (com histórico de submissões)
   * mas não loga e perde a sessão na hora. */
  async disable(actor: Requester, email: string) {
    const target = await this.requireManageable(actor, email);
    if (target.disabledAt) return present(target);
    await this.users.setDisabled(email, true);
    await this.sessions?.revoke(email);
    return present((await this.users.findByEmail(email)) ?? target);
  }

  async enable(actor: Requester, email: string) {
    const target = await this.requireManageable(actor, email);
    if (!target.disabledAt) return present(target);
    await this.users.setDisabled(email, false);
    this.sessions?.refresh(email);
    return present((await this.users.findByEmail(email)) ?? target);
  }

  /** Histórico de mudanças da conta: escritas do admin sobre ela, lidas da
   * trilha de auditoria por `target_id` (F1). Anterior ao A3 não tem alvo
   * gravado, então a lista começa no deploy desta fase. */
  async history(email: string, limit = 50) {
    if (!(await this.users.existsByEmail(email))) throw new NotFoundError("User not found");
    if (!this.audit) return { items: [] };
    const { items } = await this.audit.feed({
      targetType: "user",
      targetId: email,
      mutationsOnly: true,
      limit: Math.min(Math.max(limit, 1), USER_HISTORY_MAX),
      offset: 0,
    });
    return {
      items: items.map((i) => ({
        at: i.at,
        actorEmail: i.actorEmail,
        method: i.method,
        route: i.route,
        status: i.status,
        requestId: i.requestId,
        changes: i.requestBody,
      })),
    };
  }

  /** Mirrors UsersController::delete() — hard delete, mas só de conta SEM
   * submissão (senão cascateia o histórico do aluno: use `disable`).
   * Exige a senha do próprio admin porque é irreversível. */
  async delete(actor: Requester, email: string, actorPassword: string): Promise<void> {
    await this.requireManageable(actor, email);
    if (!(await this.auth.verifyPassword(actor.email, actorPassword))) {
      throw new UnauthorizedError("Current password is incorrect", "invalid_current_password");
    }
    if ((await this.users.countSubmissions(email)) > 0) {
      throw new ConflictError("This account has submissions: disable it instead of deleting", "user_has_submissions");
    }
    if (!(await this.users.deleteByAdmin(email))) throw new NotFoundError("User not found");
    this.sessions?.refresh(email);
  }

  /** Alvo existe e o ator pode mexer nele: não é o próprio ator e o rank do
   * alvo é MENOR que o do ator. */
  private async requireManageable(actor: Requester, email: string): Promise<UserRecord> {
    const target = await this.users.findByEmail(email);
    if (!target) throw new NotFoundError("User not found");
    if (target.email.toLowerCase() === actor.email.toLowerCase()) {
      throw new ForbiddenError("You cannot change your own account here", "cannot_manage_self");
    }
    if (target.type >= actor.type) {
      throw new ForbiddenError("You cannot manage an account of equal or higher rank", "rank_too_high");
    }
    return target;
  }

  private async sendInviteEmail(email: string, name: string, token: string): Promise<void> {
    const link = `${this.appBaseUrl}/accept-invite?email=${encodeURIComponent(email)}&token=${token}`;
    await this.emailSender.send({
      to: email,
      subject: "runcodes.sh — você foi convidado",
      text: `Olá, ${name}. Para criar sua senha e ativar a conta, acesse: ${link}\n\nO convite expira em 72 horas.`,
      html: `<p>Olá, ${escapeHtml(name)}.</p><p>Para criar sua senha e ativar a conta, acesse: <a href="${link}">${link}</a></p><p>O convite expira em 72 horas.</p>`,
    });
  }
}

function assertCanGrant(actor: Requester, type: number): void {
  if (type > actor.type) {
    throw new ForbiddenError("You cannot grant a rank higher than your own", "cannot_grant_higher_rank");
  }
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

/** Nunca devolve o hash da senha nem o estado interno de sessão; expõe o que
 * a tela de usuários precisa para o estado da conta. */
function present(user: UserRecord) {
  const { password: _password, tokenVersion: _tokenVersion, disabledAt, invitedAt, ...rest } = user;
  return {
    ...rest,
    disabledAt,
    invitedAt,
    status: accountStatus(user),
  };
}

export type AccountStatus = "active" | "disabled" | "invited" | "unconfirmed";

function accountStatus(user: UserRecord): AccountStatus {
  if (user.disabledAt) return "disabled";
  if (!user.confirmed) return user.invitedAt ? "invited" : "unconfirmed";
  return "active";
}
