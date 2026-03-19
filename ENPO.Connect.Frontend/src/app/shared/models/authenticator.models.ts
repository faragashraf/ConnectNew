export interface PairRequestDto {
  userId: string;
  issuer: string;
  accountName: string;
}

export interface PairResponseDto {
  pairingId: string;
  issuer: string;
  accountName: string;
  secretBase32: string;
  manualEntryKey: string;
  otpauthUri: string;
  qrCodePngBase64: string;
  createdAtUtc: string;
}

export interface TotpValidateRequest {
  userId: string;
  issuer: string;
  pin: string;      // 6 digits string
  pairingId: number;
}

export interface TotpValidateResponse {
  isValid: boolean;
  userId: string;
  issuer: string;
  enrollmentId: number | null;
  validatedAtUtc: string | null;
  reason: string | null;
}

export interface ToggleResponse {
  isEnabled: boolean;
  userId: string;
  issuer: string;
  reason: string | null;
}