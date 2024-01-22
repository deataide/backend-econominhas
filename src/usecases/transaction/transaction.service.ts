import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { UtilsAdapterService } from 'adapters/implementations/utils/utils.service';
import { UtilsAdapter } from 'adapters/utils';
import { BankRepository, BankUseCase } from 'models/bank';
import { BudgetRepository } from 'models/budget';
import { CategoryRepository } from 'models/category';
import type {
	GetByBudgetOutput,
	GetListInput,
	InOutInput,
	TransferInput,
} from 'models/transaction';
import { TransactionRepository, TransactionUseCase } from 'models/transaction';
import { BankRepositoryService } from 'repositories/postgres/bank/bank-repository.service';
import { BudgetRepositoryService } from 'repositories/postgres/budget/budget-repository.service';
import { CategoryRepositoryService } from 'repositories/postgres/category/category-repository.service';
import { TransactionRepositoryService } from 'repositories/postgres/transaction/transaction-repository.service';
import type { PaginatedItems } from 'types/paginated-items';
import { BankService } from 'usecases/bank/bank.service';

@Injectable()
export class TransactionService extends TransactionUseCase {
	constructor(
		@Inject(TransactionRepositoryService)
		private readonly transactionRepository: TransactionRepository,
		@Inject(BankRepositoryService)
		private readonly bankRepository: BankRepository,
		@Inject(BudgetRepositoryService)
		private readonly budgetRepository: BudgetRepository,
		@Inject(CategoryRepositoryService)
		private readonly categoryRepository: CategoryRepository,

		@Inject(BankService)
		private readonly bankService: BankUseCase,

		@Inject(UtilsAdapterService)
		private readonly utilsAdapter: UtilsAdapter,
	) {
		super();
	}

	async getList({
		accountId,
		budgetId,
		month,
		year,
		limit,
		page,
	}: GetListInput): Promise<PaginatedItems<GetByBudgetOutput>> {
		const { paging, ...pagParams } = this.utilsAdapter.pagination({
			limit,
			page,
		});

		const data = await this.transactionRepository.getByBudget({
			...pagParams,
			accountId,
			budgetId,
			month,
			year,
		});

		return {
			paging,
			data,
		};
	}

	async transfer({
		accountId,
		name,
		amount,
		bankAccountFromId,
		bankAccountToId,
		budgetDateId,
		description,
		createdAt,
	}: TransferInput): Promise<void> {
		const [bankAccounts, budgetDate] = await Promise.all([
			this.bankRepository.getManyById({
				bankAccountsIds: [bankAccountFromId, bankAccountToId],
				accountId,
			}),
			this.budgetRepository.getBudgetDateById({
				budgetDateId,
				accountId,
			}),
		]);

		const bankAccountFrom = bankAccounts.find(
			(b) => b.id === bankAccountFromId,
		);
		const bankAccountTo = bankAccounts.find((b) => b.id === bankAccountToId);

		if (!bankAccountFrom) {
			throw new BadRequestException('Invalid bankAccountFrom');
		}

		if (!bankAccountTo) {
			throw new BadRequestException('Invalid bankAccountTo');
		}

		if (!budgetDate) {
			throw new BadRequestException('Invalid budgetDate');
		}

		/**
		 * 1- First creates the bank account transfer,
		 * to ensure that the user has the necessary
		 * requirements to do this transaction
		 */
		await this.bankService.transfer({
			accountId,
			bankAccountFromId,
			bankAccountToId,
			amount,
		});

		/**
		 * 2- Then, creates the transaction
		 */
		await this.transactionRepository.createTransfer({
			accountId,
			name,
			amount,
			bankAccountFromId,
			bankAccountToId,
			budgetDateId,
			description,
			createdAt,
			isSystemManaged: false,
		});
	}

	async inOut({
		type,
		accountId,
		name,
		amount,
		categoryId,
		bankAccountId,
		budgetDateId,
		description,
		createdAt,
	}: InOutInput): Promise<void> {
		const [bankAccount, category, budgetDate] = await Promise.all([
			this.bankRepository.getById({
				bankAccountId,
				accountId,
			}),
			this.categoryRepository.getById({
				categoryId,
				accountId,
				active: true,
			}),
			this.budgetRepository.getBudgetDateById({
				budgetDateId,
				accountId,
			}),
		]);

		if (!bankAccount) {
			throw new BadRequestException('Invalid bankAccount');
		}

		if (!category) {
			throw new BadRequestException('Invalid category');
		}

		if (!budgetDate) {
			throw new BadRequestException('Invalid budgetDate');
		}

		/**
		 * 1- First adds/removes the funds to the bank account,
		 * to ensure that the user has the necessary
		 * requirements to do this transaction
		 */
		await this.bankService.inOut({
			type,
			accountId,
			bankAccountId,
			amount,
		});

		/**
		 * 2- Then, creates the transaction
		 */
		await this.transactionRepository.createInOut({
			type,
			accountId,
			name,
			amount,
			categoryId,
			bankAccountId,
			budgetDateId,
			description,
			createdAt,
			isSystemManaged: false,
		});
	}
}
