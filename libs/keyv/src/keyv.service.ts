import Redis from 'ioredis';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class KeyvService {
  public readonly redis: Redis;
  private readonly transactionOwnerEx = 3600;
  private readonly indexerLock = 'indexer-lock';
  private readonly lastIndexedBlock = 'last-indexed-block';
  private readonly transactionOwner = (txhash: string) =>
    `transaction-owner-${txhash}`;

  constructor(configService: ConfigService) {
    this.redis = new Redis({
      port: configService.getOrThrow<number>('REDIS_PORT'),
      host: configService.getOrThrow<string>('REDIS_HOST'),
    });
  }

  public async tryIndexerLock(): Promise<boolean> {
    const locked = await this.redis.set(this.indexerLock, 'true', 'NX');
    return locked === 'OK';
  }

  public async releaseIndexerLock(): Promise<void> {
    await this.redis.del(this.indexerLock);
  }

  public async getLastIndexedBlock(): Promise<number> {
    return Number((await this.redis.get(this.lastIndexedBlock)) || 0);
  }

  public async setLastIndexedBlock(n: number): Promise<void> {
    await this.redis.set(this.lastIndexedBlock, n.toString());
  }

  public async getTransactionOwner(txhash: string): Promise<string | null> {
    return this.redis.get(this.transactionOwner(txhash));
  }

  public async setTransactionOwner(
    txhash: string,
    owner: string,
  ): Promise<boolean> {
    const done = await this.redis.set(
      this.transactionOwner(txhash),
      owner,
      'EX',
      this.transactionOwnerEx,
      'NX',
    );
    return done === 'OK';
  }
}
