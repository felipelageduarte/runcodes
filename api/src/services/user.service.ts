import { randomBytes, createHash } from "node:crypto";
import bcrypt from "bcryptjs";
import type { UserRepository, ProfilePatch } from "../repositories/user.repository.js";
import type { EmailSender } from "../repositories/email-sender.js";
import { hashLegacyPassword, isLegacyHash } from "../lib/legacyPassword.js";
import { ConflictError, ValidationError, NotFoundError, UnauthorizedError } from "../domain/errors.js";

const CONFIRMATION_TOKEN_TTL_MS = 24 * 60 * 60 * 1000;
const RESET_TOKEN_TTL_MS = 60 * 60 * 1000;

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function generateToken(): string {
  return randomBytes(32).toString("hex");
}

export interface SignupInput {
  email: string;
  name: string;
  password: string;
  universityId: number | null;
}

export class UserService {
  constructor(
    private readonly users: UserRepository,
    private readonly emailSender: EmailSender,
    private readonly appBaseUrl: string,
    private readonly legacyPasswordSalt: string,
  ) {}

  /**
   * Mirrors UsersController::add() functionally (self-registration,
   * unconfirmed until the user proves access to the email), but not
   * literally: the legacy confirmation link is a deterministic
   * sha1(salt + email) with no expiry — anyone who learns the salt can
   * recompute it forever. This generates a random token per signup and
   * stores only its hash, with a 24h expiry — the modern, correct version
   * of the same idea. The token is delivered by email, never returned
   * over HTTP (legacy's MessagesController sent plaintext emails but at
   * least never echoed secrets back in API responses — this keeps that
   * one thing legacy got right).
   */
  async signup(input: SignupInput): Promise<void> {
    if (await this.users.existsByEmail(input.email)) {
      throw new ConflictError("An account with this email already exists", "email_already_registered");
    }

    const passwordHash = await bcrypt.hash(input.password, 12);
    const confirmationToken = generateToken();

    await this.users.create({
      email: input.email,
      name: input.name,
      passwordHash,
      universityId: input.universityId,
      confirmationTokenHash: hashToken(confirmationToken),
      confirmationTokenExpiresAt: new Date(Date.now() + CONFIRMATION_TOKEN_TTL_MS),
    });

    await this.sendConfirmationEmail(input.email, confirmationToken);
  }

  async confirm(email: string, token: string): Promise<void> {
    const state = await this.users.findConfirmationState(email);
    if (!state) throw new NotFoundError("User not found");
    if (state.confirmed) return; // idempotent: confirming twice is a no-op, not an error

    if (!state.confirmationTokenHash || !state.confirmationTokenExpiresAt) {
      throw new ValidationError("No pending confirmation for this account", "no_pending_confirmation");
    }
    if (state.confirmationTokenExpiresAt < new Date()) {
      throw new ValidationError("Confirmation token has expired", "confirmation_token_expired");
    }
    if (hashToken(token) !== state.confirmationTokenHash) {
      throw new ValidationError("Invalid confirmation token", "invalid_confirmation_token");
    }

    await this.users.confirm(email);
  }

  /** Mirrors UsersController::sendConfirmationEmail(). */
  async resendConfirmation(email: string): Promise<void> {
    const state = await this.users.findConfirmationState(email);
    if (!state) throw new NotFoundError("User not found");
    if (state.confirmed) {
      throw new ConflictError("This account is already confirmed", "already_confirmed");
    }

    const confirmationToken = generateToken();
    await this.users.setConfirmationToken(
      email,
      hashToken(confirmationToken),
      new Date(Date.now() + CONFIRMATION_TOKEN_TTL_MS),
    );
    await this.sendConfirmationEmail(email, confirmationToken);
  }

  /**
   * Mirrors UsersController::recoveryPassword() functionally, not
   * literally: the legacy flow generates a new password server-side and
   * emails it in plaintext. This instead issues a short-lived (1h) token
   * the user exchanges for a password *they* choose — the password is
   * never in a position to be intercepted in an email body, and a token
   * that leaks is useless without also knowing what new password to set.
   */
  async requestPasswordReset(email: string): Promise<void> {
    if (!(await this.users.existsByEmail(email))) {
      throw new NotFoundError("User not found");
    }
    const resetToken = generateToken();
    await this.users.setResetToken(email, hashToken(resetToken), new Date(Date.now() + RESET_TOKEN_TTL_MS));

    const link = `${this.appBaseUrl}/reset-password?email=${encodeURIComponent(email)}&token=${resetToken}`;
    await this.emailSender.send({
      to: email,
      subject: "run.codes — redefinição de senha",
      text: `Para redefinir sua senha, acesse: ${link}\n\nSe você não solicitou isso, ignore este email. O link expira em 1 hora.`,
      html: `<p>Para redefinir sua senha, acesse: <a href="${link}">${link}</a></p><p>Se você não solicitou isso, ignore este email. O link expira em 1 hora.</p>`,
    });
  }

  async resetPassword(email: string, token: string, newPassword: string): Promise<void> {
    const state = await this.users.findResetState(email);
    if (!state) throw new NotFoundError("User not found");

    if (!state.resetTokenHash || !state.resetTokenExpiresAt) {
      throw new ValidationError("No pending password reset for this account", "no_pending_reset");
    }
    if (state.resetTokenExpiresAt < new Date()) {
      throw new ValidationError("Reset token has expired", "reset_token_expired");
    }
    if (hashToken(token) !== state.resetTokenHash) {
      throw new ValidationError("Invalid reset token", "invalid_reset_token");
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);
    await this.users.resetPassword(email, passwordHash);
  }

  /** Mirrors UsersController::profile()'s "Atualizar Dados Pessoais"
   * path — self-service only, so `type`/`confirmed` are never patchable
   * here (that stays admin-only, see AdminUserService). */
  async getProfile(email: string) {
    const user = await this.users.findByEmail(email);
    if (!user) throw new NotFoundError("User not found");
    const { password: _password, ...rest } = user;
    return rest;
  }

  async updateProfile(email: string, patch: ProfilePatch) {
    const updated = await this.users.updateProfile(email, patch);
    if (!updated) throw new NotFoundError("User not found");
    const { password: _password, ...rest } = updated;
    return rest;
  }

  /** Mirrors UsersController::profile()'s "Atualizar senha" path, but
   * verifies the current password the same way AuthService.login() does
   * (transparent legacy-sha1-to-bcrypt migration included) instead of
   * trusting a client-supplied flag. */
  async changePassword(email: string, oldPassword: string, newPassword: string): Promise<void> {
    const user = await this.users.findByEmail(email);
    if (!user) throw new NotFoundError("User not found");

    const valid = isLegacyHash(user.password)
      ? hashLegacyPassword(this.legacyPasswordSalt, oldPassword) === user.password
      : await bcrypt.compare(oldPassword, user.password);
    if (!valid) throw new UnauthorizedError("Current password is incorrect", "invalid_current_password");

    const passwordHash = await bcrypt.hash(newPassword, 12);
    await this.users.updatePassword(email, passwordHash);
  }

  private async sendConfirmationEmail(email: string, confirmationToken: string): Promise<void> {
    const link = `${this.appBaseUrl}/confirm?email=${encodeURIComponent(email)}&token=${confirmationToken}`;
    await this.emailSender.send({
      to: email,
      subject: "run.codes — confirme seu cadastro",
      text: `Para confirmar seu cadastro, acesse: ${link}\n\nO link expira em 24 horas.`,
      html: `<p>Para confirmar seu cadastro, acesse: <a href="${link}">${link}</a></p><p>O link expira em 24 horas.</p>`,
    });
  }
}
