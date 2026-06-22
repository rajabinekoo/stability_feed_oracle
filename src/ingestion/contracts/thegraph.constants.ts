import { ApiProperty } from '@nestjs/swagger';
import {
  Min,
  IsInt,
  IsString,
  IsOptional,
  IsEthereumAddress,
} from 'class-validator';

export interface IIngestionParams {
  pool: string;
  orderBy?: string;
  toBlock: number | string;
  fromBlock: number | string;
}

export class IngestionDto implements IIngestionParams {
  @ApiProperty({ required: false, type: Number })
  @IsInt()
  @Min(0)
  fromBlock: number;

  @ApiProperty({ required: false, type: Number })
  @IsInt()
  @Min(0)
  toBlock: number;

  @ApiProperty()
  @IsEthereumAddress()
  pool: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  orderBy?: string;
}

export const theGraphUniswapV3PoolUrl = (api: string) =>
  `https://gateway.thegraph.com/api/${api}/subgraphs/id/5zvR82QoaXYFyDEKLZ9t6v9adgnptxYpKpSbxtgVENFV`;

export const mintIngestionQuery = (params: IIngestionParams) => {
  return `
    query GetMints {
      mints(
        where: {pool: "${params.pool}", transaction_: {blockNumber_gte: ${params.fromBlock}, blockNumber_lte: ${params.toBlock}}}
        orderBy: ${params.orderBy || 'transaction__blockNumber'}
        orderDirection: asc
      ) {
        amount
        amount0
        amount1
        logIndex
        origin
        tickUpper
        tickLower
        timestamp
        transaction {
          id
          blockNumber
        }
      }
    }`;
};

export const burnIngestionQuery = (params: IIngestionParams) => {
  return `
    query GetBurns {
      burns(
        where: {pool: "${params.pool}", transaction_: {blockNumber_gte: ${params.fromBlock}, blockNumber_lte: ${params.toBlock}}}
        orderBy: ${params.orderBy || 'transaction__blockNumber'}
        orderDirection: asc
      ) {
        amount
        amount0
        amount1
        logIndex
        origin
        tickUpper
        tickLower
        timestamp
        transaction {
          id
          blockNumber
        }
      }
    }`;
};

export const swapIngestionQuery = (params: IIngestionParams) => {
  return `
    query GetSwaps {
      swaps(
        where: {pool: "${params.pool}", transaction_: {blockNumber_gte: ${params.fromBlock}, blockNumber_lte: ${params.toBlock}}}
        orderBy: ${params.orderBy || 'transaction__blockNumber'}
        orderDirection: desc
      ) {
        amount0
        amount1
        logIndex
        sqrtPriceX96
        tick
        timestamp
        transaction {
          id
          blockNumber
        }
      }
    }`;
};
