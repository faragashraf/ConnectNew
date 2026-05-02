import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import {
  AttachmentList,
  DocumentRespPagedResult,
  ExpressionDto,
  FileContentResp,
  Menu_ItemResp,
  ObjectResponse,
  SaveDocumentResp
} from 'src/app/shared/services/BackendServices/Publications/Publications.dto';
import { PublicationsController } from 'src/app/shared/services/BackendServices/Publications/Publications.service';
import { FileParameter } from 'src/app/shared/services/BackendServices/dto-shared';

@Injectable()
export class PublicationNewApiService {
  constructor(private readonly publicationsController: PublicationsController) { }

  getAdminDocuments(pageNumber: number, pageSize: number): Observable<DocumentRespPagedResult> {
    const filters: ExpressionDto[] = [];
    return this.publicationsController.getDocumentsList_admin(pageNumber, pageSize, filters);
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
}
