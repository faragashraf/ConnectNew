import { ErrorDto, FileParameter } from '../dto-shared';

export interface CdmendDtoIEnumerableCommonResponse {
    readonly isSuccess: boolean;
    errors: ErrorDto[] | undefined;
    data: CdmendDto[] | undefined;
    totalCount: number;
    pageNumber: number;
    pageSize: number;
    readonly totalPages: number;
}


export interface CdCategoryMandDtoIEnumerableCommonResponse {
    readonly isSuccess: boolean;
    errors: ErrorDto[] | undefined;
    data: CdCategoryMandDto[] | undefined;
    totalCount: number;
    pageNumber: number;
    pageSize: number;
    readonly totalPages: number;
}


export interface CdcategoryDtoIEnumerableCommonResponse {
    readonly isSuccess: boolean;
    errors: ErrorDto[] | undefined;
    data: CdcategoryDto[] | undefined;
    totalCount: number;
    pageNumber: number;
    pageSize: number;
    readonly totalPages: number;
}


export interface TkmendField {
    fildSql: number;
    fildRelted: number;
    fildKind: string | undefined;
    fildTxt: string | undefined;
    instanceGroupId: number | undefined;
    mendSql: number | undefined;
    mendCategory: number | undefined;
    mendStat: boolean | undefined;
    mendGroup: number | undefined;
    applicationId: string | undefined;
    groupName: string | undefined;
    isExtendable: boolean | undefined;
    groupWithInRow: number | undefined;
}


export interface MessageDtoCommonResponse {
    readonly isSuccess: boolean;
    errors: ErrorDto[] | undefined;
    data: MessageDto;
    totalCount: number;
    pageNumber: number;
    pageSize: number;
    readonly totalPages: number;
}


export interface ListRequestModel {
    pageNumber: number;
    pageSize: number;
    status: number;
    categoryCd: number;
    type: number;
    requestedData: RequestedData;
    search: Search;
}


export interface MessageDtoIEnumerableCommonResponse {
    readonly isSuccess: boolean;
    errors: ErrorDto[] | undefined;
    data: MessageDto[] | undefined;
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


export interface CdmendDto {
    cdmendSql: number;
    cdmendType: string | undefined;
    cdmendTxt: string | undefined;
    cdMendLbl: string | undefined;
    placeholder: string | undefined;
    defaultValue: string | undefined;
    cdmendTbl: string | undefined;
    cdmendDatatype: string | undefined;
    required: boolean | undefined;
    requiredTrue: boolean | undefined;
    email: boolean | undefined;
    pattern: boolean | undefined;
    min: number | undefined;
    max: number | undefined;
    minxLenght: number | undefined;
    maxLenght: number | undefined;
    cdmendmask: string | undefined;
    cdmendStat: boolean;
    maxValue: string | undefined;
    minValue: string | undefined;
    width: number;
    height: number;
    isDisabledInit: boolean;
    isSearchable: boolean;
    applicationId: string | undefined;
}


export interface CdCategoryMandDto {
    mendSql: number;
    mendCategory: number;
    mendField: string | undefined;
    mendStat: boolean;
    mendGroup: number;
    applicationId: string | undefined;
    groupName: string | undefined;
    isExtendable: boolean | undefined;
    groupWithInRow: number | undefined;
}


export interface CdcategoryDto {
    catId: number;
    catParent: number;
    catName: string | undefined;
    catMend: string | undefined;
    catWorkFlow: number;
    catSms: boolean;
    catMailNotification: boolean;
    to: string | undefined;
    cc: string | undefined;
    applicationId: string | undefined;
}


export interface MessageDto {
    messageId: number;
    subject: string | undefined;
    description: string | undefined;
    status: MessageStatus;
    priority: Priority;
    createdBy: string | undefined;
    assignedSectorId: string | undefined;
    currentResponsibleSectorId: string | undefined;
    createdDate: Date;
    dueDate: Date | undefined;
    closedDate: Date | undefined;
    requestRef: string | undefined;
    type: number;
    categoryCd: number;
    fields: TkmendField[] | undefined;
    replies: ReplyDto[] | undefined;
    stockholders: MessageStockholder[] | undefined;
    attachments: AttchShipment[] | undefined;
}


export enum MessageStatus {
    جديد = 0,
    جاري_التنفيذ = 1,
    تم_الرد = 2,
    مرفوض = 3,
    تم_الطباعة = 4,
    الكل = 5,
}


export enum RequestedData {
    MyRequest = 0,
    Inbox = 1,
    Outbox = 2,
    Global = 3,
}


export interface Search {
    isSearch: boolean;
    searchKind: SearchKind;
    searchField: string | undefined;
    searchText: string | undefined;
    searchType: string | undefined;
}


export enum Priority {
    Low = 0,
    Medium = 1,
    High = 2,
    Critical = 3,
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


export interface MessageStockholder {
    messageStockholderId: number;
    messageId: number | undefined;
    stockholderId: number | undefined;
    partyType: string | undefined;
    sendDate: Date | undefined;
    receivedDate: Date | undefined;
    stockholderNotes: string | undefined;
    requiredResponse: boolean | undefined;
    status: number | undefined;
    dueDate: Date | undefined;
    repliedDate: Date | undefined;
    createdDate: Date | undefined;
    lastModifiedDate: Date | undefined;
}


export interface AttchShipment {
    id: number;
    attchId: number;
    attchImg: string | undefined;
    attchNm: string | undefined;
    applicationName: string | undefined;
    attcExt: string | undefined;
    attchSize: number | undefined;
}


export enum SearchKind {
    NoSearch = 0,
    NormalSearch = 1,
    LimitedSearch = 2,
    GlobalSearch = 3,
}


export interface AttchShipmentDto {
    id: number;
    attchId: number;
    attchNm: string | undefined;
    applicationName: string | undefined;
    attcExt: string | undefined;
    attchSize: number | undefined;
}


export interface DynamicFormCreateRequestFormRequest {
  messageId?: number;
  requestRef?: string;
  subject?: string;
  description?: string;
  createdBy?: string;
  assignedSectorId?: string;
  unitId?: number;
  currentResponsibleSectorId?: string;
  type?: number;
  categoryCd?: number;
  fields?: TkmendField[];
  files?: FileParameter[];
}