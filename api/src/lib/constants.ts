// Mirrors CakePHP User::get*Index() / Enrollment::get*Role() — keep in sync
// with server/src/app/Model/User.php and Model/Enrollment.php until that
// code is retired.
export const UserType = {
  STUDENT: 0,
  ASSISTANT: 1,
  PROFESSOR: 2,
  ADMIN: 3,
  DEVELOPER: 4,
} as const;

export const EnrollmentRole = {
  STUDENT: 0,
  ASSISTANT: 1,
  PROFESSOR: 2,
} as const;
