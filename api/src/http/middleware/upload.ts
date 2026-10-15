import multer from "multer";

// Hard ceiling at the HTTP layer (5MB, the legacy non-compilable limit).
// The stricter 1MB compilable-exercise limit is enforced in
// CommitService once the exercise's type is known.
export const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5_000_000 },
});
