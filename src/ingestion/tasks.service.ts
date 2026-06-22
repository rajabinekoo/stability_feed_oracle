import { ConfigService } from '@nestjs/config';
import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';

import { KeyvService } from '@app/keyv';
import { IngestionService } from './ingestion.service';

@Injectable()
export class IngestionTasksService {
  private readonly indexing: boolean = true;
  private readonly logger = new Logger(IngestionTasksService.name);

  constructor(
    private readonly keyvService: KeyvService,
    private readonly configService: ConfigService,
    private readonly ingestionService: IngestionService,
  ) {
    void keyvService.releaseIndexerLock();
    this.indexing = configService.get<string>('INDEXING_MODE') === 'ingestion';
  }

  @Cron(CronExpression.EVERY_10_SECONDS)
  async indexingJob() {
    if (!this.indexing) return;
    if (!(await this.keyvService.tryIndexerLock())) return;

    if (this.configService.get<string>('NODE_ENV') === 'development')
      this.logger.debug('Ingestion is running at ' + new Date().toISOString());

    try {
      await this.ingestionService.indexReceipts();
    } finally {
      await this.keyvService.releaseIndexerLock();
    }
  }
}
