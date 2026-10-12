import type {
  UserRepository,
  UserRecord,
  AdminUserListFilter,
  AdminUserPatch,
} from "../repositories/user.repository.js";
import { NotFoundError } from "../domain/errors.js";

/** Mirrors UsersController::index/view/edit — admin managing accounts.
 * Split from UserService (self-service signup/confirm/reset) for the
 * same reason OfferingMembershipService is split from EnrollmentService:
 * different actor, different authorization shape, same aggregate.
 * Authorization itself (admin-only) is enforced at the route layer via
 * requireMinType, same as every other admin-only resource. */
export class AdminUserService {
  constructor(private readonly users: UserRepository) {}

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
}

function omitPassword(user: UserRecord) {
  const { password: _password, ...rest } = user;
  return rest;
}
