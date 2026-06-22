import { QueueOptions } from 'bullmq';
import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule, MongooseModuleFactoryOptions } from '@nestjs/mongoose';

import { KeyvModule } from '@app/keyv';
import { AppController } from './app.controller';
import { IndexerModule } from './indexer/indexer.module';
import { LiquidityModule } from './liquidity/liquidity.module';
import { IngestionModule } from './ingestion/ingestion.module';

@Module({
  imports: [
    KeyvModule,
    IndexerModule,
    LiquidityModule,
    IngestionModule,
    EventEmitterModule.forRoot(),
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory(configService: ConfigService): MongooseModuleFactoryOptions {
        return {
          uri: configService.get<string>('MONGO_URL'),
        };
      },
    }),
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory(configService: ConfigService): QueueOptions {
        return {
          connection: {
            port: configService.getOrThrow<number>('REDIS_PORT'),
            host: configService.getOrThrow<string>('REDIS_HOST'),
          },
        };
      },
    }),
  ],
  controllers: [AppController],
})
export class AppModule {}
