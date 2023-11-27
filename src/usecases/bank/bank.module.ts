import { Module } from '@nestjs/common';
import { BankService } from './bank.service';
import { UtilsAdapterImplementation } from 'src/adapters/implementations/utils.service';
import { BankRepositoryModule } from 'src/repositories/postgres/bank/bank-repository.module';
import { BankController } from 'src/delivery/bank.controller';

@Module({
	controllers: [BankController],
	imports: [BankRepositoryModule],
	providers: [BankService, UtilsAdapterImplementation],
	exports: [BankService],
})
export class BankModule {}
