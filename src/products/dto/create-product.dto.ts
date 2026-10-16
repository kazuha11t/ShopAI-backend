import {
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  MinLength,
} from 'class-validator';

export class CreateProductDto {
  @IsString()
  @MinLength(1)
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsNumber()
  @Min(0)
  price: number;

  @IsOptional()
  @IsString()
  imageUrl?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  stock?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
