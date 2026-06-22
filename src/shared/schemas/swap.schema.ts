import { HydratedDocument } from 'mongoose';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

export type SwapDocument = HydratedDocument<Swap>;

@Schema()
export class Swap {
  @Prop({ required: true, index: true, unique: true })
  eventId: string;

  @Prop({ required: true, type: Number })
  tick: number;

  @Prop({ required: true, type: String })
  amount0: string;

  @Prop({ required: true, type: String })
  amount1: string;

  @Prop({ required: true, type: String })
  sqrtPriceX96: string;

  @Prop({ required: true, type: Number, index: true })
  logIndex: number;

  @Prop({ required: true, type: Number, index: true })
  blockNumber: number;

  @Prop({ required: true, type: String })
  transactionHash: string;

  constructor(data: Partial<Swap>) {
    Object.assign(this, data);
  }
}

export const SwapSchema = SchemaFactory.createForClass(Swap);
