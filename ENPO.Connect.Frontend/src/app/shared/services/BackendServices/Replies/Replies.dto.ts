import { ErrorDto, FileParameter } from '../dto-shared';

export interface ReplyCreateRequest {
    message: string | undefined;
    messageId: number;
    nextResponsibleSectorID: string | undefined;
    files: string[] | undefined;
}


export interface ReplyCommonResponse {
    readonly isSuccess: boolean;
    errors: ErrorDto[] | undefined;
    data: Reply;
    totalCount: number;
    pageNumber: number;
    pageSize: number;
    readonly totalPages: number;
}


export interface ReplyDtoIEnumerableCommonResponse {
    readonly isSuccess: boolean;
    errors: ErrorDto[] | undefined;
    data: ReplyDto[] | undefined;
    totalCount: number;
    pageNumber: number;
    pageSize: number;
    readonly totalPages: number;
}


export interface Reply {
    replyId: number;
    messageId: number;
    message: string | undefined;
    authorId: string | undefined;
    nextResponsibleSectorId: string | undefined;
    createdDate: Date;
    ip: string | undefined;
}


export interface ReplyDto {
    replyId: number;
    messageId: number;
    message: string | undefined;
    authorId: string | undefined;
    authorName: string | undefined;
    nextResponsibleSectorId: string | undefined;
    createdDate: Date;
    attchShipmentDtos: AttchShipmentDto[] | undefined;
}


export interface AttchShipmentDto {
    id: number;
    attchId: number;
    attchNm: string | undefined;
    applicationName: string | undefined;
    attcExt: string | undefined;
    attchSize: number | undefined;
}


export interface RepliesReplyWithAttchmentFormRequest {
  message?: string;
  messageId?: number;
  nextResponsibleSectorID?: string;
  files?: FileParameter[];
}