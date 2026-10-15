import { useState } from "react";
import {
  deleteExerciseCaseFile,
  exerciseCaseFileDownloadUrl,
  listExerciseCaseFiles,
  uploadExerciseCaseFile,
} from "@runcodes/api-client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@runcodes/ui";
import { AttachmentList } from "./AttachmentList";

export function CaseFilesDialog({ caseId, trigger }: { caseId: number; trigger: React.ReactNode }) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent open={open}>
        <DialogHeader>
          <DialogTitle>Arquivos do caso de teste #{caseId}</DialogTitle>
          <DialogDescription>
            Input/output grandes (ex: dataset) via arquivo em vez de texto inline.
          </DialogDescription>
        </DialogHeader>
        <AttachmentList
          title="Arquivos"
          queryKey={["exercise-case", caseId, "files"]}
          list={() => listExerciseCaseFiles(caseId)}
          upload={(file) => uploadExerciseCaseFile(caseId, file)}
          remove={deleteExerciseCaseFile}
          downloadUrl={exerciseCaseFileDownloadUrl}
        />
      </DialogContent>
    </Dialog>
  );
}
