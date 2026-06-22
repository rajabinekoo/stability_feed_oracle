import JSBI from 'jsbi';
import { Model } from 'mongoose';
import { InjectModel } from '@nestjs/mongoose';
import { ConfigService } from '@nestjs/config';
import { SwapMath, TickMath } from '@uniswap/v3-sdk';
import {
  Logger,
  Injectable,
  OnModuleInit,
  BadRequestException,
} from '@nestjs/common';

import { Action, Swap } from '../shared/schemas';
import {
  TickData,
  LiquidityTick,
  ISampleGridResult,
  LSISAnalysisResult,
} from './contracts/liquidity.dto';

@Injectable()
export class LiquidityRebuilderService implements OnModuleInit {
  private readonly logger = new Logger(LiquidityRebuilderService.name);

  private ticks: Map<number, TickData> = new Map();
  private sortedTickIndexes: number[] = [];
  private readonly poolFee: number;
  private isInitialized = false;

  private currentTick: number = 0;
  private currentLiquidity: JSBI = JSBI.BigInt(0);
  private currentSqrtPriceX96: JSBI = JSBI.BigInt(0);

  constructor(
    @InjectModel(Swap.name) private swapModel: Model<Swap>,
    @InjectModel(Action.name) private actionModel: Model<Action>,
    private readonly configService: ConfigService,
  ) {
    this.poolFee = Number(configService.getOrThrow<number>('POOL_FEE'));
  }

  async onModuleInit() {
    await this.rebuildLiquidityMap();
    await this.loadCurrentState();
    this.isInitialized = true;
  }

  private sortTicks() {
    this.sortedTickIndexes = Array.from(this.ticks.keys()).sort(
      (a, b) => a - b,
    );
  }

  private async rebuildLiquidityMap() {
    this.logger.log('Rebuilding liquidity map...');
    const actions = await this.actionModel
      .find(
        { event: { $in: ['mint', 'burn'] } },
        { tickLower: 1, tickUpper: 1, amount: 1, event: 1 },
      )
      .lean();

    this.ticks.clear();

    for (const action of actions) {
      const amount = JSBI.BigInt(action.amount);
      const isMint = action.event === 'mint';
      const liquidityDelta = isMint
        ? amount
        : JSBI.multiply(amount, JSBI.BigInt(-1));

      const lower = parseInt(action.tickLower);
      const upper = parseInt(action.tickUpper);

      this.updateTickData(lower, liquidityDelta, false);
      this.updateTickData(upper, liquidityDelta, true);
    }

    this.sortTicks();
    this.logger.log(
      `Liquidity map rebuilt with ${this.sortedTickIndexes.length} active ticks.`,
    );
  }

  private updateTickData(
    tickIndex: number,
    liquidityDelta: JSBI,
    isUpper: boolean,
  ) {
    let data = this.ticks.get(tickIndex);
    if (!data) {
      data = {
        index: tickIndex,
        liquidityNet: JSBI.BigInt(0),
        liquidityGross: JSBI.BigInt(0),
      };
      this.ticks.set(tickIndex, data);
    }

    const netDelta = isUpper
      ? JSBI.multiply(liquidityDelta, JSBI.BigInt(-1))
      : liquidityDelta;

    data.liquidityNet = JSBI.add(data.liquidityNet, netDelta);

    const absDelta = JSBI.lessThan(liquidityDelta, JSBI.BigInt(0))
      ? JSBI.multiply(liquidityDelta, JSBI.BigInt(-1))
      : liquidityDelta;
    data.liquidityGross = JSBI.add(data.liquidityGross, absDelta);

    if (JSBI.equal(data.liquidityGross, JSBI.BigInt(0))) {
      this.ticks.delete(tickIndex);
    }
  }

  private recalculateCurrentLiquidity() {
    let liquidity = JSBI.BigInt(0);
    for (const index of this.sortedTickIndexes) {
      if (index <= this.currentTick) {
        const tickData = this.ticks.get(index);
        if (tickData) {
          liquidity = JSBI.add(liquidity, tickData.liquidityNet);
        }
      } else {
        break;
      }
    }
    this.currentLiquidity = liquidity;
  }

  private getNextInitializedTickIndex(
    currentTick: number,
    zeroForOne: boolean,
    sortedIndexes: number[] = this.sortedTickIndexes,
  ): number {
    let low = 0;
    let high = sortedIndexes.length - 1;
    let result = zeroForOne ? TickMath.MIN_TICK : TickMath.MAX_TICK;

    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      if (zeroForOne) {
        if (sortedIndexes[mid] <= currentTick) {
          result = sortedIndexes[mid];
          low = mid + 1;
        } else {
          high = mid - 1;
        }
      } else {
        if (sortedIndexes[mid] > currentTick) {
          result = sortedIndexes[mid];
          high = mid - 1;
        } else {
          low = mid + 1;
        }
      }
    }
    return result;
  }

  private getPriceFromX96(sqrtPriceX96: JSBI): number {
    const Q96 = JSBI.exponentiate(JSBI.BigInt(2), JSBI.BigInt(96));
    const ratio =
      parseFloat(sqrtPriceX96.toString()) / parseFloat(Q96.toString());
    return ratio * ratio;
  }

  private mapToDto(data: TickData): LiquidityTick {
    return {
      tick: data.index,
      liquidityNet: BigInt(data.liquidityNet.toString()),
      liquidityGross: BigInt(data.liquidityGross.toString()),
      price: this.tickToPrice(data.index),
    };
  }

  public async loadCurrentState() {
    const lastSwap = await this.swapModel
      .findOne()
      .sort({ blockNumber: -1, logIndex: -1 });

    if (lastSwap) {
      this.currentTick = lastSwap.tick;
      this.currentSqrtPriceX96 = JSBI.BigInt(lastSwap.sqrtPriceX96);
    } else {
      this.currentTick = 0;
      this.currentSqrtPriceX96 = TickMath.getSqrtRatioAtTick(0);
    }

    this.recalculateCurrentLiquidity();
  }

  public handleNewEvent(event: Action): void {
    try {
      const amount = JSBI.BigInt(event.amount);
      const isMint = event.event === 'mint';
      const liquidityDelta = isMint
        ? amount
        : JSBI.multiply(amount, JSBI.BigInt(-1));

      const lower = parseInt(event.tickLower);
      const upper = parseInt(event.tickUpper);

      this.updateTickData(lower, liquidityDelta, false);
      this.updateTickData(upper, liquidityDelta, true);

      this.sortTicks();

      if (lower <= this.currentTick && upper > this.currentTick) {
        this.recalculateCurrentLiquidity();
      }

      this.logger.log(`Processed ${event.event} event. Index updated.`);
    } catch (error) {
      this.logger.error('Error handling new event:', error);
    }
  }

  public getPoolStatus() {
    return {
      tickCount: this.sortedTickIndexes.length,
      currentTick: this.currentTick,
      totalLiquidity: this.currentLiquidity.toString(),
      isInitialized: this.isInitialized,
    };
  }

  public getAllTicks(): LiquidityTick[] {
    return this.sortedTickIndexes.map((index) =>
      this.mapToDto(this.ticks.get(index)!),
    );
  }

  public getTicksInRange(minTick: number, maxTick: number): LiquidityTick[] {
    return this.sortedTickIndexes
      .filter((index) => index >= minTick && index <= maxTick)
      .map((index) => this.mapToDto(this.ticks.get(index)!));
  }

  public getCurrentTick(): number {
    return this.currentTick;
  }

  public tickToPrice(tick: number): number {
    // Price = 1.0001 ^ tick
    const sqrtRatioX96 = TickMath.getSqrtRatioAtTick(tick);
    const ratioX96 = JSBI.toNumber(sqrtRatioX96);
    const Q96 = 2 ** 96;
    return (ratioX96 / Q96) ** 2;
  }

  public getLiquidityAtTick(
    targetTick: number,
    ticksMap: Map<number, TickData> = this.ticks,
    sortedIndexes: number[] = this.sortedTickIndexes,
  ): JSBI {
    let liquidity = JSBI.BigInt(0);

    for (const index of sortedIndexes) {
      if (index <= targetTick) {
        const tickData = ticksMap.get(index);
        if (tickData) {
          liquidity = JSBI.add(liquidity, tickData.liquidityNet);
        }
      } else {
        break;
      }
    }

    return liquidity;
  }

  public calculatePriceImpact(
    amountIn: bigint,
    zeroForOne: boolean, // true: token0 -> token1 (Price will decrease), false: token1 -> token0 (Price will increase)
    overrideStartTick?: number,
  ): { priceImpact: number; newPrice: number; finalTick: number } {
    let currentTick = this.currentTick;
    let currentLiquidity = this.currentLiquidity;
    let currentSqrtPriceX96 = this.currentSqrtPriceX96;
    const poolFee = Number(this.configService.getOrThrow<number>('POOL_FEE'));

    if (
      overrideStartTick !== undefined &&
      overrideStartTick !== this.currentTick
    ) {
      currentTick = overrideStartTick;
      currentSqrtPriceX96 = TickMath.getSqrtRatioAtTick(overrideStartTick);
      currentLiquidity = this.getLiquidityAtTick(overrideStartTick);
    }

    const startPrice = this.getPriceFromX96(currentSqrtPriceX96);

    let amountRemaining = JSBI.BigInt(amountIn.toString());

    while (
      JSBI.greaterThan(amountRemaining, JSBI.BigInt(0)) &&
      JSBI.notEqual(currentSqrtPriceX96, JSBI.BigInt(0))
    ) {
      const nextTickIndex = this.getNextInitializedTickIndex(
        currentTick,
        zeroForOne,
      );
      const sqrtRatioTargetX96 = TickMath.getSqrtRatioAtTick(nextTickIndex);

      // [sqrtRatioNextX96, amountInStep, amountOutStep, feeAmount]
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const [sqrtRatioNextX96, amountInStep, _, feeAmount] =
        SwapMath.computeSwapStep(
          currentSqrtPriceX96,
          sqrtRatioTargetX96,
          currentLiquidity,
          amountRemaining,
          poolFee,
        );

      currentSqrtPriceX96 = sqrtRatioNextX96;

      amountRemaining = JSBI.subtract(
        amountRemaining,
        JSBI.add(amountInStep, feeAmount),
      );

      if (JSBI.equal(currentSqrtPriceX96, sqrtRatioTargetX96)) {
        const tickData = this.ticks.get(nextTickIndex);
        if (tickData) {
          let liquidityNet = tickData.liquidityNet;
          if (zeroForOne)
            liquidityNet = JSBI.multiply(liquidityNet, JSBI.BigInt(-1));

          currentLiquidity = JSBI.add(currentLiquidity, liquidityNet);
        }
        currentTick = zeroForOne ? nextTickIndex - 1 : nextTickIndex;
      } else {
        currentTick = TickMath.getTickAtSqrtRatio(currentSqrtPriceX96);
      }
    }

    const finalPrice = this.getPriceFromX96(currentSqrtPriceX96);
    const priceImpact = (finalPrice - startPrice) / startPrice;

    return {
      priceImpact,
      newPrice: finalPrice,
      finalTick: currentTick,
    };
  }

  public calculateLSIS(
    lpTickLower: number,
    lpTickUpper: number,
    lpLiquidityAmount: bigint,
    sampleGrid: bigint[],
    zeroForOne: boolean,
  ): LSISAnalysisResult {
    const amountJSBI = JSBI.BigInt(lpLiquidityAmount.toString());

    const gridResults: ISampleGridResult[] = [];
    let totalImpactIncrease = 0;
    let maxIncrease = 0;

    for (const amountIn of sampleGrid) {
      const amountInJSBI = JSBI.BigInt(amountIn.toString());

      const baseline = this.computeSwapImpactPure(
        amountInJSBI,
        zeroForOne,
        this.currentTick,
        this.currentSqrtPriceX96,
        this.currentLiquidity,
        this.ticks,
        this.sortedTickIndexes,
      );

      let simulatedLiquidity = this.currentLiquidity;
      if (this.currentTick >= lpTickLower && this.currentTick < lpTickUpper) {
        simulatedLiquidity = JSBI.subtract(simulatedLiquidity, amountJSBI);
      }

      const counterfactual = this.computeSwapImpactPure(
        amountInJSBI,
        zeroForOne,
        this.currentTick,
        this.currentSqrtPriceX96,
        simulatedLiquidity,
        this.ticks,
        this.sortedTickIndexes,
      );

      let increasePercent = 0;
      if (baseline.priceImpact > 0) {
        increasePercent =
          ((counterfactual.priceImpact - baseline.priceImpact) /
            baseline.priceImpact) *
          100;
      }

      increasePercent = Math.max(0, increasePercent);
      if (increasePercent > maxIncrease) maxIncrease = increasePercent;
      totalImpactIncrease += increasePercent;

      gridResults.push({
        amountIn: amountIn.toString(),
        baselinePriceImpact: baseline.priceImpact,
        counterfactualPriceImpact: counterfactual.priceImpact,
        impactIncreasePercent: increasePercent,
      });
    }

    return {
      lsisScore: totalImpactIncrease / sampleGrid.length,
      maxImpactIncrease: maxIncrease,
      sampleGridResults: gridResults,
    };
  }

  private computeSwapImpactPure(
    amountIn: JSBI,
    zeroForOne: boolean,
    startTick: number,
    startSqrtPriceX96: JSBI,
    startLiquidity: JSBI,
    ticksMap: Map<number, TickData>,
    sortedIndexes: number[],
  ) {
    let currentTick = startTick;
    let currentSqrtPriceX96 = startSqrtPriceX96;
    let currentLiquidity = startLiquidity;
    let amountRemaining = amountIn;

    const startPrice = this.getPriceFromX96(startSqrtPriceX96);

    while (
      JSBI.greaterThan(amountRemaining, JSBI.BigInt(0)) &&
      JSBI.notEqual(currentSqrtPriceX96, JSBI.BigInt(0))
    ) {
      const nextTickIndex = this.getNextInitializedTickIndex(
        currentTick,
        zeroForOne,
        sortedIndexes,
      );
      const sqrtRatioTargetX96 = TickMath.getSqrtRatioAtTick(nextTickIndex);

      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const [sqrtRatioNextX96, amountInStep, _, feeAmount] =
        SwapMath.computeSwapStep(
          currentSqrtPriceX96,
          sqrtRatioTargetX96,
          currentLiquidity,
          amountRemaining,
          this.poolFee,
        );

      currentSqrtPriceX96 = sqrtRatioNextX96;
      amountRemaining = JSBI.subtract(
        amountRemaining,
        JSBI.add(amountInStep, feeAmount),
      );

      if (JSBI.equal(currentSqrtPriceX96, sqrtRatioTargetX96)) {
        const tickData = ticksMap.get(nextTickIndex);
        if (tickData) {
          let liquidityNet = tickData.liquidityNet;
          if (zeroForOne)
            liquidityNet = JSBI.multiply(liquidityNet, JSBI.BigInt(-1));
          currentLiquidity = JSBI.add(currentLiquidity, liquidityNet);
        }
        currentTick = zeroForOne ? nextTickIndex - 1 : nextTickIndex;
      } else {
        currentTick = TickMath.getTickAtSqrtRatio(currentSqrtPriceX96);
      }
    }

    const finalPrice = this.getPriceFromX96(currentSqrtPriceX96);
    const priceImpact = Math.abs((finalPrice - startPrice) / startPrice);
    return { priceImpact, finalPrice };
  }

  private generateGridSamples(count: number = 5): bigint[] {
    const currentL = parseFloat(this.currentLiquidity.toString());

    if (currentL === 0) return [BigInt(1000000)];

    const samples: bigint[] = [];

    const minPercent = 0.0001; // 0.01%
    const maxPercent = 0.05; // 5%

    for (let i = 0; i < count; i++) {
      const percent =
        minPercent + (maxPercent - minPercent) * (i / (count - 1));
      const sampleAmount = BigInt(Math.floor(currentL * percent));
      if (sampleAmount > 0n) samples.push(sampleAmount);
    }

    return samples;
  }

  public performAutoSILSAnalysis(
    lpTickLower: number,
    lpTickUpper: number,
    lpLiquidityAmount: bigint,
    zeroForOne: boolean,
  ): LSISAnalysisResult {
    const autoSamples = this.generateGridSamples();
    return this.calculateLSIS(
      lpTickLower,
      lpTickUpper,
      lpLiquidityAmount,
      autoSamples,
      zeroForOne,
    );
  }

  public simulateLSISAtTick(
    assumedTick: number,
    lpTickLower: number,
    lpTickUpper: number,
    lpLiquidityAmount: bigint,
    zeroForOne: boolean,
  ): LSISAnalysisResult {
    const baseLiquidity = this.getLiquidityAtTick(assumedTick);
    const baseSqrtPriceX96 = TickMath.getSqrtRatioAtTick(assumedTick);
    const amountJSBI = JSBI.BigInt(lpLiquidityAmount.toString());

    if (JSBI.equal(baseLiquidity, JSBI.BigInt(0))) {
      throw new BadRequestException('No liquidity at the assumed tick.');
    }

    const sampleGrid = this.generateGridSamplesForLiquidity(
      baseLiquidity.toString(),
    );
    const gridResults: ISampleGridResult[] = [];
    let totalImpactIncrease = 0;
    let maxIncrease = 0;

    const counterfactualTicks = new Map(this.ticks); // Shallow Copy

    const lowerData = counterfactualTicks.get(lpTickLower);
    if (lowerData) {
      counterfactualTicks.set(lpTickLower, {
        ...lowerData,
        liquidityNet: JSBI.subtract(lowerData.liquidityNet, amountJSBI),
      });
    }

    const upperData = counterfactualTicks.get(lpTickUpper);
    if (upperData) {
      counterfactualTicks.set(lpTickUpper, {
        ...upperData,
        liquidityNet: JSBI.add(upperData.liquidityNet, amountJSBI),
      });
    }

    if (!lowerData || !upperData) {
      throw new BadRequestException('LP does not exist in tick map');
    }

    let simulatedLiquidity = baseLiquidity;
    if (assumedTick >= lpTickLower && assumedTick < lpTickUpper) {
      simulatedLiquidity = JSBI.subtract(simulatedLiquidity, amountJSBI);
    }

    for (const amountIn of sampleGrid) {
      const amountInJSBI = JSBI.BigInt(amountIn.toString());

      const baseline = this.computeSwapImpactPure(
        amountInJSBI,
        zeroForOne,
        assumedTick,
        baseSqrtPriceX96,
        baseLiquidity,
        this.ticks,
        this.sortedTickIndexes,
      );

      const counterfactual = this.computeSwapImpactPure(
        amountInJSBI,
        zeroForOne,
        assumedTick,
        baseSqrtPriceX96,
        simulatedLiquidity,
        counterfactualTicks,
        this.sortedTickIndexes,
      );

      let increasePercent = 0;
      if (baseline.priceImpact > 0) {
        increasePercent =
          ((counterfactual.priceImpact - baseline.priceImpact) /
            baseline.priceImpact) *
          100;
      }

      increasePercent = Math.max(0, increasePercent);
      if (increasePercent > maxIncrease) maxIncrease = increasePercent;
      totalImpactIncrease += increasePercent;

      gridResults.push({
        amountIn: amountIn.toString(),
        baselinePriceImpact: baseline.priceImpact,
        counterfactualPriceImpact: counterfactual.priceImpact,
        impactIncreasePercent: increasePercent,
      });
    }

    return {
      lsisScore: totalImpactIncrease / sampleGrid.length,
      maxImpactIncrease: maxIncrease,
      sampleGridResults: gridResults,
    };
  }

  public simulateTVLBaselineAtTick(
    assumedTick: number,
    lpTickLower: number,
    lpTickUpper: number,
    lpLiquidityAmount: bigint,
  ) {
    const baseLiquidity = this.getLiquidityAtTick(assumedTick);
    const amountJSBI = JSBI.BigInt(lpLiquidityAmount.toString());

    const isActive = assumedTick >= lpTickLower && assumedTick < lpTickUpper;

    let activeTvlSharePercent = 0;

    if (isActive && JSBI.greaterThan(baseLiquidity, JSBI.BigInt(0))) {
      const lpL = Number(amountJSBI.toString());
      const totalL = Number(baseLiquidity.toString());
      activeTvlSharePercent = (lpL / totalL) * 100;
    }

    return {
      baselineMethod: 'Static_TVL_Share',
      assumedTick,
      isActive,
      tvlScorePercent: activeTvlSharePercent,
    };
  }

  private generateGridSamplesForLiquidity(
    currentLStr: string,
    count: number = 5,
  ): bigint[] {
    const currentL = parseFloat(currentLStr);
    if (currentL === 0) return [BigInt(1000000)];

    const samples: bigint[] = [];
    const minPercent = 0.0001; // 0.01%
    const maxPercent = 0.05; // 5%

    for (let i = 0; i < count; i++) {
      const percent =
        minPercent + (maxPercent - minPercent) * (i / (count - 1));
      const sampleAmount = BigInt(Math.floor(currentL * percent));
      if (sampleAmount > 0n) samples.push(sampleAmount);
    }
    return samples;
  }
}
