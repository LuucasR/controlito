import { Module } from '@nestjs/common';

import { ServicesService } from './application/services.service';
import { ServicesController } from './services.controller';

@Module({
  controllers: [ServicesController],
  providers: [ServicesService],
})
export class ServicesModule {}
