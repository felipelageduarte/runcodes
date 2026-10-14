import bcrypt from "bcryptjs";
import type {
  UserRepository,
  UserRecord,
  AdminUserListFilter,
  AdminUserPatch,
} from "../repositories/user.repository.js";
import { NotFoundError, ConflictError, UnauthorizedError } from "../domain/errors.js";
import type { AuthService } from "./auth.service.js";

export interface NewUserByAdminInput {
  email: string;
  name: string;
  password: string;
  type: number;
  universityId: number | null;
}

/** Mirrors UsersController::index/view/edit — admin managing accounts.
 * Split from UserService (self-service signup/confirm/reset) for the
 * same reason OfferingMembershipService is split from EnrollmentService:
 * different actor, different authorization shape, same aggregate.
 * Authorization itself (admin-only) is enforced at the route layer via
 * requireMinType, same as every other admin-only resource. */
export class AdminUserService {
  constructor(
    private readonly users: UserRepository,
    private readonly auth: AuthService,
  ) {}

  async list(filter: AdminUserListFilter) {
    const { total, users } = await this.users.listForAdmin(filter);
    return { total, page: filter.page, pageSize: filter.pageSize, users: users.map(omitPassword) };
  }

  async getByEmail(email: string) {
    const user = await this.users.findByEmail(email);
    if (!user) throw new NotFoundError("User not found");
    return omitPassword(user);
  }

  async update(email: string, patch: AdminUserPatch) {
    const updated = await this.users.updateByAdmin(email, patch);
    if (!updated) throw new NotFoundError("User not found");
    return omitPassword(updated);
  }

  /** Mirrors UsersController::insert() — pre-confirmed, unlike self-signup. */
  async create(input: NewUserByAdminInput) {
    if (await this.users.existsByEmail(input.email)) {
      throw new ConflictError("An account with this email already exists", "email_already_registered");
    }
    const passwordHash = await bcrypt.hash(input.password, 12);
    const created = await this.users.createByAdmin({ ...input, passwordHash });
    return omitPassword(created);
  }

  /** Mirrors UsersController::delete() — hard delete. Requires the
   * acting admin to reauthenticate with their own password, since this
   * is irreversible (cascades to enrollments/submissions). */
  async delete(email: string, actorEmail: string, actorPassword: string): Promise<void> {
    if (!(await this.auth.verifyPassword(actorEmail, actorPassword))) {
      throw new UnauthorizedError("Current password is incorrect", "invalid_current_password");
    }
    if (!(await this.users.deleteByAdmin(email))) throw new NotFoundError("User not found");
  }
}

function omitPassword(user: UserRecord) {
  const { password: _password, ...rest } = user;
  return rest;
}
