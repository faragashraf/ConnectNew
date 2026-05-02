import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { CommonResponse } from 'src/app/shared/services/BackendServices/DynamicSubjects/DynamicSubjects.dto';
import { SubjectRoutingOrgUnitWithCountTreeNodeDto } from 'src/app/shared/services/BackendServices/DynamicSubjectsAdminRouting/DynamicSubjectsAdminRouting.dto';
import { DynamicSubjectsAdminRoutingController } from 'src/app/shared/services/BackendServices/DynamicSubjectsAdminRouting/DynamicSubjectsAdminRouting.service';
import {
  AttachmentList,
  DocumentRespPagedResult,
  EditActiveRequestDto,
  ExpressionDto,
  FileContentResp,
  Menu_ItemResp,
  ObjectResponse,
  SaveDocumentResp
} from 'src/app/shared/services/BackendServices/Publications/Publications.dto';
import { PublicationsController } from 'src/app/shared/services/BackendServices/Publications/Publications.service';
import { PowerBiController } from 'src/app/shared/services/BackendServices/PowerBi/PowerBi.service';
import { FileParameter, StringCommonResponse } from 'src/app/shared/services/BackendServices/dto-shared';

@Injectable()
export class PublicationNewApiService {
  constructor(
    private readonly publicationsController: PublicationsController,
    private readonly powerBiController: PowerBiController,
    private readonly dynamicSubjectsAdminRoutingController: DynamicSubjectsAdminRoutingController
  ) { }

  getAdminDocuments(
    pageNumber: number,
    pageSize: number,
    filters: ExpressionDto[] = []
  ): Observable<DocumentRespPagedResult> {
    return this.publicationsController.getDocumentsList_admin(pageNumber, pageSize, filters ?? []);
  }

  getUserDocuments(pageNumber: number, pageSize: number, filters: ExpressionDto[]): Observable<DocumentRespPagedResult> {
    return this.publicationsController.getDocumentsList_user(pageNumber, pageSize, filters ?? []);
  }

  getCriteria(funName: string): Observable<ObjectResponse> {
    return this.publicationsController.getCriteria(funName);
  }

  getAdminMenuItems(unitIds: number[]): Observable<Menu_ItemResp> {
    return this.publicationsController.getAdminMenuItems(unitIds);
  }

  getMenuItems(): Observable<Menu_ItemResp> {
    return this.publicationsController.getMenuItems();
  }

  saveDocument(
    workingStartDate: Date,
    miniDoc: string,
    districtId: number,
    publicationTypeId: number,
    allTextDoc: string,
    menuItemId: number,
    documentParentId: string,
    files: FileParameter[]
  ): Observable<SaveDocumentResp> {
    return this.publicationsController.saveDocument(
      0,
      workingStartDate,
      miniDoc,
      districtId,
      publicationTypeId,
      allTextDoc,
      menuItemId,
      documentParentId,
      '',
      [],
      files
    );
  }

  editDocument(
    documentId: number,
    workingStartDate: Date,
    miniDoc: string,
    districtId: number,
    publicationTypeId: number,
    allTextDoc: string,
    menuItemId: number,
    documentParentId: string,
    attachmentLists: AttachmentList[],
    files: FileParameter[]
  ): Observable<SaveDocumentResp> {
    return this.publicationsController.editDocument(
      documentId,
      workingStartDate,
      miniDoc,
      districtId,
      publicationTypeId,
      allTextDoc,
      menuItemId,
      documentParentId,
      '',
      attachmentLists,
      files
    );
  }

  getFileContent(attachmentId: number): Observable<FileContentResp> {
    return this.publicationsController.getFileContent(attachmentId);
  }

  editActivation(documentId: number, val: string): Observable<SaveDocumentResp> {
    const request: EditActiveRequestDto = {
      DOCUMENT_ID: documentId,
      Val: val
    };
    return this.publicationsController.editActivation(request);
  }

  executeMenuStatement(statementId: number, parameters: string): Observable<StringCommonResponse> {
    return this.powerBiController.excuteGenericStatmentById(statementId, parameters);
  }

  getInternalOrgUnitsTree(activeOnly = true): Observable<CommonResponse<SubjectRoutingOrgUnitWithCountTreeNodeDto[]>> {
    return this.dynamicSubjectsAdminRoutingController.getOracleUnitsWithCountTree(activeOnly);
  }
}
