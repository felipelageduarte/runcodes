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

// Mirrors Exercise::getCompilableIndex()/getNotCompilableIndex().
export const CompilableExerciseTypes = [0, 2];
export const NotCompilableExerciseType = 1;

// Mirrors Commit::get*StatusValue().
export const CommitStatus = {
  IN_QUEUE: 0,
  COMPILING: 1,
  COMPILED: 2,
  RUNNING: 3,
  UNCOMPLETED: 4,
  COMPLETED: 5,
  ERROR: 6,
  SUBMITTED: 7, // non-compilable, awaiting manual grading
  PLAGIARISM: 8,
  SERVER_ERROR: 9,
} as const;
