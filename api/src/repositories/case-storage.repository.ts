import {
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  DeleteObjectsCommand,
  ListObjectsV2Command,
  type S3Client,
} from "@aws-sdk/client-s3";

/**
 * Exercise case input/output live in the `cases` bucket under keys
 * `{caseId}/in` and `{caseId}/out` — not opaque like commits.aws_key, this
 * exact shape is a hard contract: runcodes-compiler's S3 storage provider
 * (provider/storage/s3.py) does `cases_bucket.download_file(f"{id}/in", ...)`
 * verbatim. Changing the key format here breaks grading for every case.
 */
export interface CaseStorageRepository {
  putInput(caseId: number, content: string): Promise<void>;
  putOutput(caseId: number, content: string): Promise<void>;
  getInput(caseId: number): Promise<string>;
  getOutput(caseId: number): Promise<string>;
  /** `{caseId}/files/{filename}` — same bucket, same hard contract:
   * runcodes-compiler's fetch_test_case_files() reads this verbatim. */
  putFile(caseId: number, filename: string, content: Buffer): Promise<void>;
  getFile(caseId: number, filename: string): Promise<Uint8Array>;
  deleteFile(caseId: number, filename: string): Promise<void>;
  deleteCase(caseId: number): Promise<void>;
}

export class S3CaseStorageRepository implements CaseStorageRepository {
  constructor(
    private readonly client: S3Client,
    private readonly casesBucket: string,
  ) {}

  async putInput(caseId: number, content: string): Promise<void> {
    await this.put(`${caseId}/in`, content);
  }

  async putOutput(caseId: number, content: string): Promise<void> {
    await this.put(`${caseId}/out`, content);
  }

  async getInput(caseId: number): Promise<string> {
    return this.get(`${caseId}/in`);
  }

  async getOutput(caseId: number): Promise<string> {
    return this.get(`${caseId}/out`);
  }

  async putFile(caseId: number, filename: string, content: Buffer): Promise<void> {
    await this.client.send(
      new PutObjectCommand({ Bucket: this.casesBucket, Key: `${caseId}/files/${filename}`, Body: content }),
    );
  }

  async getFile(caseId: number, filename: string): Promise<Uint8Array> {
    const result = await this.client.send(
      new GetObjectCommand({ Bucket: this.casesBucket, Key: `${caseId}/files/${filename}` }),
    );
    return result.Body!.transformToByteArray();
  }

  async deleteFile(caseId: number, filename: string): Promise<void> {
    await this.client.send(
      new DeleteObjectCommand({ Bucket: this.casesBucket, Key: `${caseId}/files/${filename}` }),
    );
  }

  async deleteCase(caseId: number): Promise<void> {
    const filesPrefix = `${caseId}/files/`;
    const listing = await this.client.send(
      new ListObjectsV2Command({ Bucket: this.casesBucket, Prefix: filesPrefix }),
    );
    const fileKeys = (listing.Contents ?? []).map((obj) => obj.Key!);

    await Promise.all([
      this.client.send(new DeleteObjectCommand({ Bucket: this.casesBucket, Key: `${caseId}/in` })),
      this.client.send(new DeleteObjectCommand({ Bucket: this.casesBucket, Key: `${caseId}/out` })),
      fileKeys.length > 0
        ? this.client.send(
            new DeleteObjectsCommand({
              Bucket: this.casesBucket,
              Delete: { Objects: fileKeys.map((Key) => ({ Key })) },
            }),
          )
        : Promise.resolve(),
    ]);
  }

  private async put(key: string, content: string): Promise<void> {
    await this.client.send(new PutObjectCommand({ Bucket: this.casesBucket, Key: key, Body: content }));
  }

  private async get(key: string): Promise<string> {
    const result = await this.client.send(new GetObjectCommand({ Bucket: this.casesBucket, Key: key }));
    return result.Body!.transformToString();
  }
}
