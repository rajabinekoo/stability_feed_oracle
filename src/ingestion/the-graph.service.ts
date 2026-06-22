import { lastValueFrom } from 'rxjs';
import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';

import { IMintResDto, ITheGraphMints } from './contracts/mints.dto';
import { IBurnResDto, ITheGraphBurns } from './contracts/burns.dto';
import { ISwapResDto, ITheGraphSwaps } from './contracts/swaps.dto';
import {
  IIngestionParams,
  mintIngestionQuery,
  burnIngestionQuery,
  swapIngestionQuery,
  theGraphUniswapV3PoolUrl,
} from './contracts/thegraph.constants';

@Injectable()
export class TheGraphService {
  private readonly theGraphUrl: string;
  private readonly headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer `,
  };

  constructor(
    private readonly httpService: HttpService,
    configService: ConfigService,
  ) {
    const apiKey = configService.getOrThrow<string>('THE_GRAPH_API_KEY');
    this.theGraphUrl = theGraphUniswapV3PoolUrl(apiKey);
    this.headers.Authorization += apiKey;
  }

  public async fetchMints(params: IIngestionParams): Promise<IMintResDto[]> {
    const query = mintIngestionQuery(params);
    const response = await lastValueFrom(
      this.httpService.post<ITheGraphMints>(
        this.theGraphUrl,
        { query },
        { headers: this.headers },
      ),
    );

    if (response.data.errors) {
      throw new Error(JSON.stringify(response.data.errors));
    }

    return response.data.data.mints;
  }

  public async fetchBurns(params: IIngestionParams): Promise<IBurnResDto[]> {
    const query = burnIngestionQuery(params);
    const response = await lastValueFrom(
      this.httpService.post<ITheGraphBurns>(
        this.theGraphUrl,
        { query },
        { headers: this.headers },
      ),
    );

    if (response.data.errors) {
      throw new Error(JSON.stringify(response.data.errors));
    }

    return response.data.data.burns;
  }

  public async fetchSwaps(params: IIngestionParams): Promise<ISwapResDto[]> {
    const query = swapIngestionQuery(params);
    const response = await lastValueFrom(
      this.httpService.post<ITheGraphSwaps>(
        this.theGraphUrl,
        { query },
        { headers: this.headers },
      ),
    );

    if (response.data.errors) {
      throw new Error(JSON.stringify(response.data.errors));
    }

    return response.data.data.swaps;
  }
}
