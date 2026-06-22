import { Controller } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

@Controller('indexer')
@ApiTags('indexer')
export class IndexerController {}
