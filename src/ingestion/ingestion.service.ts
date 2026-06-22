import { Model } from 'mongoose';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';

import { KeyvService } from '@app/keyv';
import { buildEventId } from 'src/shared/tools';
import { IMintResDto } from './contracts/mints.dto';
import { IBurnResDto } from './contracts/burns.dto';
import { ISwapResDto } from './contracts/swaps.dto';
import { TheGraphService } from './the-graph.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Action, ActionEvent, Swap } from 'src/shared/schemas';
import { EtherscanService } from 'src/indexer/etherscan.service';
import { IIngestionParams } from './contracts/thegraph.constants';

@Injectable()
export class IngestionService {
  constructor(
    private readonly keyvService: KeyvService,
    private readonly eventEmitter: EventEmitter2,
    private readonly configService: ConfigService,
    private readonly theGraphService: TheGraphService,
    private readonly etherscanService: EtherscanService,
    @InjectModel(Swap.name) private swapModel: Model<Swap>,
    @InjectModel(Action.name) private actionModel: Model<Action>,
  ) {}

  public async indexReceipts(): Promise<void> {
    try {
      let fromBlock = Number(
        this.configService.getOrThrow<number>('FROM_BLOCK'),
      );

      const indexedBlock = await this.keyvService.getLastIndexedBlock();
      if (indexedBlock > 0) fromBlock = indexedBlock + 1;

      const latestBlock = await this.etherscanService.getLatestBlockNumber();
      const safeBlock =
        this.etherscanService.getLastSafeBlockNumber(latestBlock);

      let toBlock =
        fromBlock +
        Number(this.configService.getOrThrow<number>('WINDOW_SIZE'));

      const configuredToBlock = Number(
        this.configService.get<number>('TO_BLOCK') || 0,
      );

      if (configuredToBlock > 0 && toBlock > configuredToBlock)
        toBlock = configuredToBlock;

      if (toBlock > safeBlock) toBlock = safeBlock;

      if (fromBlock > toBlock) return;

      const params: IIngestionParams = {
        fromBlock,
        toBlock,
        pool: this.configService.getOrThrow('POOL_CONTRACT_ADDRESS'),
      };

      const mints = await this.theGraphService.fetchMints(params);
      const burns = await this.theGraphService.fetchBurns(params);

      const swaps = await this.theGraphService.fetchSwaps(params);
      swaps.sort(
        (s1, s2) =>
          Number(s2.transaction.blockNumber) -
          Number(s1.transaction.blockNumber),
      );

      const actions = [
        ...mints.map((e) => this.convertRawMintOrBurn(e, 'mint')),
        ...burns.map((e) => this.convertRawMintOrBurn(e, 'burn')),
      ];
      actions.sort((a, b) => {
        if (a.blockNumber !== a.blockNumber) {
          return Number(a.blockNumber) - Number(b.blockNumber);
        }
        return Number(a.logIndex) - Number(b.logIndex);
      });

      if (swaps?.[0]) {
        const oldSwap = await this.swapModel.findOne();
        await this.swapModel.insertOne(this.convertRawSawp(swaps[0]));
        await oldSwap?.deleteOne();
      }
      await this.actionModel.insertMany(actions, { ordered: false });

      this.eventEmitter.emit('swap.update');
      this.eventEmitter.emit('actions.indexed', actions);

      await this.keyvService.setLastIndexedBlock(toBlock);
    } catch (e) {
      console.error(e);
    }
  }

  private convertRawMintOrBurn(
    raw: IMintResDto | IBurnResDto,
    event: ActionEvent,
  ): Action {
    return new Action({
      event,
      amount: raw.amount,
      amount0: raw.amount0,
      amount1: raw.amount1,
      tickLower: raw.tickLower,
      tickUpper: raw.tickUpper,
      owner: raw.origin.toLowerCase(),
      logIndex: Number(raw.logIndex),
      transactionHash: raw.transaction.id,
      blockNumber: Number(raw.transaction.blockNumber),
      eventId: buildEventId(raw.transaction.blockNumber, raw.logIndex),
    });
  }

  private convertRawSawp(raw: ISwapResDto): Swap {
    return new Swap({
      amount0: raw.amount0,
      amount1: raw.amount1,
      tick: Number(raw.tick),
      sqrtPriceX96: raw.sqrtPriceX96,
      logIndex: Number(raw.logIndex),
      transactionHash: raw.transaction.id,
      blockNumber: Number(raw.transaction.blockNumber),
      eventId: buildEventId(raw.transaction.blockNumber, raw.logIndex),
    });
  }
}
