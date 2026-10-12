import { randomBytes, createHash } from "node:crypto";
import bcrypt from "bcryptjs";
import type { UserRepository } from "../repositories/user.repository.js";
import { ConflictError, ValidationError, NotFoundError } from "../domain/errors.js";

const CONFIRMATION_TOKEN_TTL_MS = 24 * 60 * 60 * 1000;

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export interface SignupInput {
  email: string;
  name: string;
  password: string;
  universityId: number | null;
}

export class UserService {
  constructor(private readonly users: UserRepository) {}

  /**
   * Mirrors UsersController::add() functionally (self-registration,
   * unconfirmed until the user proves access to the email), but not
   * literally: the legacy confirmation link is a deterministic
   * sha1(salt + email) with no expiry — anyone who learns the salt can
   * recompute it forever. This generates a random token per signup and
   * stores only its hash, with a 24h expiry — the modern, correct version
   * of the same idea.
   *
   * Sending the email itself is out of scope until a transactional-email
   * module exists (see docs roadmap) — the raw token is returned here so
   * the caller (eventually: an email service) can deliver it.
   */
  async signup(input: SignupInput): Promise<{ confirmationToken: string }> {
    if (await this.users.existsByEmail(input.email)) {
      throw new ConflictError("An account with this email already exists", "email_already_registered");
    }

    const passwordHash = await bcrypt.hash(input.password, 12);
    const confirmationToken = randomBytes(32).toString("hex");

    await this.users.create({
      email: input.email,
      name: input.name,
      passwordHash,
      universityId: input.universityId,
      confirmationTokenHash: hashToken(confirmationToken),
      confirmationTokenExpiresAt: new Date(Date.now() + CONFIRMATION_TOKEN_TTL_MS),
    });

    return { confirmationToken };
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
}
