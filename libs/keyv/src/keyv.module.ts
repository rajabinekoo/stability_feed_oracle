import { Global, Module } from '@nestjs/common';
import { KeyvService } from './keyv.service';

@Global()
@Module({
  providers: [KeyvService],
  exports: [KeyvService],
})
export class KeyvModule {}
