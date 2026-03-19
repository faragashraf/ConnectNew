import { ErrorDto } from '../dto-shared';

export interface SchemaListListCommonResponse {
    readonly isSuccess: boolean;
    errors: ErrorDto[] | undefined;
    data: SchemaList[] | undefined;
}


export interface SchemaList {
    schemA_NAME: string | undefined;
}


export interface SelectRequestModel {
    str: string | undefined;
    schema: string | undefined;
    selectedEnvironment: string | undefined;
}


export interface StringObjectDictionaryListCommonResponse {
    readonly isSuccess: boolean;
    errors: ErrorDto[] | undefined;
    data: { [key: string]: any; }[] | undefined;
}
