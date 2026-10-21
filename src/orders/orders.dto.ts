import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsIn, IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min, MinLength, ValidateNested } from 'class-validator';

class ItemDto {
  @IsInt() @Min(1)
  productId: number;
  @IsInt() @Min(1) @Max(99)
  quantity: number;
}

export class QuoteDto {
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(100)
  @ValidateNested({ each: true }) @Type(() => ItemDto)
  items: ItemDto[];
  @IsOptional() @IsIn(['SALE10', 'GIAM50K', 'FREESHIP'])
  voucherCode?: string;
}

export class CreateOrderDto extends QuoteDto {
  @IsInt() @Min(0) @Max(2147483647)
  expectedTotal: number;
  @IsString() @MinLength(16) @MaxLength(100)
  requestId: string;
  @IsString() @MinLength(2) @MaxLength(100)
  customerName: string;
  @IsString() @Matches(/^[0-9+\s]{9,20}$/)
  customerPhone: string;
  @IsString() @MinLength(5) @MaxLength(500)
  customerAddress: string;
}
