import { Link } from "react-router-dom";
import { motion } from "motion/react";
import { Card, CardContent, Badge } from "@runcodes/ui";
import type { PublicExerciseSummary } from "@runcodes/api-client";
import { DifficultyBadge } from "./DifficultyBadge";

export function ExerciseCard({ exercise }: { exercise: PublicExerciseSummary }) {
  return (
    <Link to={`/marketplace/${exercise.exerciseId}`}>
      <motion.div whileHover={{ y: -2 }} transition={{ duration: 0.15, ease: "easeOut" }}>
        <Card className="hover:border-primary-300 hover:shadow-popover">
          <CardContent className="p-4">
            <div className="mb-2 flex items-start justify-between gap-2">
              <h3 className="truncate font-medium text-foreground">{exercise.title}</h3>
              <DifficultyBadge bucket={exercise.stats.difficultyBucket} />
            </div>
            {exercise.description && (
              <p className="mb-3 line-clamp-2 text-sm text-muted-foreground">
                {exercise.description.replace(/[#*`_>-]/g, "")}
              </p>
            )}
            <div className="mb-3 flex flex-wrap gap-1">
              {exercise.languages.map((lang) => (
                <Badge key={lang} variant="neutral">
                  {lang}
                </Badge>
              ))}
            </div>
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{exercise.originUniversity?.abbreviation ?? "Origem desconhecida"}</span>
              <span>{exercise.stats.adoptionCount} adoções</span>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </Link>
  );
}
