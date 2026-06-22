import { Body, Controller, Post } from '@nestjs/common';

import { TheGraphService } from './the-graph.service';
import { IngestionService } from './ingestion.service';
import { IngestionDto } from './contracts/thegraph.constants';

@Controller('ingestion')
export class IngestionController {
  constructor(
    private readonly theGraphService: TheGraphService,
    private readonly ingestionService: IngestionService,
  ) {}

  @Post('mints')
  async fetchMints(@Body() data: IngestionDto) {
    return this.theGraphService.fetchMints(data);
  }

  @Post('burns')
  async fetchBurns(@Body() data: IngestionDto) {
    return this.theGraphService.fetchBurns(data);
  }

  @Post('swaps')
  async fetchSwaps(@Body() data: IngestionDto) {
    return this.theGraphService.fetchSwaps(data);
  }
}
