import { Module } from '@nestjs/common';

import { CycleProjectorService } from './application/cycle-projector.service';
import { CyclesService } from './application/cycles.service';
import { CyclesController } from './cycles.controller';

@Module({
  controllers: [CyclesController],
  providers: [CyclesService, CycleProjectorService],
  exports: [CycleProjectorService],
})
export class CyclesModule {}
