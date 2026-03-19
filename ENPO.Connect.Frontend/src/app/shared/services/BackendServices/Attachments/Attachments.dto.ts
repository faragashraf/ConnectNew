import { ErrorDto, FileParameter } from '../dto-shared';

export interface AttchShipmentDtoIEnumerableCommonResponse {
    readonly isSuccess: boolean;
    errors: ErrorDto[] | undefined;
    data: AttchShipmentDto[] | undefined;
    totalCount: number;
    pageNumber: number;
    pageSize: number;
    readonly totalPages: number;
}


export interface ByteArrayCommonResponse {
    readonly isSuccess: boolean;
    errors: ErrorDto[] | undefined;
    data: string | undefined;
    totalCount: number;
    pageNumber: number;
    pageSize: number;
    readonly totalPages: number;
}


export interface ReplyCreateRequest {
    message: string | undefined;
    messageId: number;
    nextResponsibleSectorID: string | undefined;
    files: string[] | undefined;
}


export interface AttchShipmentDto {
    id: number;
    attchId: number;
    attchNm: string | undefined;
    applicationName: string | undefined;
    attcExt: string | undefined;
    attchSize: number | undefined;
}


export interface AttachmentsDocumentRecieveFormRequest {
  id?: string;
  file?: FileParameter;
}