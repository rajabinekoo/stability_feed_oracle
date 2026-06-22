import { Controller, Get } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';

@Controller()
@ApiExcludeController()
export class AppController {
  @Get()
  greeting() {
    return '<p>Stability Feed Oracle. Documentation is <a href="/docs">here</a></p>';
  }
}
