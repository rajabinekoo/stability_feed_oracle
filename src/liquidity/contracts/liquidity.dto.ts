import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsNumber, IsString } from 'class-validator';
import JSBI from 'jsbi';

export interface TickData {
  index: number;
  liquidityNet: JSBI;
  liquidityGross: JSBI;
}

export interface LiquidityTick {
  tick: number;
  price: number;
  liquidityNet: bigint;
  liquidityGross: bigint;
}

export class LiquidityTickDTO {
  tick: number;
  price: number;
  liquidityNet: string;
  liquidityGross: string;

  static fromEntity(tick: LiquidityTick): LiquidityTickDTO {
    return {
      tick: tick.tick,
      price: tick.price,
      liquidityNet: tick.liquidityNet.toString(),
      liquidityGross: tick.liquidityGross.toString(),
    };
  }
}

export interface LSISAnalysisResult {
  lsisScore: number;
  maxImpactIncrease: number;
  sampleGridResults: ISampleGridResult[];
}

export interface ISampleGridResult {
  amountIn: string;
  baselinePriceImpact: number;
  impactIncreasePercent: number;
  counterfactualPriceImpact: number;
}

export class SimulateLSISDto {
  @ApiProperty()
  @IsNumber()
  assumedTick: number;

  @ApiProperty()
  @IsNumber()
  tickLower: number;

  @ApiProperty()
  @IsNumber()
  tickUpper: number;

  @ApiProperty()
  @IsString()
  liquidityAmount: string; // به صورت استرینگ دریافت می‌شود تا BigInt خطای سرریز ندهد

  @ApiProperty()
  @IsBoolean()
  zeroForOne: boolean;
}
