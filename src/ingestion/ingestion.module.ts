import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { MongooseModule } from '@nestjs/mongoose';

import { TheGraphService } from './the-graph.service';
import { IngestionService } from './ingestion.service';
import { IngestionTasksService } from './tasks.service';
import { IndexerModule } from 'src/indexer/indexer.module';
import { IngestionController } from './ingestion.controller';
import { Action, ActionSchema, Swap, SwapSchema } from 'src/shared/schemas';

@Module({
  imports: [
    HttpModule,
    IndexerModule,
    MongooseModule.forFeature([
      { name: Swap.name, schema: SwapSchema },
      { name: Action.name, schema: ActionSchema },
    ]),
  ],
  controllers: [IngestionController],
  providers: [IngestionService, TheGraphService, IngestionTasksService],
})
export class IngestionModule {}
