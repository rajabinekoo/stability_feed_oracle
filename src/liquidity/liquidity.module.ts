import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { LiquidityController } from './liquidity.controller';
import { LiquidityRebuilderService } from './liquidity.service';
import { Action, ActionSchema, Swap, SwapSchema } from '../shared/schemas';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Swap.name, schema: SwapSchema },
      { name: Action.name, schema: ActionSchema },
    ]),
  ],
  controllers: [LiquidityController],
  providers: [LiquidityRebuilderService],
})
export class LiquidityModule {}
