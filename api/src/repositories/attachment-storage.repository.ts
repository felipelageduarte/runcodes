import { PutObjectCommand, GetObjectCommand, DeleteObjectCommand, type S3Client } from "@aws-sdk/client-s3";

/**
 * Generic S3-backed storage for exercise attachments, parametrized by a
 * key prefix ("exercisefiles" or "compilationfiles") so one class serves
 * both ExerciseFile and CompilationFile without duplicating the put/get/
 * delete logic. The compilation-file instance's key shape
 * (`compilationfiles/{exerciseId}/{filename}` inside the `{prefix}-files`
 * bucket) is a hard contract with compiler-engine's
 * fetch_exercise_file() — not opaque, same caveat as the cases bucket.
 */
export interface AttachmentStorageRepository {
  put(exerciseId: number, filename: string, content: Buffer): Promise<void>;
  get(exerciseId: number, filename: string): Promise<Uint8Array>;
  delete(exerciseId: number, filename: string): Promise<void>;
}

export class S3AttachmentStorageRepository implements AttachmentStorageRepository {
  constructor(
    private readonly client: S3Client,
    private readonly bucket: string,
    private readonly keyPrefix: string,
  ) {}

  private keyFor(exerciseId: number, filename: string): string {
    return `${this.keyPrefix}/${exerciseId}/${filename}`;
  }

  async put(exerciseId: number, filename: string, content: Buffer): Promise<void> {
    await this.client.send(
      new PutObjectCommand({ Bucket: this.bucket, Key: this.keyFor(exerciseId, filename), Body: content }),
    );
  }

  async get(exerciseId: number, filename: string): Promise<Uint8Array> {
    const result = await this.client.send(
      new GetObjectCommand({ Bucket: this.bucket, Key: this.keyFor(exerciseId, filename) }),
    );
    return result.Body!.transformToByteArray();
  }

  async delete(exerciseId: number, filename: string): Promise<void> {
    await this.client.send(
      new DeleteObjectCommand({ Bucket: this.bucket, Key: this.keyFor(exerciseId, filename) }),
    );
  }
}
