export interface CreateClubDto {
  name: string;
}

export interface UpdateClubDto {
  name?: string;
  isActive?: boolean;
  isLite?: boolean;
}
