import { IsEnum, IsOptional, IsString } from 'class-validator';

export class AddAttachmentDto {
  @IsEnum(['image', 'video', 'document'])
  type: 'image' | 'video' | 'document';

  @IsOptional()
  @IsString()
  note?: string;
}
