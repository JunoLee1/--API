export interface CreateClubDto {
  name: string;
  countryId: number;
  ownerEmail?: string;
  businessRegNumber?: string;
  companyNumber?: string;
  vatNumber?: string;
}

export interface UpdateClubDto {
  name?: string;
  isActive?: boolean;
  isLite?: boolean;
  ownerEmail?: string;
  businessRegNumber?: string;
  companyNumber?: string;
  vatNumber?: string;
}
