export interface ITheGraphMints {
  data: { mints: IMintResDto[] };
  errors?: string[];
}

export interface IMintResDto {
  amount: string;
  amount0: string;
  amount1: string;
  logIndex: string;
  origin: string;
  tickLower: string;
  tickUpper: string;
  transaction: {
    id: string;
    blockNumber: string;
  };
}
