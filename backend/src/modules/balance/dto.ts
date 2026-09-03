export class LoadBalanceDto {
  @IsNumber()
  @IsPositive()
  amount: number;

  @IsString()
  @IsOptional()
  paymentMethod?: string;
}

export class CreateBalanceDto {
  @IsNumber()
  @IsPositive()
  amount: number;
}