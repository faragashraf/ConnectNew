import { ErrorDto, FileParameter } from '../dto-shared';

export interface VwLtraTransTraficPrintIEnumerableCommonResponse {
    readonly isSuccess: boolean;
    errors: ErrorDto[] | undefined;
    data: VwLtraTransTraficPrint[] | undefined;
    totalCount: number;
    pageNumber: number;
    pageSize: number;
    readonly totalPages: number;
}


export interface VwLtraTransTraficPrintListCommonResponse {
    readonly isSuccess: boolean;
    errors: ErrorDto[] | undefined;
    data: VwLtraTransTraficPrint[] | undefined;
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


export interface VwLtraTransTraficPrint {
    transId: string | undefined;
    barcode: string | undefined;
    rlttBarcode: string | undefined;
    plateNumber: string | undefined;
    transDate: Date | undefined;
    companyName: string | undefined;
    plateNumberPrint: string | undefined;
    licenseDuration: number | undefined;
    replyLicenseFrom: string | undefined;
    vehicleBrand: string | undefined;
    yearOfManufacture: string | undefined;
    chassisNumber: string | undefined;
    engineNumber: string | undefined;
    modelBody: string | undefined;
    numberOfSeats: string | undefined;
    licensesNum: string | undefined;
    trafficUnitId: string | undefined;
    governorateId: string | undefined;
    carActivity: string | undefined;
    isPrint: boolean;
}


export interface LandTransportUploadDataFormRequest {
  file?: FileParameter;
}