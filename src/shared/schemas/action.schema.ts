import { HydratedDocument } from 'mongoose';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

export type ActionDocument = HydratedDocument<Action>;

export type ActionEvent = 'mint' | 'burn';

@Schema()
export class Action {
  @Prop({ required: true, index: true, unique: true })
  eventId: string;

  @Prop({ required: true, type: String, index: true })
  event: ActionEvent;

  @Prop({ required: true, type: String, index: true })
  owner: string;

  @Prop({ required: true, type: String })
  amount: string;

  @Prop({ required: true, type: String })
  amount0: string;

  @Prop({ required: true, type: String })
  amount1: string;

  @Prop({ required: true, type: String })
  tickUpper: string;

  @Prop({ required: true, type: String })
  tickLower: string;

  @Prop({ required: true, type: Number })
  logIndex: number;

  @Prop({ required: true, type: Number })
  blockNumber: number;

  @Prop({ required: true, type: String })
  transactionHash: string;

  constructor(data: Partial<Action>) {
    Object.assign(this, data);
  }
}

export const ActionSchema = SchemaFactory.createForClass(Action);
