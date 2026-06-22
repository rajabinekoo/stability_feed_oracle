import { OnEvent } from '@nestjs/event-emitter';
import {
  Get,
  Body,
  Post,
  Query,
  HttpCode,
  HttpStatus,
  Controller,
  ParseIntPipe,
  ParseBoolPipe,
} from '@nestjs/common';

import { Action } from '../shared/schemas';
import { LiquidityTickDTO, SimulateLSISDto } from './contracts/liquidity.dto';
import { LiquidityRebuilderService } from './liquidity.service';

@Controller('liquidity')
export class LiquidityController {
  constructor(private readonly liquidityService: LiquidityRebuilderService) {}

  @Get('status')
  getStatus() {
    return this.liquidityService.getPoolStatus();
  }

  @Get('ticks')
  getAllTicks() {
    const ticks = this.liquidityService.getAllTicks();
    return ticks.map((t) => LiquidityTickDTO.fromEntity(t));
  }

  @Get('range')
  getTicksInRange(
    @Query('minTick', ParseIntPipe) minTick: number,
    @Query('maxTick', ParseIntPipe) maxTick: number,
  ) {
    const ticks = this.liquidityService.getTicksInRange(minTick, maxTick);
    return ticks.map((t) => LiquidityTickDTO.fromEntity(t));
  }

  @Get('price-impact')
  calculatePriceImpact(
    @Query('amount') amount: string,
    @Query('isToken0') isToken0: string,
    @Query('tick') tick?: string,
  ) {
    const amountBigInt = BigInt(amount);
    const isToken0Bool = isToken0 === 'true';
    const currentTick = tick ? parseInt(tick) : undefined;

    return this.liquidityService.calculatePriceImpact(
      amountBigInt,
      isToken0Bool,
      currentTick,
    );
  }

  @Get('current')
  getCurrentTick() {
    return {
      currentTick: this.liquidityService.getCurrentTick(),
      currentPrice: this.liquidityService.tickToPrice(
        this.liquidityService.getCurrentTick(),
      ),
    };
  }

  @Get('analyze/lsis')
  analyzeLSIS(
    @Query('tickLower') tickLower: string,
    @Query('tickUpper') tickUpper: string,
    @Query('liquidity') liquidity: string,
    @Query('zeroForOne', new ParseBoolPipe({ optional: true }))
    zeroForOne: boolean,
  ) {
    return this.liquidityService.performAutoSILSAnalysis(
      parseInt(tickLower),
      parseInt(tickUpper),
      BigInt(liquidity),
      zeroForOne || false,
    );
  }

  @Post('simulate/lsis')
  @HttpCode(HttpStatus.OK)
  simulateLSIS(@Body() payload: SimulateLSISDto) {
    return this.liquidityService.simulateLSISAtTick(
      payload.assumedTick,
      payload.tickLower,
      payload.tickUpper,
      BigInt(payload.liquidityAmount),
      payload.zeroForOne,
    );
  }

  @Post('simulate/tvl-baseline')
  @HttpCode(HttpStatus.OK)
  simulateTVLBaseline(@Body() payload: SimulateLSISDto) {
    return this.liquidityService.simulateTVLBaselineAtTick(
      payload.assumedTick,
      payload.tickLower,
      payload.tickUpper,
      BigInt(payload.liquidityAmount),
    );
  }

  @OnEvent('actions.indexed')
  handleActionIndexedEvent(payload: Action[]) {
    for (const action of payload) {
      this.liquidityService.handleNewEvent(action);
    }
  }

  @OnEvent('swap.update')
  async handleUpdateSwapEvent() {
    await this.liquidityService.loadCurrentState();
  }
}
