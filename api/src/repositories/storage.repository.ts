import { PutObjectCommand, GetObjectCommand, type S3Client } from "@aws-sdk/client-s3";

// Decouples the commit service from the AWS SDK — swapping storage
// backends (or mocking in tests) never touches business logic.
export interface StorageRepository {
  putCommitFile(key: string, body: Buffer): Promise<void>;
  getCommitFile(key: string): Promise<Uint8Array>;
}

export class S3StorageRepository implements StorageRepository {
  constructor(
    private readonly client: S3Client,
    private readonly commitsBucket: string,
  ) {}

  async putCommitFile(key: string, body: Buffer): Promise<void> {
    await this.client.send(
      new PutObjectCommand({ Bucket: this.commitsBucket, Key: key, Body: body }),
    );
  }

  async getCommitFile(key: string): Promise<Uint8Array> {
    const result = await this.client.send(
      new GetObjectCommand({ Bucket: this.commitsBucket, Key: key }),
    );
    return result.Body!.transformToByteArray();
  }
}
