import { Model } from 'mongoose';
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ConfigService } from '@nestjs/config';
import { decodeEventLog, parseAbi } from 'viem';
import { EventEmitter2 } from '@nestjs/event-emitter';

import { KeyvService } from '@app/keyv';
import { buildEventId } from 'src/shared/tools';
import { Action, Swap } from '../shared/schemas';
import { EtherscanService } from './etherscan.service';
import { EventLogsReq, ParsedEtherscanLog } from './contracts/etherscan';
import {
  indexerTimeout,
  burnEventSignature,
  mintEventSignature,
  swapEventSignature,
} from './contracts/constants';

@Injectable()
export class IndexerService {
  constructor(
    @InjectModel(Swap.name) private swapModel: Model<Swap>,
    @InjectModel(Action.name) private actionModel: Model<Action>,
    private readonly keyvService: KeyvService,
    private readonly eventEmitter: EventEmitter2,
    private readonly configService: ConfigService,
    private readonly etherscanService: EtherscanService,
  ) {}

  public async indexReceipts(): Promise<void> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), indexerTimeout);

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

      if (toBlock > latestBlock) toBlock = latestBlock;

      if (fromBlock > toBlock) return clearTimeout(timeout);

      const [confirmedLogs] = await this.etherscanService.getReceiptsLogs({
        fromBlock,
        toBlock,
        safeBlock,
      } as EventLogsReq);

      const [actions, swaps] = await this.ethLogsToActions(confirmedLogs);
      swaps.sort((s1, s2) => Number(s2.blockNumber) - Number(s1.blockNumber));

      if (swaps?.[0]) {
        const oldSwap = await this.swapModel.findOne();
        await this.swapModel.insertOne(swaps[0]);
        await oldSwap?.deleteOne();
      }
      await this.actionModel.insertMany(actions, { ordered: false });

      this.eventEmitter.emit('swap.update');
      this.eventEmitter.emit('actions.indexed', actions);

      await this.keyvService.setLastIndexedBlock(toBlock);
    } catch (e) {
      console.error(e);
    } finally {
      clearTimeout(timeout);
    }
  }

  private async ethLogsToActions(
    logs: ParsedEtherscanLog[],
  ): Promise<[Action[], Swap[]]> {
    const swaps: Swap[] = [];
    const actions: Action[] = [];

    for (const log of logs) {
      const swap = this.extractSwapLog(log);
      if (swap) {
        swaps.push(swap);
        continue;
      }
      const mint = await this.extractMintLog(log);
      if (mint) {
        actions.push(mint);
        continue;
      }
      const burn = await this.extractBurnLog(log);
      if (burn) {
        actions.push(burn);
      }
    }

    return [actions, swaps];
  }

  private async extractMintLog(
    log: ParsedEtherscanLog,
  ): Promise<Action | undefined> {
    try {
      const eventLog = decodeEventLog({
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-expect-error
        topics: log.topics,
        data: <`0x${string}`>log.data,
        abi: parseAbi([mintEventSignature]),
      });
      return new Action({
        eventId: buildEventId(log.blockHash, log.logIndex),
        event: 'mint',
        amount: eventLog.args.amount.toString(),
        amount0: eventLog.args.amount0.toString(),
        amount1: eventLog.args.amount1.toString(),
        tickLower: eventLog.args.tickLower.toString(),
        tickUpper: eventLog.args.tickUpper.toString(),
        owner: await this.etherscanService.getTxOwner(log.transactionHash),
        logIndex: log.logIndex,
        blockNumber: log.blockNumber,
        transactionHash: log.transactionHash,
      });
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (e) {
      /* empty */
    }
  }

  private async extractBurnLog(
    log: ParsedEtherscanLog,
  ): Promise<Action | undefined> {
    try {
      const eventLog = decodeEventLog({
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-expect-error
        topics: log.topics,
        data: <`0x${string}`>log.data,
        abi: parseAbi([burnEventSignature]),
      });
      return new Action({
        eventId: buildEventId(log.blockHash, log.logIndex),
        event: 'burn',
        amount: eventLog.args.amount.toString(),
        amount0: eventLog.args.amount0.toString(),
        amount1: eventLog.args.amount1.toString(),
        tickLower: eventLog.args.tickLower.toString(),
        tickUpper: eventLog.args.tickUpper.toString(),
        owner: await this.etherscanService.getTxOwner(log.transactionHash),
        logIndex: log.logIndex,
        blockNumber: log.blockNumber,
        transactionHash: log.transactionHash,
      });
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (e) {
      /* empty */
    }
  }

  private extractSwapLog(log: ParsedEtherscanLog): Swap | undefined {
    try {
      const eventLog = decodeEventLog({
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-expect-error
        topics: log.topics,
        data: <`0x${string}`>log.data,
        abi: parseAbi([swapEventSignature]),
      });
      return new Swap({
        amount0: eventLog.args.amount0.toString(),
        amount1: eventLog.args.amount1.toString(),
        tick: Number(eventLog.args.tick.toString()),
        sqrtPriceX96: eventLog.args.sqrtPriceX96.toString(),
        eventId: buildEventId(log.blockHash, log.logIndex),
        logIndex: log.logIndex,
        blockNumber: log.blockNumber,
        transactionHash: log.transactionHash,
      });
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (e) {
      /* empty */
    }
  }
}
