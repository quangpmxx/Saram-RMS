import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';
import { Public } from './common/decorators/public.decorator';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  /** Health-check hạ tầng — không thuộc nghiệp vụ, phục vụ giám sát vận hành. */
  @Public()
  @Get()
  getHealth() {
    return this.appService.getHealth();
  }
}
