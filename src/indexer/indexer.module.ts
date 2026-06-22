import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ScheduleModule } from '@nestjs/schedule';
import { MongooseModule } from '@nestjs/mongoose';

import { IndexerService } from './indexer.service';
import { IndexerTasksService } from './tasks.service';
import { EtherscanService } from './etherscan.service';
import { IndexerController } from './indexer.controller';
import { Action, ActionSchema, Swap, SwapSchema } from '../shared/schemas';

@Module({
  imports: [
    HttpModule,
    ScheduleModule.forRoot(),
    MongooseModule.forFeature([
      { name: Swap.name, schema: SwapSchema },
      { name: Action.name, schema: ActionSchema },
    ]),
  ],
  controllers: [IndexerController],
  providers: [IndexerService, EtherscanService, IndexerTasksService],
  exports: [EtherscanService],
})
export class IndexerModule {}
