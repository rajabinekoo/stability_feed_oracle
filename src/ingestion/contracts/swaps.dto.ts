export interface ITheGraphSwaps {
  data: { swaps: ISwapResDto[] };
  errors?: string[];
}

export interface ISwapResDto {
  amount0: string;
  amount1: string;
  logIndex: string;
  sqrtPriceX96: string;
  tick: string;
  transaction: {
    id: string;
    blockNumber: string;
  };
}
