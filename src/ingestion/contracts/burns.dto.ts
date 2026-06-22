export interface ITheGraphBurns {
  data: { burns: IBurnResDto[] };
  errors?: string[];
}

export interface IBurnResDto {
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
