import {
  compilationFileDownloadUrl,
  deleteCompilationFile,
  deleteExerciseFile,
  exerciseFileDownloadUrl,
  listCompilationFiles,
  listExerciseFiles,
  uploadCompilationFile,
  uploadExerciseFile,
} from "@runcodes/api-client";
import { AttachmentList } from "./AttachmentList";

export function AttachmentsTab({ exerciseId }: { exerciseId: number }) {
  return (
    <div className="space-y-8 py-4">
      <AttachmentList
        title="Arquivos do exercício"
        hint="Materiais de apoio que o aluno pode baixar (ex: dataset, template)."
        queryKey={["exercise", exerciseId, "files"]}
        list={() => listExerciseFiles(exerciseId)}
        upload={(file) => uploadExerciseFile(exerciseId, file)}
        remove={deleteExerciseFile}
        downloadUrl={exerciseFileDownloadUrl}
      />
      <AttachmentList
        title="Arquivos de compilação"
        hint="Headers, makefiles de apoio — usados pelo compiler-engine, não aparecem pro aluno."
        queryKey={["exercise", exerciseId, "compilation-files"]}
        list={() => listCompilationFiles(exerciseId)}
        upload={(file) => uploadCompilationFile(exerciseId, file)}
        remove={deleteCompilationFile}
        downloadUrl={compilationFileDownloadUrl}
      />
    </div>
  );
}
