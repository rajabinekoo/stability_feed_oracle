import { lastValueFrom } from 'rxjs';
import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';

import { KeyvService } from '@app/keyv';
import { indexerTimeout } from './contracts/constants';
import {
  sleep,
  stringToHex,
  convertHexToUint,
  normalizeHexString,
} from '../shared/tools';
import {
  EventLogsReq,
  ParsedEtherscanLog,
  EtherscanGetLogsResult,
  EtherscanTransactionReceipt,
  EtherscanGetTransactionReceiptResult,
} from './contracts/etherscan';

@Injectable()
export class EtherscanService {
  private currentApiIndex = 0;

  constructor(
    private readonly keyvService: KeyvService,
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {}

  private getApi(): string {
    const apis =
      this.configService.getOrThrow<string>('ETHERSCAN_APIS')?.split(',') || [];
    return apis[this.currentApiIndex];
  }

  private changeApi(): void {
    const apis =
      this.configService.getOrThrow<string>('ETHERSCAN_APIS')?.split(',') || [];
    this.currentApiIndex++;
    if (this.currentApiIndex >= apis.length) {
      this.currentApiIndex = 0;
    }
  }

  public async getLatestBlockNumber(): Promise<number> {
    const chainId = this.configService.getOrThrow<number>('CHAIN_ID');
    const baseUrl = this.configService.getOrThrow<string>('ETHERSCAN_BASE_URL');

    const params = new URLSearchParams({
      module: 'proxy',
      action: 'eth_blockNumber',
      chainid: chainId.toString(),
      apikey: this.getApi(),
    });

    try {
      const resp = await lastValueFrom(
        this.httpService.get(`${baseUrl}?${params.toString()}`, {
          timeout: indexerTimeout,
        }),
      );
      this.changeApi();

      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const result: { result: string } = resp.data;
      return parseInt(result.result, 16);
    } catch (err) {
      this.changeApi();
      throw err;
    }
  }

  public async getTransactionReceipt(
    txhash: string,
  ): Promise<EtherscanTransactionReceipt> {
    const chainId = this.configService.getOrThrow<number>('CHAIN_ID');
    const baseUrl = this.configService.getOrThrow<string>('ETHERSCAN_BASE_URL');

    const params = new URLSearchParams({
      module: 'proxy',
      action: 'eth_getTransactionReceipt',
      chainid: chainId.toString(),
      apikey: this.getApi(),
      txhash: stringToHex(txhash),
    });

    try {
      const resp = await lastValueFrom(
        this.httpService.get<EtherscanGetTransactionReceiptResult>(
          `${baseUrl}?${params.toString()}`,
          {
            timeout: indexerTimeout,
          },
        ),
      );
      this.changeApi();

      return resp.data.result;
    } catch (err) {
      this.changeApi();
      throw err;
    }
  }

  public getLastSafeBlockNumber(blockNumber: number): number {
    const confirmationDepth =
      this.configService.getOrThrow<number>('CONFIRMATION_DEPTH');
    return blockNumber - confirmationDepth;
  }

  public async getReceiptsLogs(
    blockRange: EventLogsReq,
  ): Promise<[ParsedEtherscanLog[], ParsedEtherscanLog[]]> {
    const pendingLogs: ParsedEtherscanLog[] = [];
    const confirmedLogs: ParsedEtherscanLog[] = [];
    const chainId = this.configService.getOrThrow<number>('CHAIN_ID');
    const baseUrl = this.configService.getOrThrow<string>('ETHERSCAN_BASE_URL');
    const contractAddress = this.configService.getOrThrow<string>(
      'POOL_CONTRACT_ADDRESS',
    );

    let page = 1;
    const limit = 1000;

    while (true) {
      const params = new URLSearchParams({
        module: 'logs',
        action: 'getLogs',
        page: page.toString(),
        offset: limit.toString(),
        address: contractAddress,
        chainid: chainId.toString(),
        fromBlock: blockRange.fromBlock.toString(),
        toBlock: blockRange.toBlock.toString(),
        apikey: this.getApi(),
      });

      try {
        const resp = await lastValueFrom(
          this.httpService.get<EtherscanGetLogsResult>(
            `${baseUrl}?${params.toString()}`,
            { timeout: indexerTimeout },
          ),
        );
        this.changeApi();

        const result = resp.data;

        if (result.status === '0') {
          if (result.message.toLowerCase().includes('no records')) break;
          await sleep(500);
          continue;
        }

        if (!result.result || result.result.length === 0) break;

        for (const log of result.result) {
          const newLog: ParsedEtherscanLog = {
            data: log.data,
            topics: log.topics,
            gasUsed: log.gasUsed,
            gasPrice: log.gasPrice,
            blockHash: log.blockHash,
            transactionIndex: log.transactionIndex,
            address: normalizeHexString(log.address),
            transactionHash: log.transactionHash
              .toLowerCase()
              .replace(/^0x/, ''),
            blockNumber: convertHexToUint(log.blockNumber),
            logIndex: convertHexToUint(log.logIndex),
            timeStamp: convertHexToUint(log.timeStamp),
          };

          if (newLog.blockNumber > blockRange.safeBlock) {
            pendingLogs.push(newLog);
          } else {
            confirmedLogs.push(newLog);
          }
        }

        if (result.result.length < limit) break;

        page++;
        await sleep(200);
      } catch (e) {
        console.error(e);
        this.changeApi();
        await sleep(500);
      }
    }

    return [confirmedLogs, pendingLogs];
  }

  public async getTxOwner(txhash: string): Promise<string> {
    try {
      let from = await this.keyvService.getTransactionOwner(txhash);
      if (from) return from;
      const result = await this.getTransactionReceipt(txhash);
      from = normalizeHexString(result.from);
      await this.keyvService.setTransactionOwner(
        normalizeHexString(txhash),
        from,
      );
      return from;
    } catch (e) {
      this.changeApi();
      await sleep(500);
      throw e;
    }
  }
}
