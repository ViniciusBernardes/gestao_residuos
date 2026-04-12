/**
 * Stub S3-compatível (MinIO / AWS S3). Em produção, configure AWS_SDK_LOAD_CONFIG
 * ou injete @aws-sdk/client-s3 com credenciais via env.
 */
import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);

  get isConfigured(): boolean {
    return !!(process.env.S3_BUCKET && process.env.S3_ENDPOINT);
  }

  /** PoC: apenas registra intenção; substituir por PutObjectCommand em produção */
  async putObject(key: string, body: Buffer, contentType: string): Promise<{ key: string }> {
    this.logger.log(`[S3 stub] put ${key} (${body.length} bytes, ${contentType})`);
    if (!this.isConfigured) {
      return { key: `local/${key}` };
    }
    return { key };
  }
}
