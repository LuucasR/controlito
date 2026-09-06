import { Module } from '@nestjs/common';

import { AlertsController } from '../alerts/alerts.controller';
import { InvoicesService } from './application/invoices.service';
import { InvoicesController } from './invoices.controller';

@Module({
  controllers: [InvoicesController, AlertsController],
  providers: [InvoicesService],
})
export class InvoicesModule {}
