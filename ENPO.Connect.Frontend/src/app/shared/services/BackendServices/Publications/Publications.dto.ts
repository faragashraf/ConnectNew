import { ErrorDto, FileParameter } from '../dto-shared';

export interface ExpressionDto {
    PropertyName: string | undefined;
    PropertyStringValue: string | undefined;
    PropertyIntValue: number;
    PropertyDateValue: Date | undefined;
}


export interface DocumentRespPagedResult {
    IsSuccess: boolean;
    ResponseDetails: ResponseDetail[] | undefined;
    TotalCount: number;
    Data: DocumentResp[] | undefined;
}


export interface ObjectResponse {
    readonly IsSuccess: boolean;
    Errors: ErrorDto[] | undefined;
    Data: any | undefined;
}


export interface AttachmentList {
    ATTACHMENT_ID: number;
    FILE_NAME: string | undefined;
    FILE_SIZE_BYTES: number;
}


export interface SaveDocumentResp {
    IsSuccess: boolean;
    ResponseDetails: ResponseDetail[] | undefined;
    Document_Number: string | undefined;
}


export interface FileContentResp {
    IsSuccess: boolean;
    ResponseDetails: ResponseDetail[] | undefined;
    FILE_CONTENT: string | undefined;
}


export interface EditActiveRequestDto {
    DOCUMENT_ID: number;
    Val: string;
}


export interface AttachmentStatusDto {
    ATTACHMENT_ID: number;
}


export interface SaveAttachmentResp {
    IsSuccess: boolean;
    ResponseDetails: ResponseDetail[] | undefined;
    ATTACHMENT_ID: number;
}


export interface AttachmentDto {
    DOC_ID: number;
    Description: string | undefined;
    files: string[] | undefined;
}


export interface DistrictsResp {
    readonly IsSuccess: boolean;
    Errors: ErrorDto[] | undefined;
    Data: District[] | undefined;
    TotalCount: number;
    PageNumber: number;
    PageSize: number;
}


export interface DistrictRequestDto {
    NameAr: string | undefined;
    NameEng: string | undefined;
    SECTOR_ID: number;
}


export interface SaveDistrictResp {
    IsSuccess: boolean;
    ResponseDetails: ResponseDetail[] | undefined;
}


export interface PublicationTypeResp {
    readonly IsSuccess: boolean;
    Errors: ErrorDto[] | undefined;
    Data: PublicationType[] | undefined;
    TotalCount: number;
    PageNumber: number;
    PageSize: number;
}


export interface PublicationTypeRequestDto {
    NameAr: string | undefined;
    NameEng: string | undefined;
}


export interface SavePublicationTypeResp {
    IsSuccess: boolean;
    ResponseDetails: ResponseDetail[] | undefined;
}


export interface Menu_ItemResp {
    readonly IsSuccess: boolean;
    Errors: ErrorDto[] | undefined;
    Data: PUB_MENU_ITEMS[] | undefined;
}


export interface MenuItemReq {
    MENU_ITEM_NAME: string | undefined;
    PARENT_MENU_ITEM_ID: number | undefined;
    APPLICATION: string | undefined;
    UNIT_ID: number;
}


export interface MenuItemResp {
    IsSuccess: boolean;
    ResponseDetails: ResponseDetail[] | undefined;
}


export interface ResponseDetail {
    responseCode: number;
    responseMessage: string | undefined;
}


export interface DocumentResp {
    DocumentId: number;
    DOCUMENT_NUMBER: string | undefined;
    MINI_DOC: string | undefined;
    ALL_TEXT_DOC: string | undefined;
    SectorName: string | undefined;
    DistrictName: string | undefined;
    DocumentType: string | undefined;
    VAL: string | undefined;
    Application: string | undefined;
    WORKING_START_DATE: Date | undefined;
    DISTRICT_ID: number | undefined;
    PUBLICATION_TYPE_ID: number | undefined;
    DOCUMENT_PARENT_ID: string | undefined;
    MENUITEMID: number | undefined;
    CREATED_DATE: Date;
    PublicationTypeName: string | undefined;
    AttachmentList: AttachmentList[] | undefined;
}


export interface District {
    DistrictId: number;
    DistrictNameAr: string | undefined;
    LastModifiedDate: Date | undefined;
    DistrictEng: string | undefined;
    Isactive: string | undefined;
    SECTOR_ID: number;
    Sector: Sector;
    readonly Documents: Document[] | undefined;
}


export interface PublicationType {
    PublicationTypeId: number;
    PublicationTypeNameAr: string | undefined;
    LastModifiedDate: Date | undefined;
    PublicationTypeEng: string | undefined;
    Isactive: string | undefined;
    readonly Documents: Document[] | undefined;
}


export interface PUB_MENU_ITEMS {
    MENU_ITEM_ID: number;
    MENU_ITEM_NAME: string | undefined;
    PARENT_MENU_ITEM_ID: number | undefined;
    ParentMenuItem: PUB_MENU_ITEMS;
    ISACTIVE: boolean;
    CREATED_DATE: Date;
    APPLICATION: string | undefined;
    UNIT_ID: number;
    Children: PUB_MENU_ITEMS[] | undefined;
    Documents: Document[] | undefined;
}


export interface DocumentType {
    DocumentTypeId: number;
    DocumentTypeNameAr: string | undefined;
    LastModifiedDate: Date | undefined;
    DocumentTypeEng: string | undefined;
    Isactive: string | undefined;
    readonly Documents: Document[] | undefined;
}


export interface Sector {
    SectorId: number;
    SectorNameAr: string | undefined;
    LastModifiedDate: Date | undefined;
    SectorNameEng: string | undefined;
    Isactive: string | undefined;
    readonly Documents: Document[] | undefined;
    readonly Districts: District[] | undefined;
}


export interface Document {
    DOCUMENT_ID: number;
    DOCUMENT_NUMBER: string | undefined;
    LAST_MODIFIED_DATE: Date | undefined;
    ACTIVATION_DATE: Date | undefined;
    WORKING_START_DATE: Date | undefined;
    MINI_DOC: string | undefined;
    SECTOR_ID: number | undefined;
    DISTRICT_ID: number | undefined;
    DOCUMENT_TYPE_ID: number | undefined;
    VAL: string | undefined;
    FLAG: string | undefined;
    ALL_TEXT_DOC: string | undefined;
    REJECTREASON: string | undefined;
    MAIN_SERVICE_ID: number | undefined;
    SUB_SERVICE_ID: number | undefined;
    SERVICE_TYPE_ID: number | undefined;
    PUBLICATION_TYPE_ID: number | undefined;
    MODIFIED_USER_ID: string | undefined;
    CREATED_USER_ID: string | undefined;
    MENUITEMID: number | undefined;
    CREATED_DATE: Date;
    DOCUMENT_PARENT_ID: string | undefined;
    CATEGORY_ID: number | undefined;
    Category: Category;
    District: District;
    DocumentType: DocumentType;
    MainService: MainService;
    PublicationType: PublicationType;
    Sector: Sector;
    ServiceType: ServiceType;
    SubService: SubService;
    PUB_MENU_ITEMS: PUB_MENU_ITEMS;
    DOC_ATTACHMENTS: DOC_ATTACHMENT[] | undefined;
}


export interface Category {
    CategoryId: number;
    CategoryNameAr: string | undefined;
    LastModifiedDate: Date | undefined;
    CategoryNameEng: string | undefined;
    Isactive: string | undefined;
}


export interface MainService {
    MainServiceId: number;
    MainServiceNameAr: string | undefined;
    LastModifiedDate: Date | undefined;
    MainServiceEng: string | undefined;
    Isactive: string | undefined;
    readonly Documents: Document[] | undefined;
    readonly SubServices: SubService[] | undefined;
}


export interface ServiceType {
    ServiceTypeId: number;
    ServiceTypeNameAr: string | undefined;
    LastModifiedDate: Date | undefined;
    ServiceTypeEng: string | undefined;
    Isactive: string | undefined;
    readonly Documents: Document[] | undefined;
}


export interface SubService {
    SUB_SERVICE_ID: number;
    SubServiceNameAr: string | undefined;
    LastModifiedDate: Date | undefined;
    SubServiceEng: string | undefined;
    Isactive: string | undefined;
    MainServiceId: number | undefined;
    readonly Documents: Document[] | undefined;
    MainService: MainService;
}


export interface DOC_ATTACHMENT {
    ATTACHMENT_ID: number;
    DOC_ID: number | undefined;
    FILE_CONTENT: string | undefined;
    FILE_NAME: string | undefined;
    FILE_SIZE_BYTES: number;
    UPLOAD_DATE: Date;
    DESCRIPTION: string | undefined;
    ISACTIVE: boolean;
    Document: Document;
}


export interface PublicationsSaveDocumentFormRequest {
  dOCUMENT_ID?: number;
  wORKING_START_DATE?: Date;
  mINI_DOC?: string;
  dISTRICT_ID?: number;
  pUBLICATION_TYPE_ID?: number;
  aLL_TEXT_DOC?: string;
  mENUITEMID?: number;
  dOCUMENT_PARENT_ID?: string;
  rEJECTREASON?: string;
  attachmentLists?: AttachmentList[];
  files?: FileParameter[];
}

export interface PublicationsEditDocumentFormRequest {
  dOCUMENT_ID?: number;
  wORKING_START_DATE?: Date;
  mINI_DOC?: string;
  dISTRICT_ID?: number;
  pUBLICATION_TYPE_ID?: number;
  aLL_TEXT_DOC?: string;
  mENUITEMID?: number;
  dOCUMENT_PARENT_ID?: string;
  rEJECTREASON?: string;
  attachmentLists?: AttachmentList[];
  files?: FileParameter[];
}