// Auto-generated combined DTO shapes
export const DTO_SHAPES: any = {
  "__methodParamMap": {
    "getAllRequests": [
      {
        "raw": "body: ListRequestModel | undefined",
        "name": "body",
        "type": "ListRequestModel",
        "isBody": true,
        "isArray": false
      }
    ],
    "getCommingRequests": [
      {
        "raw": "body: ListRequestModel | undefined",
        "name": "body",
        "type": "ListRequestModel",
        "isBody": true,
        "isArray": false
      }
    ],
    "getOutBoxRequests": [
      {
        "raw": "body: ListRequestModel | undefined",
        "name": "body",
        "type": "ListRequestModel",
        "isBody": true,
        "isArray": false
      }
    ],
    "searsh": [
      {
        "raw": "body: ListRequestModel | undefined",
        "name": "body",
        "type": "ListRequestModel",
        "isBody": true,
        "isArray": false
      }
    ],
    "createNewFileds": [
      {
        "raw": "body: TkmendField[] | undefined",
        "name": "body",
        "type": "TkmendField[]",
        "isBody": true,
        "isArray": true
      }
    ],
    "editFields": [
      {
        "raw": "body: TkmendField[] | undefined",
        "name": "body",
        "type": "TkmendField[]",
        "isBody": true,
        "isArray": true
      }
    ],
    "updateStatus": [
      {
        "raw": "messageId: number | undefined",
        "name": "messageId",
        "type": "number",
        "isBody": false,
        "isArray": false
      },
      {
        "raw": "msgStatus: MessageStatus | undefined",
        "name": "msgStatus",
        "type": "MessageStatus",
        "isBody": false,
        "isArray": false
      }
    ],
    "getAreaDepartments": [
      {
        "raw": "areaName: string | undefined",
        "name": "areaName",
        "type": "string",
        "isBody": false,
        "isArray": false
      }
    ],
    "documentRecieve": [
      {
        "raw": "id: string | undefined",
        "name": "id",
        "type": "string",
        "isBody": false,
        "isArray": false
      },
      {
        "raw": "file: FileParameter | undefined",
        "name": "file",
        "type": "FileParameter",
        "isBody": false,
        "isArray": false
      }
    ],
    "getShipmentAttachment": [
      {
        "raw": "body: number[] | undefined",
        "name": "body",
        "type": "number[]",
        "isBody": true,
        "isArray": true
      }
    ],
    "downloadDocument": [
      {
        "raw": "id: number | undefined",
        "name": "id",
        "type": "number",
        "isBody": false,
        "isArray": false
      }
    ],
    "getMandatoryMetaDate": [
      {
        "raw": "appId: string | undefined",
        "name": "appId",
        "type": "string",
        "isBody": false,
        "isArray": false
      }
    ],
    "getMandatoryAll": [
      {
        "raw": "appId: string | undefined",
        "name": "appId",
        "type": "string",
        "isBody": false,
        "isArray": false
      }
    ],
    "getAllCategories": [
      {
        "raw": "appId: string | undefined",
        "name": "appId",
        "type": "string",
        "isBody": false,
        "isArray": false
      }
    ],
    "createRequest": [
      {
        "raw": "messageId: number | undefined",
        "name": "messageId",
        "type": "number",
        "isBody": false,
        "isArray": false
      },
      {
        "raw": "requestRef: string | undefined",
        "name": "requestRef",
        "type": "string",
        "isBody": false,
        "isArray": false
      },
      {
        "raw": "subject: string | undefined",
        "name": "subject",
        "type": "string",
        "isBody": false,
        "isArray": false
      },
      {
        "raw": "description: string | undefined",
        "name": "description",
        "type": "string",
        "isBody": false,
        "isArray": false
      },
      {
        "raw": "createdBy: string | undefined",
        "name": "createdBy",
        "type": "string",
        "isBody": false,
        "isArray": false
      },
      {
        "raw": "assignedSectorId: string | undefined",
        "name": "assignedSectorId",
        "type": "string",
        "isBody": false,
        "isArray": false
      },
      {
        "raw": "unitId: number | undefined",
        "name": "unitId",
        "type": "number",
        "isBody": false,
        "isArray": false
      },
      {
        "raw": "currentResponsibleSectorId: string | undefined",
        "name": "currentResponsibleSectorId",
        "type": "string",
        "isBody": false,
        "isArray": false
      },
      {
        "raw": "type: number | undefined",
        "name": "type",
        "type": "number",
        "isBody": false,
        "isArray": false
      },
      {
        "raw": "categoryCd: number | undefined",
        "name": "categoryCd",
        "type": "number",
        "isBody": false,
        "isArray": false
      },
      {
        "raw": "fields: TkmendField[] | undefined",
        "name": "fields",
        "type": "TkmendField[]",
        "isBody": false,
        "isArray": true
      },
      {
        "raw": "files: FileParameter[] | undefined",
        "name": "files",
        "type": "FileParameter[]",
        "isBody": false,
        "isArray": true
      }
    ],
    "getCorrInbox": [
      {
        "raw": "body: ListRequestModel | undefined",
        "name": "body",
        "type": "ListRequestModel",
        "isBody": true,
        "isArray": false
      }
    ],
    "getCorrOutBox": [
      {
        "raw": "body: ListRequestModel | undefined",
        "name": "body",
        "type": "ListRequestModel",
        "isBody": true,
        "isArray": false
      }
    ],
    "getCorrMyRequest": [
      {
        "raw": "body: ListRequestModel | undefined",
        "name": "body",
        "type": "ListRequestModel",
        "isBody": true,
        "isArray": false
      }
    ],
    "getTransportationRequestsToPrint": [
      {
        "raw": "pageNumber: number | undefined",
        "name": "pageNumber",
        "type": "number",
        "isBody": false,
        "isArray": false
      },
      {
        "raw": "pageSize: number | undefined",
        "name": "pageSize",
        "type": "number",
        "isBody": false,
        "isArray": false
      }
    ],
    "updateRequestToPrintStatus": [
      {
        "raw": "barcode: string | undefined",
        "name": "barcode",
        "type": "string",
        "isBody": false,
        "isArray": false
      },
      {
        "raw": "plateNumber: string | undefined",
        "name": "plateNumber",
        "type": "string",
        "isBody": false,
        "isArray": false
      }
    ],
    "getLLTR_request": [
      {
        "raw": "barcode: string | undefined",
        "name": "barcode",
        "type": "string",
        "isBody": false,
        "isArray": false
      }
    ],
    "uploadData": [
      {
        "raw": "file: FileParameter | undefined",
        "name": "file",
        "type": "FileParameter",
        "isBody": false,
        "isArray": false
      }
    ],
    "schemaList": [],
    "selectStatment": [
      {
        "raw": "body: SelectRequestModel | undefined",
        "name": "body",
        "type": "SelectRequestModel",
        "isBody": true,
        "isArray": false
      }
    ],
    "updateStatement": [
      {
        "raw": "body: SelectRequestModel | undefined",
        "name": "body",
        "type": "SelectRequestModel",
        "isBody": true,
        "isArray": false
      }
    ],
    "getGenericDataById": [
      {
        "raw": "id: number | undefined",
        "name": "id",
        "type": "number",
        "isBody": false,
        "isArray": false
      },
      {
        "raw": "parameters: string | undefined",
        "name": "parameters",
        "type": "string",
        "isBody": false,
        "isArray": false
      }
    ],
    "excuteGenericStatmentById": [
      {
        "raw": "id: number | undefined",
        "name": "id",
        "type": "number",
        "isBody": false,
        "isArray": false
      },
      {
        "raw": "parameters: string | undefined",
        "name": "parameters",
        "type": "string",
        "isBody": false,
        "isArray": false
      }
    ],
    "getDocumentsList_admin": [
      {
        "raw": "pageNumber: number | undefined",
        "name": "pageNumber",
        "type": "number",
        "isBody": false,
        "isArray": false
      },
      {
        "raw": "pageSize: number | undefined",
        "name": "pageSize",
        "type": "number",
        "isBody": false,
        "isArray": false
      },
      {
        "raw": "body: ExpressionDto[] | undefined",
        "name": "body",
        "type": "ExpressionDto[]",
        "isBody": true,
        "isArray": true
      }
    ],
    "getDocumentsList_user": [
      {
        "raw": "pageNumber: number | undefined",
        "name": "pageNumber",
        "type": "number",
        "isBody": false,
        "isArray": false
      },
      {
        "raw": "pageSize: number | undefined",
        "name": "pageSize",
        "type": "number",
        "isBody": false,
        "isArray": false
      },
      {
        "raw": "body: ExpressionDto[] | undefined",
        "name": "body",
        "type": "ExpressionDto[]",
        "isBody": true,
        "isArray": true
      }
    ],
    "getCriteria": [
      {
        "raw": "funName: string | undefined",
        "name": "funName",
        "type": "string",
        "isBody": false,
        "isArray": false
      }
    ],
    "saveDocument": [
      {
        "raw": "dOCUMENT_ID: number | undefined",
        "name": "dOCUMENT_ID",
        "type": "number",
        "isBody": false,
        "isArray": false
      },
      {
        "raw": "wORKING_START_DATE: Date | undefined",
        "name": "wORKING_START_DATE",
        "type": "Date",
        "isBody": false,
        "isArray": false
      },
      {
        "raw": "mINI_DOC: string | undefined",
        "name": "mINI_DOC",
        "type": "string",
        "isBody": false,
        "isArray": false
      },
      {
        "raw": "dISTRICT_ID: number | undefined",
        "name": "dISTRICT_ID",
        "type": "number",
        "isBody": false,
        "isArray": false
      },
      {
        "raw": "pUBLICATION_TYPE_ID: number | undefined",
        "name": "pUBLICATION_TYPE_ID",
        "type": "number",
        "isBody": false,
        "isArray": false
      },
      {
        "raw": "aLL_TEXT_DOC: string | undefined",
        "name": "aLL_TEXT_DOC",
        "type": "string",
        "isBody": false,
        "isArray": false
      },
      {
        "raw": "mENUITEMID: number | undefined",
        "name": "mENUITEMID",
        "type": "number",
        "isBody": false,
        "isArray": false
      },
      {
        "raw": "dOCUMENT_PARENT_ID: string | undefined",
        "name": "dOCUMENT_PARENT_ID",
        "type": "string",
        "isBody": false,
        "isArray": false
      },
      {
        "raw": "rEJECTREASON: string | undefined",
        "name": "rEJECTREASON",
        "type": "string",
        "isBody": false,
        "isArray": false
      },
      {
        "raw": "attachmentLists: AttachmentList[] | undefined",
        "name": "attachmentLists",
        "type": "AttachmentList[]",
        "isBody": false,
        "isArray": true
      },
      {
        "raw": "files: FileParameter[] | undefined",
        "name": "files",
        "type": "FileParameter[]",
        "isBody": false,
        "isArray": true
      }
    ],
    "getFileContent": [
      {
        "raw": "attchmentId: number | undefined",
        "name": "attchmentId",
        "type": "number",
        "isBody": false,
        "isArray": false
      }
    ],
    "editDocument": [
      {
        "raw": "dOCUMENT_ID: number | undefined",
        "name": "dOCUMENT_ID",
        "type": "number",
        "isBody": false,
        "isArray": false
      },
      {
        "raw": "wORKING_START_DATE: Date | undefined",
        "name": "wORKING_START_DATE",
        "type": "Date",
        "isBody": false,
        "isArray": false
      },
      {
        "raw": "mINI_DOC: string | undefined",
        "name": "mINI_DOC",
        "type": "string",
        "isBody": false,
        "isArray": false
      },
      {
        "raw": "dISTRICT_ID: number | undefined",
        "name": "dISTRICT_ID",
        "type": "number",
        "isBody": false,
        "isArray": false
      },
      {
        "raw": "pUBLICATION_TYPE_ID: number | undefined",
        "name": "pUBLICATION_TYPE_ID",
        "type": "number",
        "isBody": false,
        "isArray": false
      },
      {
        "raw": "aLL_TEXT_DOC: string | undefined",
        "name": "aLL_TEXT_DOC",
        "type": "string",
        "isBody": false,
        "isArray": false
      },
      {
        "raw": "mENUITEMID: number | undefined",
        "name": "mENUITEMID",
        "type": "number",
        "isBody": false,
        "isArray": false
      },
      {
        "raw": "dOCUMENT_PARENT_ID: string | undefined",
        "name": "dOCUMENT_PARENT_ID",
        "type": "string",
        "isBody": false,
        "isArray": false
      },
      {
        "raw": "rEJECTREASON: string | undefined",
        "name": "rEJECTREASON",
        "type": "string",
        "isBody": false,
        "isArray": false
      },
      {
        "raw": "attachmentLists: AttachmentList[] | undefined",
        "name": "attachmentLists",
        "type": "AttachmentList[]",
        "isBody": false,
        "isArray": true
      },
      {
        "raw": "files: FileParameter[] | undefined",
        "name": "files",
        "type": "FileParameter[]",
        "isBody": false,
        "isArray": true
      }
    ],
    "editActivation": [
      {
        "raw": "body: EditActiveRequestDto | undefined",
        "name": "body",
        "type": "EditActiveRequestDto",
        "isBody": true,
        "isArray": false
      }
    ],
    "updateAttachmentStatus": [
      {
        "raw": "body: AttachmentStatusDto | undefined",
        "name": "body",
        "type": "AttachmentStatusDto",
        "isBody": true,
        "isArray": false
      }
    ],
    "uploadAttachmentPDF": [
      {
        "raw": "body: AttachmentDto | undefined",
        "name": "body",
        "type": "AttachmentDto",
        "isBody": true,
        "isArray": false
      }
    ],
    "getDistrictsList": [
      {
        "raw": "pageNumber: number | undefined",
        "name": "pageNumber",
        "type": "number",
        "isBody": false,
        "isArray": false
      },
      {
        "raw": "pageSize: number | undefined",
        "name": "pageSize",
        "type": "number",
        "isBody": false,
        "isArray": false
      }
    ],
    "saveDistrict": [
      {
        "raw": "body: DistrictRequestDto | undefined",
        "name": "body",
        "type": "DistrictRequestDto",
        "isBody": true,
        "isArray": false
      }
    ],
    "getPublicationTypeList": [
      {
        "raw": "pageNumber: number | undefined",
        "name": "pageNumber",
        "type": "number",
        "isBody": false,
        "isArray": false
      },
      {
        "raw": "pageSize: number | undefined",
        "name": "pageSize",
        "type": "number",
        "isBody": false,
        "isArray": false
      }
    ],
    "savePublicationType": [
      {
        "raw": "body: PublicationTypeRequestDto | undefined",
        "name": "body",
        "type": "PublicationTypeRequestDto",
        "isBody": true,
        "isArray": false
      }
    ],
    "getMenuItems": [],
    "getAdminMenuItems": [
      {
        "raw": "body: number[] | undefined",
        "name": "body",
        "type": "number[]",
        "isBody": true,
        "isArray": true
      }
    ],
    "addMenuItem": [
      {
        "raw": "body: MenuItemReq | undefined",
        "name": "body",
        "type": "MenuItemReq",
        "isBody": true,
        "isArray": false
      }
    ],
    "removeMenuItem": [
      {
        "raw": "menuItemId: number | undefined",
        "name": "menuItemId",
        "type": "number",
        "isBody": false,
        "isArray": false
      }
    ],
    "createReply": [
      {
        "raw": "body: ReplyCreateRequest | undefined",
        "name": "body",
        "type": "ReplyCreateRequest",
        "isBody": true,
        "isArray": false
      }
    ],
    "replyWithAttchment": [
      {
        "raw": "message: string | undefined",
        "name": "message",
        "type": "string",
        "isBody": false,
        "isArray": false
      },
      {
        "raw": "messageId: number | undefined",
        "name": "messageId",
        "type": "number",
        "isBody": false,
        "isArray": false
      },
      {
        "raw": "nextResponsibleSectorID: string | undefined",
        "name": "nextResponsibleSectorID",
        "type": "string",
        "isBody": false,
        "isArray": false
      },
      {
        "raw": "files: FileParameter[] | undefined",
        "name": "files",
        "type": "FileParameter[]",
        "isBody": false,
        "isArray": true
      }
    ],
    "getMessageReplies": [
      {
        "raw": "messageId: number | undefined",
        "name": "messageId",
        "type": "number",
        "isBody": false,
        "isArray": false
      }
    ]
  },
  "ListRequestModel": {
    "pageNumber": 0,
    "pageSize": 0,
    "status": {},
    "categoryCd": 0,
    "type": 0,
    "requestedData": {},
    "search": {
      "isSearch": false,
      "searchKind": {},
      "searchField": "",
      "searchText": "",
      "searchType": ""
    }
  },
  "MessageDtoIEnumerableCommonResponse": {
    "isSuccess": false,
    "errors": [
      {}
    ],
    "data": [
      {
        "messageId": 0,
        "subject": "",
        "description": "",
        "status": {},
        "priority": {},
        "createdBy": "",
        "assignedSectorId": "",
        "currentResponsibleSectorId": "",
        "createdDate": "",
        "dueDate": "",
        "closedDate": "",
        "requestRef": "",
        "type": 0,
        "categoryCd": 0,
        "fields": [
          {
            "fildSql": 0,
            "fildRelted": 0,
            "fildKind": "",
            "fildTxt": "",
            "instanceGroupId": 0,
            "mendSql": 0,
            "mendCategory": 0,
            "mendStat": false,
            "mendGroup": 0,
            "applicationId": "",
            "groupName": "",
            "isExtendable": false,
            "groupWithInRow": 0
          }
        ],
        "replies": [
          {
            "replyId": 0,
            "messageId": 0,
            "message": "",
            "authorId": "",
            "authorName": "",
            "nextResponsibleSectorId": "",
            "createdDate": "",
            "attchShipmentDtos": [
              {
                "id": 0,
                "attchId": 0,
                "attchNm": "",
                "applicationName": "",
                "attcExt": "",
                "attchSize": 0
              }
            ]
          }
        ],
        "stockholders": [
          {
            "messageStockholderId": 0,
            "messageId": 0,
            "stockholderId": 0,
            "partyType": "",
            "sendDate": "",
            "receivedDate": "",
            "stockholderNotes": "",
            "requiredResponse": false,
            "status": 0,
            "dueDate": "",
            "repliedDate": "",
            "createdDate": "",
            "lastModifiedDate": ""
          }
        ],
        "attachments": [
          {
            "id": 0,
            "attchId": 0,
            "attchImg": "",
            "attchNm": "",
            "applicationName": "",
            "attcExt": "",
            "attchSize": 0
          }
        ]
      }
    ],
    "totalCount": 0,
    "pageNumber": 0,
    "pageSize": 0,
    "totalPages": 0
  },
  "TkmendField": {
    "fildSql": 0,
    "fildRelted": 0,
    "fildKind": "",
    "fildTxt": "",
    "instanceGroupId": 0,
    "mendSql": 0,
    "mendCategory": 0,
    "mendStat": false,
    "mendGroup": 0,
    "applicationId": "",
    "groupName": "",
    "isExtendable": false,
    "groupWithInRow": 0
  },
  "TkmendFieldIEnumerableCommonResponse": {
    "isSuccess": false,
    "errors": [
      {}
    ],
    "data": [
      {
        "fildSql": 0,
        "fildRelted": 0,
        "fildKind": "",
        "fildTxt": "",
        "instanceGroupId": 0,
        "mendSql": 0,
        "mendCategory": 0,
        "mendStat": false,
        "mendGroup": 0,
        "applicationId": "",
        "groupName": "",
        "isExtendable": false,
        "groupWithInRow": 0
      }
    ],
    "totalCount": 0,
    "pageNumber": 0,
    "pageSize": 0,
    "totalPages": 0
  },
  "AdmCertDeptDtoIEnumerableCommonResponse": {
    "isSuccess": false,
    "errors": [
      {}
    ],
    "data": [
      {
        "departmentId": 0,
        "departmentName": "",
        "areaName": "",
        "userId": "",
        "departmentType": 0
      }
    ],
    "totalCount": 0,
    "pageNumber": 0,
    "pageSize": 0,
    "totalPages": 0
  },
  "ReplyCreateRequest": {
    "message": "",
    "messageId": 0,
    "nextResponsibleSectorID": "",
    "files": [
      ""
    ]
  },
  "Search": {
    "isSearch": false,
    "searchKind": {},
    "searchField": "",
    "searchText": "",
    "searchType": ""
  },
  "MessageDto": {
    "messageId": 0,
    "subject": "",
    "description": "",
    "status": {},
    "priority": {},
    "createdBy": "",
    "assignedSectorId": "",
    "currentResponsibleSectorId": "",
    "createdDate": "",
    "dueDate": "",
    "closedDate": "",
    "requestRef": "",
    "type": 0,
    "categoryCd": 0,
    "fields": [
      {
        "fildSql": 0,
        "fildRelted": 0,
        "fildKind": "",
        "fildTxt": "",
        "instanceGroupId": 0,
        "mendSql": 0,
        "mendCategory": 0,
        "mendStat": false,
        "mendGroup": 0,
        "applicationId": "",
        "groupName": "",
        "isExtendable": false,
        "groupWithInRow": 0
      }
    ],
    "replies": [
      {
        "replyId": 0,
        "messageId": 0,
        "message": "",
        "authorId": "",
        "authorName": "",
        "nextResponsibleSectorId": "",
        "createdDate": "",
        "attchShipmentDtos": [
          {
            "id": 0,
            "attchId": 0,
            "attchNm": "",
            "applicationName": "",
            "attcExt": "",
            "attchSize": 0
          }
        ]
      }
    ],
    "stockholders": [
      {
        "messageStockholderId": 0,
        "messageId": 0,
        "stockholderId": 0,
        "partyType": "",
        "sendDate": "",
        "receivedDate": "",
        "stockholderNotes": "",
        "requiredResponse": false,
        "status": 0,
        "dueDate": "",
        "repliedDate": "",
        "createdDate": "",
        "lastModifiedDate": ""
      }
    ],
    "attachments": [
      {
        "id": 0,
        "attchId": 0,
        "attchImg": "",
        "attchNm": "",
        "applicationName": "",
        "attcExt": "",
        "attchSize": 0
      }
    ]
  },
  "AdmCertDeptDto": {
    "departmentId": 0,
    "departmentName": "",
    "areaName": "",
    "userId": "",
    "departmentType": 0
  },
  "ReplyDto": {
    "replyId": 0,
    "messageId": 0,
    "message": "",
    "authorId": "",
    "authorName": "",
    "nextResponsibleSectorId": "",
    "createdDate": "",
    "attchShipmentDtos": [
      {
        "id": 0,
        "attchId": 0,
        "attchNm": "",
        "applicationName": "",
        "attcExt": "",
        "attchSize": 0
      }
    ]
  },
  "MessageStockholder": {
    "messageStockholderId": 0,
    "messageId": 0,
    "stockholderId": 0,
    "partyType": "",
    "sendDate": "",
    "receivedDate": "",
    "stockholderNotes": "",
    "requiredResponse": false,
    "status": 0,
    "dueDate": "",
    "repliedDate": "",
    "createdDate": "",
    "lastModifiedDate": ""
  },
  "AttchShipment": {
    "id": 0,
    "attchId": 0,
    "attchImg": "",
    "attchNm": "",
    "applicationName": "",
    "attcExt": "",
    "attchSize": 0
  },
  "AttchShipmentDto": {
    "id": 0,
    "attchId": 0,
    "attchNm": "",
    "applicationName": "",
    "attcExt": "",
    "attchSize": 0
  },
  "AttchShipmentDtoIEnumerableCommonResponse": {
    "isSuccess": false,
    "errors": [
      {}
    ],
    "data": [
      {
        "id": 0,
        "attchId": 0,
        "attchNm": "",
        "applicationName": "",
        "attcExt": "",
        "attchSize": 0
      }
    ],
    "totalCount": 0,
    "pageNumber": 0,
    "pageSize": 0,
    "totalPages": 0
  },
  "ByteArrayCommonResponse": {
    "isSuccess": false,
    "errors": [
      {}
    ],
    "data": "",
    "totalCount": 0,
    "pageNumber": 0,
    "pageSize": 0,
    "totalPages": 0
  },
  "AttachmentsDocumentRecieveFormRequest": {
    "id": "",
    "file": {}
  },
  "FileParameter": {
    "data": {},
    "fileName": ""
  },
  "ErrorDto": {
    "code": "",
    "message": ""
  },
  "StringCommonResponse": {
    "isSuccess": false,
    "errors": [
      {
        "code": "",
        "message": ""
      }
    ],
    "data": "",
    "totalCount": 0,
    "pageNumber": 0,
    "pageSize": 0,
    "totalPages": 0
  },
  "CdmendDtoIEnumerableCommonResponse": {
    "isSuccess": false,
    "errors": [
      {}
    ],
    "data": [
      {
        "cdmendSql": 0,
        "cdmendType": "",
        "cdmendTxt": "",
        "cdMendLbl": "",
        "placeholder": "",
        "defaultValue": "",
        "cdmendTbl": "",
        "cdmendDatatype": "",
        "required": false,
        "requiredTrue": false,
        "email": false,
        "pattern": false,
        "min": 0,
        "max": 0,
        "minxLenght": 0,
        "maxLenght": 0,
        "cdmendmask": "",
        "cdmendStat": false,
        "width": 0,
        "height": 0,
        "isDisabledInit": false,
        "isSearchable": false,
        "applicationId": ""
      }
    ],
    "totalCount": 0,
    "pageNumber": 0,
    "pageSize": 0,
    "totalPages": 0
  },
  "CdCategoryMandDtoIEnumerableCommonResponse": {
    "isSuccess": false,
    "errors": [
      {}
    ],
    "data": [
      {
        "mendSql": 0,
        "mendCategory": 0,
        "mendField": "",
        "mendStat": false,
        "mendGroup": 0,
        "applicationId": "",
        "groupName": "",
        "isExtendable": false,
        "groupWithInRow": 0
      }
    ],
    "totalCount": 0,
    "pageNumber": 0,
    "pageSize": 0,
    "totalPages": 0
  },
  "CdcategoryDtoIEnumerableCommonResponse": {
    "isSuccess": false,
    "errors": [
      {}
    ],
    "data": [
      {
        "catId": 0,
        "catParent": 0,
        "catName": "",
        "catMend": "",
        "catWorkFlow": 0,
        "catSms": false,
        "catMailNotification": false,
        "to": "",
        "cc": "",
        "applicationId": ""
      }
    ],
    "totalCount": 0,
    "pageNumber": 0,
    "pageSize": 0,
    "totalPages": 0
  },
  "MessageDtoCommonResponse": {
    "isSuccess": false,
    "errors": [
      {}
    ],
    "data": {
      "messageId": 0,
      "subject": "",
      "description": "",
      "status": {},
      "priority": {},
      "createdBy": "",
      "assignedSectorId": "",
      "currentResponsibleSectorId": "",
      "createdDate": "",
      "dueDate": "",
      "closedDate": "",
      "requestRef": "",
      "type": 0,
      "categoryCd": 0,
      "fields": [
        {
          "fildSql": 0,
          "fildRelted": 0,
          "fildKind": "",
          "fildTxt": "",
          "instanceGroupId": 0,
          "mendSql": 0,
          "mendCategory": 0,
          "mendStat": false,
          "mendGroup": 0,
          "applicationId": "",
          "groupName": "",
          "isExtendable": false,
          "groupWithInRow": 0
        }
      ],
      "replies": [
        {
          "replyId": 0,
          "messageId": 0,
          "message": "",
          "authorId": "",
          "authorName": "",
          "nextResponsibleSectorId": "",
          "createdDate": "",
          "attchShipmentDtos": [
            {
              "id": 0,
              "attchId": 0,
              "attchNm": "",
              "applicationName": "",
              "attcExt": "",
              "attchSize": 0
            }
          ]
        }
      ],
      "stockholders": [
        {
          "messageStockholderId": 0,
          "messageId": 0,
          "stockholderId": 0,
          "partyType": "",
          "sendDate": "",
          "receivedDate": "",
          "stockholderNotes": "",
          "requiredResponse": false,
          "status": 0,
          "dueDate": "",
          "repliedDate": "",
          "createdDate": "",
          "lastModifiedDate": ""
        }
      ],
      "attachments": [
        {
          "id": 0,
          "attchId": 0,
          "attchImg": "",
          "attchNm": "",
          "applicationName": "",
          "attcExt": "",
          "attchSize": 0
        }
      ]
    },
    "totalCount": 0,
    "pageNumber": 0,
    "pageSize": 0,
    "totalPages": 0
  },
  "CdmendDto": {
    "cdmendSql": 0,
    "cdmendType": "",
    "cdmendTxt": "",
    "cdMendLbl": "",
    "placeholder": "",
    "defaultValue": "",
    "cdmendTbl": "",
    "cdmendDatatype": "",
    "required": false,
    "requiredTrue": false,
    "email": false,
    "pattern": false,
    "min": 0,
    "max": 0,
    "minxLenght": 0,
    "maxLenght": 0,
    "cdmendmask": "",
    "cdmendStat": false,
    "width": 0,
    "height": 0,
    "isDisabledInit": false,
    "isSearchable": false,
    "applicationId": ""
  },
  "CdCategoryMandDto": {
    "mendSql": 0,
    "mendCategory": 0,
    "mendField": "",
    "mendStat": false,
    "mendGroup": 0,
    "applicationId": "",
    "groupName": "",
    "isExtendable": false,
    "groupWithInRow": 0
  },
  "CdcategoryDto": {
    "catId": 0,
    "catParent": 0,
    "catName": "",
    "catMend": "",
    "catWorkFlow": 0,
    "catSms": false,
    "catMailNotification": false,
    "to": "",
    "cc": "",
    "applicationId": ""
  },
  "DynamicFormCreateRequestFormRequest": {
    "messageId": 0,
    "requestRef": "",
    "subject": "",
    "description": "",
    "createdBy": "",
    "assignedSectorId": "",
    "unitId": 0,
    "currentResponsibleSectorId": "",
    "type": 0,
    "categoryCd": 0,
    "fields": [
      {
        "fildSql": 0,
        "fildRelted": 0,
        "fildKind": "",
        "fildTxt": "",
        "instanceGroupId": 0,
        "mendSql": 0,
        "mendCategory": 0,
        "mendStat": false,
        "mendGroup": 0,
        "applicationId": "",
        "groupName": "",
        "isExtendable": false,
        "groupWithInRow": 0
      }
    ],
    "files": [
      {}
    ]
  },
  "VwLtraTransTraficPrintIEnumerableCommonResponse": {
    "isSuccess": false,
    "errors": [
      {}
    ],
    "data": [
      {
        "transId": "",
        "barcode": "",
        "rlttBarcode": "",
        "plateNumber": "",
        "transDate": "",
        "companyName": "",
        "plateNumberPrint": "",
        "licenseDuration": 0,
        "replyLicenseFrom": "",
        "vehicleBrand": "",
        "yearOfManufacture": "",
        "chassisNumber": "",
        "engineNumber": "",
        "modelBody": "",
        "numberOfSeats": "",
        "licensesNum": "",
        "trafficUnitId": "",
        "governorateId": "",
        "carActivity": "",
        "isPrint": false
      }
    ],
    "totalCount": 0,
    "pageNumber": 0,
    "pageSize": 0,
    "totalPages": 0
  },
  "VwLtraTransTraficPrintListCommonResponse": {
    "isSuccess": false,
    "errors": [
      {}
    ],
    "data": [
      {
        "transId": "",
        "barcode": "",
        "rlttBarcode": "",
        "plateNumber": "",
        "transDate": "",
        "companyName": "",
        "plateNumberPrint": "",
        "licenseDuration": 0,
        "replyLicenseFrom": "",
        "vehicleBrand": "",
        "yearOfManufacture": "",
        "chassisNumber": "",
        "engineNumber": "",
        "modelBody": "",
        "numberOfSeats": "",
        "licensesNum": "",
        "trafficUnitId": "",
        "governorateId": "",
        "carActivity": "",
        "isPrint": false
      }
    ],
    "totalCount": 0,
    "pageNumber": 0,
    "pageSize": 0,
    "totalPages": 0
  },
  "VwLtraTransTraficPrint": {
    "transId": "",
    "barcode": "",
    "rlttBarcode": "",
    "plateNumber": "",
    "transDate": "",
    "companyName": "",
    "plateNumberPrint": "",
    "licenseDuration": 0,
    "replyLicenseFrom": "",
    "vehicleBrand": "",
    "yearOfManufacture": "",
    "chassisNumber": "",
    "engineNumber": "",
    "modelBody": "",
    "numberOfSeats": "",
    "licensesNum": "",
    "trafficUnitId": "",
    "governorateId": "",
    "carActivity": "",
    "isPrint": false
  },
  "LandTransportUploadDataFormRequest": {
    "file": {}
  },
  "SchemaListListCommonResponse": {
    "isSuccess": false,
    "errors": [
      {}
    ],
    "data": [
      {
        "schemA_NAME": ""
      }
    ]
  },
  "SchemaList": {
    "schemA_NAME": ""
  },
  "SelectRequestModel": {
    "str": "",
    "schema": "",
    "selectedEnvironment": ""
  },
  "StringObjectDictionaryListCommonResponse": {
    "isSuccess": false,
    "errors": [
      {}
    ],
    "data": {}
  },
  "ExpressionDto": {
    "PropertyName": "",
    "PropertyStringValue": "",
    "PropertyIntValue": 0,
    "PropertyDateValue": ""
  },
  "DocumentRespPagedResult": {
    "IsSuccess": false,
    "ResponseDetails": [
      {
        "responseCode": 0,
        "responseMessage": ""
      }
    ],
    "TotalCount": 0,
    "Data": [
      {
        "DocumentId": 0,
        "DOCUMENT_NUMBER": "",
        "MINI_DOC": "",
        "ALL_TEXT_DOC": "",
        "SectorName": "",
        "DistrictName": "",
        "DocumentType": "",
        "VAL": "",
        "Application": "",
        "WORKING_START_DATE": "",
        "DISTRICT_ID": 0,
        "PUBLICATION_TYPE_ID": 0,
        "DOCUMENT_PARENT_ID": "",
        "MENUITEMID": 0,
        "CREATED_DATE": "",
        "PublicationTypeName": "",
        "AttachmentList": [
          {
            "ATTACHMENT_ID": 0,
            "FILE_NAME": "",
            "FILE_SIZE_BYTES": 0
          }
        ]
      }
    ]
  },
  "ObjectResponse": {
    "IsSuccess": false,
    "Errors": [
      {}
    ],
    "Data": ""
  },
  "AttachmentList": {
    "ATTACHMENT_ID": 0,
    "FILE_NAME": "",
    "FILE_SIZE_BYTES": 0
  },
  "SaveDocumentResp": {
    "IsSuccess": false,
    "ResponseDetails": [
      {
        "responseCode": 0,
        "responseMessage": ""
      }
    ],
    "Document_Number": ""
  },
  "FileContentResp": {
    "IsSuccess": false,
    "ResponseDetails": [
      {
        "responseCode": 0,
        "responseMessage": ""
      }
    ],
    "FILE_CONTENT": ""
  },
  "EditActiveRequestDto": {
    "DOCUMENT_ID": 0,
    "Val": ""
  },
  "AttachmentStatusDto": {
    "ATTACHMENT_ID": 0
  },
  "SaveAttachmentResp": {
    "IsSuccess": false,
    "ResponseDetails": [
      {
        "responseCode": 0,
        "responseMessage": ""
      }
    ],
    "ATTACHMENT_ID": 0
  },
  "AttachmentDto": {
    "DOC_ID": 0,
    "Description": "",
    "files": [
      ""
    ]
  },
  "DistrictsResp": {
    "IsSuccess": false,
    "Errors": [
      {}
    ],
    "Data": [
      {
        "DistrictId": 0,
        "DistrictNameAr": "",
        "LastModifiedDate": "",
        "DistrictEng": "",
        "Isactive": "",
        "SECTOR_ID": 0,
        "Sector": {
          "SectorId": 0,
          "SectorNameAr": "",
          "LastModifiedDate": "",
          "SectorNameEng": "",
          "Isactive": "",
          "Documents": [
            {
              "DOCUMENT_ID": 0,
              "DOCUMENT_NUMBER": "",
              "LAST_MODIFIED_DATE": "",
              "ACTIVATION_DATE": "",
              "WORKING_START_DATE": "",
              "MINI_DOC": "",
              "SECTOR_ID": 0,
              "DISTRICT_ID": 0,
              "DOCUMENT_TYPE_ID": 0,
              "VAL": "",
              "FLAG": "",
              "ALL_TEXT_DOC": "",
              "REJECTREASON": "",
              "MAIN_SERVICE_ID": 0,
              "SUB_SERVICE_ID": 0,
              "SERVICE_TYPE_ID": 0,
              "PUBLICATION_TYPE_ID": 0,
              "MODIFIED_USER_ID": "",
              "CREATED_USER_ID": "",
              "MENUITEMID": 0,
              "CREATED_DATE": "",
              "DOCUMENT_PARENT_ID": "",
              "CATEGORY_ID": 0,
              "Category": {
                "CategoryId": 0,
                "CategoryNameAr": "",
                "LastModifiedDate": "",
                "CategoryNameEng": "",
                "Isactive": ""
              },
              "District": {},
              "DocumentType": {
                "DocumentTypeId": 0,
                "DocumentTypeNameAr": "",
                "LastModifiedDate": "",
                "DocumentTypeEng": "",
                "Isactive": "",
                "Documents": [
                  {}
                ]
              },
              "MainService": {
                "MainServiceId": 0,
                "MainServiceNameAr": "",
                "LastModifiedDate": "",
                "MainServiceEng": "",
                "Isactive": "",
                "Documents": [
                  {}
                ],
                "SubServices": [
                  {
                    "SUB_SERVICE_ID": 0,
                    "SubServiceNameAr": "",
                    "LastModifiedDate": "",
                    "SubServiceEng": "",
                    "Isactive": "",
                    "MainServiceId": 0,
                    "Documents": [
                      {}
                    ],
                    "MainService": {}
                  }
                ]
              },
              "PublicationType": {
                "PublicationTypeId": 0,
                "PublicationTypeNameAr": "",
                "LastModifiedDate": "",
                "PublicationTypeEng": "",
                "Isactive": "",
                "Documents": [
                  {}
                ]
              },
              "Sector": {},
              "ServiceType": {
                "ServiceTypeId": 0,
                "ServiceTypeNameAr": "",
                "LastModifiedDate": "",
                "ServiceTypeEng": "",
                "Isactive": "",
                "Documents": [
                  {}
                ]
              },
              "SubService": {},
              "PUB_MENU_ITEMS": {
                "MENU_ITEM_ID": 0,
                "MENU_ITEM_NAME": "",
                "PARENT_MENU_ITEM_ID": 0,
                "ParentMenuItem": {},
                "ISACTIVE": false,
                "CREATED_DATE": "",
                "APPLICATION": "",
                "UNIT_ID": 0,
                "Children": [
                  {}
                ],
                "Documents": [
                  {}
                ]
              },
              "DOC_ATTACHMENTS": [
                {
                  "ATTACHMENT_ID": 0,
                  "DOC_ID": 0,
                  "FILE_CONTENT": "",
                  "FILE_NAME": "",
                  "FILE_SIZE_BYTES": 0,
                  "UPLOAD_DATE": "",
                  "DESCRIPTION": "",
                  "ISACTIVE": false,
                  "Document": {}
                }
              ]
            }
          ],
          "Districts": [
            {}
          ]
        },
        "Documents": [
          {}
        ]
      }
    ],
    "TotalCount": 0,
    "PageNumber": 0,
    "PageSize": 0
  },
  "DistrictRequestDto": {
    "NameAr": "",
    "NameEng": "",
    "SECTOR_ID": 0
  },
  "SaveDistrictResp": {
    "IsSuccess": false,
    "ResponseDetails": [
      {
        "responseCode": 0,
        "responseMessage": ""
      }
    ]
  },
  "PublicationTypeResp": {
    "IsSuccess": false,
    "Errors": [
      {}
    ],
    "Data": [
      {
        "PublicationTypeId": 0,
        "PublicationTypeNameAr": "",
        "LastModifiedDate": "",
        "PublicationTypeEng": "",
        "Isactive": "",
        "Documents": [
          {
            "DOCUMENT_ID": 0,
            "DOCUMENT_NUMBER": "",
            "LAST_MODIFIED_DATE": "",
            "ACTIVATION_DATE": "",
            "WORKING_START_DATE": "",
            "MINI_DOC": "",
            "SECTOR_ID": 0,
            "DISTRICT_ID": 0,
            "DOCUMENT_TYPE_ID": 0,
            "VAL": "",
            "FLAG": "",
            "ALL_TEXT_DOC": "",
            "REJECTREASON": "",
            "MAIN_SERVICE_ID": 0,
            "SUB_SERVICE_ID": 0,
            "SERVICE_TYPE_ID": 0,
            "PUBLICATION_TYPE_ID": 0,
            "MODIFIED_USER_ID": "",
            "CREATED_USER_ID": "",
            "MENUITEMID": 0,
            "CREATED_DATE": "",
            "DOCUMENT_PARENT_ID": "",
            "CATEGORY_ID": 0,
            "Category": {
              "CategoryId": 0,
              "CategoryNameAr": "",
              "LastModifiedDate": "",
              "CategoryNameEng": "",
              "Isactive": ""
            },
            "District": {
              "DistrictId": 0,
              "DistrictNameAr": "",
              "LastModifiedDate": "",
              "DistrictEng": "",
              "Isactive": "",
              "SECTOR_ID": 0,
              "Sector": {
                "SectorId": 0,
                "SectorNameAr": "",
                "LastModifiedDate": "",
                "SectorNameEng": "",
                "Isactive": "",
                "Documents": [
                  {}
                ],
                "Districts": [
                  {}
                ]
              },
              "Documents": [
                {}
              ]
            },
            "DocumentType": {
              "DocumentTypeId": 0,
              "DocumentTypeNameAr": "",
              "LastModifiedDate": "",
              "DocumentTypeEng": "",
              "Isactive": "",
              "Documents": [
                {}
              ]
            },
            "MainService": {
              "MainServiceId": 0,
              "MainServiceNameAr": "",
              "LastModifiedDate": "",
              "MainServiceEng": "",
              "Isactive": "",
              "Documents": [
                {}
              ],
              "SubServices": [
                {
                  "SUB_SERVICE_ID": 0,
                  "SubServiceNameAr": "",
                  "LastModifiedDate": "",
                  "SubServiceEng": "",
                  "Isactive": "",
                  "MainServiceId": 0,
                  "Documents": [
                    {}
                  ],
                  "MainService": {}
                }
              ]
            },
            "PublicationType": {},
            "Sector": {},
            "ServiceType": {
              "ServiceTypeId": 0,
              "ServiceTypeNameAr": "",
              "LastModifiedDate": "",
              "ServiceTypeEng": "",
              "Isactive": "",
              "Documents": [
                {}
              ]
            },
            "SubService": {},
            "PUB_MENU_ITEMS": {
              "MENU_ITEM_ID": 0,
              "MENU_ITEM_NAME": "",
              "PARENT_MENU_ITEM_ID": 0,
              "ParentMenuItem": {},
              "ISACTIVE": false,
              "CREATED_DATE": "",
              "APPLICATION": "",
              "UNIT_ID": 0,
              "Children": [
                {}
              ],
              "Documents": [
                {}
              ]
            },
            "DOC_ATTACHMENTS": [
              {
                "ATTACHMENT_ID": 0,
                "DOC_ID": 0,
                "FILE_CONTENT": "",
                "FILE_NAME": "",
                "FILE_SIZE_BYTES": 0,
                "UPLOAD_DATE": "",
                "DESCRIPTION": "",
                "ISACTIVE": false,
                "Document": {}
              }
            ]
          }
        ]
      }
    ],
    "TotalCount": 0,
    "PageNumber": 0,
    "PageSize": 0
  },
  "PublicationTypeRequestDto": {
    "NameAr": "",
    "NameEng": ""
  },
  "SavePublicationTypeResp": {
    "IsSuccess": false,
    "ResponseDetails": [
      {
        "responseCode": 0,
        "responseMessage": ""
      }
    ]
  },
  "Menu_ItemResp": {
    "IsSuccess": false,
    "Errors": [
      {}
    ],
    "Data": [
      {
        "MENU_ITEM_ID": 0,
        "MENU_ITEM_NAME": "",
        "PARENT_MENU_ITEM_ID": 0,
        "ParentMenuItem": {},
        "ISACTIVE": false,
        "CREATED_DATE": "",
        "APPLICATION": "",
        "UNIT_ID": 0,
        "Children": [
          {}
        ],
        "Documents": [
          {
            "DOCUMENT_ID": 0,
            "DOCUMENT_NUMBER": "",
            "LAST_MODIFIED_DATE": "",
            "ACTIVATION_DATE": "",
            "WORKING_START_DATE": "",
            "MINI_DOC": "",
            "SECTOR_ID": 0,
            "DISTRICT_ID": 0,
            "DOCUMENT_TYPE_ID": 0,
            "VAL": "",
            "FLAG": "",
            "ALL_TEXT_DOC": "",
            "REJECTREASON": "",
            "MAIN_SERVICE_ID": 0,
            "SUB_SERVICE_ID": 0,
            "SERVICE_TYPE_ID": 0,
            "PUBLICATION_TYPE_ID": 0,
            "MODIFIED_USER_ID": "",
            "CREATED_USER_ID": "",
            "MENUITEMID": 0,
            "CREATED_DATE": "",
            "DOCUMENT_PARENT_ID": "",
            "CATEGORY_ID": 0,
            "Category": {
              "CategoryId": 0,
              "CategoryNameAr": "",
              "LastModifiedDate": "",
              "CategoryNameEng": "",
              "Isactive": ""
            },
            "District": {
              "DistrictId": 0,
              "DistrictNameAr": "",
              "LastModifiedDate": "",
              "DistrictEng": "",
              "Isactive": "",
              "SECTOR_ID": 0,
              "Sector": {
                "SectorId": 0,
                "SectorNameAr": "",
                "LastModifiedDate": "",
                "SectorNameEng": "",
                "Isactive": "",
                "Documents": [
                  {}
                ],
                "Districts": [
                  {}
                ]
              },
              "Documents": [
                {}
              ]
            },
            "DocumentType": {
              "DocumentTypeId": 0,
              "DocumentTypeNameAr": "",
              "LastModifiedDate": "",
              "DocumentTypeEng": "",
              "Isactive": "",
              "Documents": [
                {}
              ]
            },
            "MainService": {
              "MainServiceId": 0,
              "MainServiceNameAr": "",
              "LastModifiedDate": "",
              "MainServiceEng": "",
              "Isactive": "",
              "Documents": [
                {}
              ],
              "SubServices": [
                {
                  "SUB_SERVICE_ID": 0,
                  "SubServiceNameAr": "",
                  "LastModifiedDate": "",
                  "SubServiceEng": "",
                  "Isactive": "",
                  "MainServiceId": 0,
                  "Documents": [
                    {}
                  ],
                  "MainService": {}
                }
              ]
            },
            "PublicationType": {
              "PublicationTypeId": 0,
              "PublicationTypeNameAr": "",
              "LastModifiedDate": "",
              "PublicationTypeEng": "",
              "Isactive": "",
              "Documents": [
                {}
              ]
            },
            "Sector": {},
            "ServiceType": {
              "ServiceTypeId": 0,
              "ServiceTypeNameAr": "",
              "LastModifiedDate": "",
              "ServiceTypeEng": "",
              "Isactive": "",
              "Documents": [
                {}
              ]
            },
            "SubService": {},
            "PUB_MENU_ITEMS": {},
            "DOC_ATTACHMENTS": [
              {
                "ATTACHMENT_ID": 0,
                "DOC_ID": 0,
                "FILE_CONTENT": "",
                "FILE_NAME": "",
                "FILE_SIZE_BYTES": 0,
                "UPLOAD_DATE": "",
                "DESCRIPTION": "",
                "ISACTIVE": false,
                "Document": {}
              }
            ]
          }
        ]
      }
    ]
  },
  "MenuItemReq": {
    "MENU_ITEM_NAME": "",
    "PARENT_MENU_ITEM_ID": 0,
    "APPLICATION": "",
    "UNIT_ID": 0
  },
  "MenuItemResp": {
    "IsSuccess": false,
    "ResponseDetails": [
      {
        "responseCode": 0,
        "responseMessage": ""
      }
    ]
  },
  "ResponseDetail": {
    "responseCode": 0,
    "responseMessage": ""
  },
  "DocumentResp": {
    "DocumentId": 0,
    "DOCUMENT_NUMBER": "",
    "MINI_DOC": "",
    "ALL_TEXT_DOC": "",
    "SectorName": "",
    "DistrictName": "",
    "DocumentType": "",
    "VAL": "",
    "Application": "",
    "WORKING_START_DATE": "",
    "DISTRICT_ID": 0,
    "PUBLICATION_TYPE_ID": 0,
    "DOCUMENT_PARENT_ID": "",
    "MENUITEMID": 0,
    "CREATED_DATE": "",
    "PublicationTypeName": "",
    "AttachmentList": [
      {
        "ATTACHMENT_ID": 0,
        "FILE_NAME": "",
        "FILE_SIZE_BYTES": 0
      }
    ]
  },
  "District": {
    "DistrictId": 0,
    "DistrictNameAr": "",
    "LastModifiedDate": "",
    "DistrictEng": "",
    "Isactive": "",
    "SECTOR_ID": 0,
    "Sector": {
      "SectorId": 0,
      "SectorNameAr": "",
      "LastModifiedDate": "",
      "SectorNameEng": "",
      "Isactive": "",
      "Documents": [
        {
          "DOCUMENT_ID": 0,
          "DOCUMENT_NUMBER": "",
          "LAST_MODIFIED_DATE": "",
          "ACTIVATION_DATE": "",
          "WORKING_START_DATE": "",
          "MINI_DOC": "",
          "SECTOR_ID": 0,
          "DISTRICT_ID": 0,
          "DOCUMENT_TYPE_ID": 0,
          "VAL": "",
          "FLAG": "",
          "ALL_TEXT_DOC": "",
          "REJECTREASON": "",
          "MAIN_SERVICE_ID": 0,
          "SUB_SERVICE_ID": 0,
          "SERVICE_TYPE_ID": 0,
          "PUBLICATION_TYPE_ID": 0,
          "MODIFIED_USER_ID": "",
          "CREATED_USER_ID": "",
          "MENUITEMID": 0,
          "CREATED_DATE": "",
          "DOCUMENT_PARENT_ID": "",
          "CATEGORY_ID": 0,
          "Category": {
            "CategoryId": 0,
            "CategoryNameAr": "",
            "LastModifiedDate": "",
            "CategoryNameEng": "",
            "Isactive": ""
          },
          "District": {},
          "DocumentType": {
            "DocumentTypeId": 0,
            "DocumentTypeNameAr": "",
            "LastModifiedDate": "",
            "DocumentTypeEng": "",
            "Isactive": "",
            "Documents": [
              {}
            ]
          },
          "MainService": {
            "MainServiceId": 0,
            "MainServiceNameAr": "",
            "LastModifiedDate": "",
            "MainServiceEng": "",
            "Isactive": "",
            "Documents": [
              {}
            ],
            "SubServices": [
              {
                "SUB_SERVICE_ID": 0,
                "SubServiceNameAr": "",
                "LastModifiedDate": "",
                "SubServiceEng": "",
                "Isactive": "",
                "MainServiceId": 0,
                "Documents": [
                  {}
                ],
                "MainService": {}
              }
            ]
          },
          "PublicationType": {
            "PublicationTypeId": 0,
            "PublicationTypeNameAr": "",
            "LastModifiedDate": "",
            "PublicationTypeEng": "",
            "Isactive": "",
            "Documents": [
              {}
            ]
          },
          "Sector": {},
          "ServiceType": {
            "ServiceTypeId": 0,
            "ServiceTypeNameAr": "",
            "LastModifiedDate": "",
            "ServiceTypeEng": "",
            "Isactive": "",
            "Documents": [
              {}
            ]
          },
          "SubService": {},
          "PUB_MENU_ITEMS": {
            "MENU_ITEM_ID": 0,
            "MENU_ITEM_NAME": "",
            "PARENT_MENU_ITEM_ID": 0,
            "ParentMenuItem": {},
            "ISACTIVE": false,
            "CREATED_DATE": "",
            "APPLICATION": "",
            "UNIT_ID": 0,
            "Children": [
              {}
            ],
            "Documents": [
              {}
            ]
          },
          "DOC_ATTACHMENTS": [
            {
              "ATTACHMENT_ID": 0,
              "DOC_ID": 0,
              "FILE_CONTENT": "",
              "FILE_NAME": "",
              "FILE_SIZE_BYTES": 0,
              "UPLOAD_DATE": "",
              "DESCRIPTION": "",
              "ISACTIVE": false,
              "Document": {}
            }
          ]
        }
      ],
      "Districts": [
        {}
      ]
    },
    "Documents": [
      {}
    ]
  },
  "PublicationType": {
    "PublicationTypeId": 0,
    "PublicationTypeNameAr": "",
    "LastModifiedDate": "",
    "PublicationTypeEng": "",
    "Isactive": "",
    "Documents": [
      {
        "DOCUMENT_ID": 0,
        "DOCUMENT_NUMBER": "",
        "LAST_MODIFIED_DATE": "",
        "ACTIVATION_DATE": "",
        "WORKING_START_DATE": "",
        "MINI_DOC": "",
        "SECTOR_ID": 0,
        "DISTRICT_ID": 0,
        "DOCUMENT_TYPE_ID": 0,
        "VAL": "",
        "FLAG": "",
        "ALL_TEXT_DOC": "",
        "REJECTREASON": "",
        "MAIN_SERVICE_ID": 0,
        "SUB_SERVICE_ID": 0,
        "SERVICE_TYPE_ID": 0,
        "PUBLICATION_TYPE_ID": 0,
        "MODIFIED_USER_ID": "",
        "CREATED_USER_ID": "",
        "MENUITEMID": 0,
        "CREATED_DATE": "",
        "DOCUMENT_PARENT_ID": "",
        "CATEGORY_ID": 0,
        "Category": {
          "CategoryId": 0,
          "CategoryNameAr": "",
          "LastModifiedDate": "",
          "CategoryNameEng": "",
          "Isactive": ""
        },
        "District": {
          "DistrictId": 0,
          "DistrictNameAr": "",
          "LastModifiedDate": "",
          "DistrictEng": "",
          "Isactive": "",
          "SECTOR_ID": 0,
          "Sector": {
            "SectorId": 0,
            "SectorNameAr": "",
            "LastModifiedDate": "",
            "SectorNameEng": "",
            "Isactive": "",
            "Documents": [
              {}
            ],
            "Districts": [
              {}
            ]
          },
          "Documents": [
            {}
          ]
        },
        "DocumentType": {
          "DocumentTypeId": 0,
          "DocumentTypeNameAr": "",
          "LastModifiedDate": "",
          "DocumentTypeEng": "",
          "Isactive": "",
          "Documents": [
            {}
          ]
        },
        "MainService": {
          "MainServiceId": 0,
          "MainServiceNameAr": "",
          "LastModifiedDate": "",
          "MainServiceEng": "",
          "Isactive": "",
          "Documents": [
            {}
          ],
          "SubServices": [
            {
              "SUB_SERVICE_ID": 0,
              "SubServiceNameAr": "",
              "LastModifiedDate": "",
              "SubServiceEng": "",
              "Isactive": "",
              "MainServiceId": 0,
              "Documents": [
                {}
              ],
              "MainService": {}
            }
          ]
        },
        "PublicationType": {},
        "Sector": {},
        "ServiceType": {
          "ServiceTypeId": 0,
          "ServiceTypeNameAr": "",
          "LastModifiedDate": "",
          "ServiceTypeEng": "",
          "Isactive": "",
          "Documents": [
            {}
          ]
        },
        "SubService": {},
        "PUB_MENU_ITEMS": {
          "MENU_ITEM_ID": 0,
          "MENU_ITEM_NAME": "",
          "PARENT_MENU_ITEM_ID": 0,
          "ParentMenuItem": {},
          "ISACTIVE": false,
          "CREATED_DATE": "",
          "APPLICATION": "",
          "UNIT_ID": 0,
          "Children": [
            {}
          ],
          "Documents": [
            {}
          ]
        },
        "DOC_ATTACHMENTS": [
          {
            "ATTACHMENT_ID": 0,
            "DOC_ID": 0,
            "FILE_CONTENT": "",
            "FILE_NAME": "",
            "FILE_SIZE_BYTES": 0,
            "UPLOAD_DATE": "",
            "DESCRIPTION": "",
            "ISACTIVE": false,
            "Document": {}
          }
        ]
      }
    ]
  },
  "PUB_MENU_ITEMS": {
    "MENU_ITEM_ID": 0,
    "MENU_ITEM_NAME": "",
    "PARENT_MENU_ITEM_ID": 0,
    "ParentMenuItem": {},
    "ISACTIVE": false,
    "CREATED_DATE": "",
    "APPLICATION": "",
    "UNIT_ID": 0,
    "Children": [
      {}
    ],
    "Documents": [
      {
        "DOCUMENT_ID": 0,
        "DOCUMENT_NUMBER": "",
        "LAST_MODIFIED_DATE": "",
        "ACTIVATION_DATE": "",
        "WORKING_START_DATE": "",
        "MINI_DOC": "",
        "SECTOR_ID": 0,
        "DISTRICT_ID": 0,
        "DOCUMENT_TYPE_ID": 0,
        "VAL": "",
        "FLAG": "",
        "ALL_TEXT_DOC": "",
        "REJECTREASON": "",
        "MAIN_SERVICE_ID": 0,
        "SUB_SERVICE_ID": 0,
        "SERVICE_TYPE_ID": 0,
        "PUBLICATION_TYPE_ID": 0,
        "MODIFIED_USER_ID": "",
        "CREATED_USER_ID": "",
        "MENUITEMID": 0,
        "CREATED_DATE": "",
        "DOCUMENT_PARENT_ID": "",
        "CATEGORY_ID": 0,
        "Category": {
          "CategoryId": 0,
          "CategoryNameAr": "",
          "LastModifiedDate": "",
          "CategoryNameEng": "",
          "Isactive": ""
        },
        "District": {
          "DistrictId": 0,
          "DistrictNameAr": "",
          "LastModifiedDate": "",
          "DistrictEng": "",
          "Isactive": "",
          "SECTOR_ID": 0,
          "Sector": {
            "SectorId": 0,
            "SectorNameAr": "",
            "LastModifiedDate": "",
            "SectorNameEng": "",
            "Isactive": "",
            "Documents": [
              {}
            ],
            "Districts": [
              {}
            ]
          },
          "Documents": [
            {}
          ]
        },
        "DocumentType": {
          "DocumentTypeId": 0,
          "DocumentTypeNameAr": "",
          "LastModifiedDate": "",
          "DocumentTypeEng": "",
          "Isactive": "",
          "Documents": [
            {}
          ]
        },
        "MainService": {
          "MainServiceId": 0,
          "MainServiceNameAr": "",
          "LastModifiedDate": "",
          "MainServiceEng": "",
          "Isactive": "",
          "Documents": [
            {}
          ],
          "SubServices": [
            {
              "SUB_SERVICE_ID": 0,
              "SubServiceNameAr": "",
              "LastModifiedDate": "",
              "SubServiceEng": "",
              "Isactive": "",
              "MainServiceId": 0,
              "Documents": [
                {}
              ],
              "MainService": {}
            }
          ]
        },
        "PublicationType": {
          "PublicationTypeId": 0,
          "PublicationTypeNameAr": "",
          "LastModifiedDate": "",
          "PublicationTypeEng": "",
          "Isactive": "",
          "Documents": [
            {}
          ]
        },
        "Sector": {},
        "ServiceType": {
          "ServiceTypeId": 0,
          "ServiceTypeNameAr": "",
          "LastModifiedDate": "",
          "ServiceTypeEng": "",
          "Isactive": "",
          "Documents": [
            {}
          ]
        },
        "SubService": {},
        "PUB_MENU_ITEMS": {},
        "DOC_ATTACHMENTS": [
          {
            "ATTACHMENT_ID": 0,
            "DOC_ID": 0,
            "FILE_CONTENT": "",
            "FILE_NAME": "",
            "FILE_SIZE_BYTES": 0,
            "UPLOAD_DATE": "",
            "DESCRIPTION": "",
            "ISACTIVE": false,
            "Document": {}
          }
        ]
      }
    ]
  },
  "DocumentType": {
    "DocumentTypeId": 0,
    "DocumentTypeNameAr": "",
    "LastModifiedDate": "",
    "DocumentTypeEng": "",
    "Isactive": "",
    "Documents": [
      {
        "DOCUMENT_ID": 0,
        "DOCUMENT_NUMBER": "",
        "LAST_MODIFIED_DATE": "",
        "ACTIVATION_DATE": "",
        "WORKING_START_DATE": "",
        "MINI_DOC": "",
        "SECTOR_ID": 0,
        "DISTRICT_ID": 0,
        "DOCUMENT_TYPE_ID": 0,
        "VAL": "",
        "FLAG": "",
        "ALL_TEXT_DOC": "",
        "REJECTREASON": "",
        "MAIN_SERVICE_ID": 0,
        "SUB_SERVICE_ID": 0,
        "SERVICE_TYPE_ID": 0,
        "PUBLICATION_TYPE_ID": 0,
        "MODIFIED_USER_ID": "",
        "CREATED_USER_ID": "",
        "MENUITEMID": 0,
        "CREATED_DATE": "",
        "DOCUMENT_PARENT_ID": "",
        "CATEGORY_ID": 0,
        "Category": {
          "CategoryId": 0,
          "CategoryNameAr": "",
          "LastModifiedDate": "",
          "CategoryNameEng": "",
          "Isactive": ""
        },
        "District": {
          "DistrictId": 0,
          "DistrictNameAr": "",
          "LastModifiedDate": "",
          "DistrictEng": "",
          "Isactive": "",
          "SECTOR_ID": 0,
          "Sector": {
            "SectorId": 0,
            "SectorNameAr": "",
            "LastModifiedDate": "",
            "SectorNameEng": "",
            "Isactive": "",
            "Documents": [
              {}
            ],
            "Districts": [
              {}
            ]
          },
          "Documents": [
            {}
          ]
        },
        "DocumentType": {},
        "MainService": {
          "MainServiceId": 0,
          "MainServiceNameAr": "",
          "LastModifiedDate": "",
          "MainServiceEng": "",
          "Isactive": "",
          "Documents": [
            {}
          ],
          "SubServices": [
            {
              "SUB_SERVICE_ID": 0,
              "SubServiceNameAr": "",
              "LastModifiedDate": "",
              "SubServiceEng": "",
              "Isactive": "",
              "MainServiceId": 0,
              "Documents": [
                {}
              ],
              "MainService": {}
            }
          ]
        },
        "PublicationType": {
          "PublicationTypeId": 0,
          "PublicationTypeNameAr": "",
          "LastModifiedDate": "",
          "PublicationTypeEng": "",
          "Isactive": "",
          "Documents": [
            {}
          ]
        },
        "Sector": {},
        "ServiceType": {
          "ServiceTypeId": 0,
          "ServiceTypeNameAr": "",
          "LastModifiedDate": "",
          "ServiceTypeEng": "",
          "Isactive": "",
          "Documents": [
            {}
          ]
        },
        "SubService": {},
        "PUB_MENU_ITEMS": {
          "MENU_ITEM_ID": 0,
          "MENU_ITEM_NAME": "",
          "PARENT_MENU_ITEM_ID": 0,
          "ParentMenuItem": {},
          "ISACTIVE": false,
          "CREATED_DATE": "",
          "APPLICATION": "",
          "UNIT_ID": 0,
          "Children": [
            {}
          ],
          "Documents": [
            {}
          ]
        },
        "DOC_ATTACHMENTS": [
          {
            "ATTACHMENT_ID": 0,
            "DOC_ID": 0,
            "FILE_CONTENT": "",
            "FILE_NAME": "",
            "FILE_SIZE_BYTES": 0,
            "UPLOAD_DATE": "",
            "DESCRIPTION": "",
            "ISACTIVE": false,
            "Document": {}
          }
        ]
      }
    ]
  },
  "Sector": {
    "SectorId": 0,
    "SectorNameAr": "",
    "LastModifiedDate": "",
    "SectorNameEng": "",
    "Isactive": "",
    "Documents": [
      {
        "DOCUMENT_ID": 0,
        "DOCUMENT_NUMBER": "",
        "LAST_MODIFIED_DATE": "",
        "ACTIVATION_DATE": "",
        "WORKING_START_DATE": "",
        "MINI_DOC": "",
        "SECTOR_ID": 0,
        "DISTRICT_ID": 0,
        "DOCUMENT_TYPE_ID": 0,
        "VAL": "",
        "FLAG": "",
        "ALL_TEXT_DOC": "",
        "REJECTREASON": "",
        "MAIN_SERVICE_ID": 0,
        "SUB_SERVICE_ID": 0,
        "SERVICE_TYPE_ID": 0,
        "PUBLICATION_TYPE_ID": 0,
        "MODIFIED_USER_ID": "",
        "CREATED_USER_ID": "",
        "MENUITEMID": 0,
        "CREATED_DATE": "",
        "DOCUMENT_PARENT_ID": "",
        "CATEGORY_ID": 0,
        "Category": {
          "CategoryId": 0,
          "CategoryNameAr": "",
          "LastModifiedDate": "",
          "CategoryNameEng": "",
          "Isactive": ""
        },
        "District": {
          "DistrictId": 0,
          "DistrictNameAr": "",
          "LastModifiedDate": "",
          "DistrictEng": "",
          "Isactive": "",
          "SECTOR_ID": 0,
          "Sector": {},
          "Documents": [
            {}
          ]
        },
        "DocumentType": {
          "DocumentTypeId": 0,
          "DocumentTypeNameAr": "",
          "LastModifiedDate": "",
          "DocumentTypeEng": "",
          "Isactive": "",
          "Documents": [
            {}
          ]
        },
        "MainService": {
          "MainServiceId": 0,
          "MainServiceNameAr": "",
          "LastModifiedDate": "",
          "MainServiceEng": "",
          "Isactive": "",
          "Documents": [
            {}
          ],
          "SubServices": [
            {
              "SUB_SERVICE_ID": 0,
              "SubServiceNameAr": "",
              "LastModifiedDate": "",
              "SubServiceEng": "",
              "Isactive": "",
              "MainServiceId": 0,
              "Documents": [
                {}
              ],
              "MainService": {}
            }
          ]
        },
        "PublicationType": {
          "PublicationTypeId": 0,
          "PublicationTypeNameAr": "",
          "LastModifiedDate": "",
          "PublicationTypeEng": "",
          "Isactive": "",
          "Documents": [
            {}
          ]
        },
        "Sector": {},
        "ServiceType": {
          "ServiceTypeId": 0,
          "ServiceTypeNameAr": "",
          "LastModifiedDate": "",
          "ServiceTypeEng": "",
          "Isactive": "",
          "Documents": [
            {}
          ]
        },
        "SubService": {},
        "PUB_MENU_ITEMS": {
          "MENU_ITEM_ID": 0,
          "MENU_ITEM_NAME": "",
          "PARENT_MENU_ITEM_ID": 0,
          "ParentMenuItem": {},
          "ISACTIVE": false,
          "CREATED_DATE": "",
          "APPLICATION": "",
          "UNIT_ID": 0,
          "Children": [
            {}
          ],
          "Documents": [
            {}
          ]
        },
        "DOC_ATTACHMENTS": [
          {
            "ATTACHMENT_ID": 0,
            "DOC_ID": 0,
            "FILE_CONTENT": "",
            "FILE_NAME": "",
            "FILE_SIZE_BYTES": 0,
            "UPLOAD_DATE": "",
            "DESCRIPTION": "",
            "ISACTIVE": false,
            "Document": {}
          }
        ]
      }
    ],
    "Districts": [
      {}
    ]
  },
  "Document": {
    "DOCUMENT_ID": 0,
    "DOCUMENT_NUMBER": "",
    "LAST_MODIFIED_DATE": "",
    "ACTIVATION_DATE": "",
    "WORKING_START_DATE": "",
    "MINI_DOC": "",
    "SECTOR_ID": 0,
    "DISTRICT_ID": 0,
    "DOCUMENT_TYPE_ID": 0,
    "VAL": "",
    "FLAG": "",
    "ALL_TEXT_DOC": "",
    "REJECTREASON": "",
    "MAIN_SERVICE_ID": 0,
    "SUB_SERVICE_ID": 0,
    "SERVICE_TYPE_ID": 0,
    "PUBLICATION_TYPE_ID": 0,
    "MODIFIED_USER_ID": "",
    "CREATED_USER_ID": "",
    "MENUITEMID": 0,
    "CREATED_DATE": "",
    "DOCUMENT_PARENT_ID": "",
    "CATEGORY_ID": 0,
    "Category": {
      "CategoryId": 0,
      "CategoryNameAr": "",
      "LastModifiedDate": "",
      "CategoryNameEng": "",
      "Isactive": ""
    },
    "District": {
      "DistrictId": 0,
      "DistrictNameAr": "",
      "LastModifiedDate": "",
      "DistrictEng": "",
      "Isactive": "",
      "SECTOR_ID": 0,
      "Sector": {
        "SectorId": 0,
        "SectorNameAr": "",
        "LastModifiedDate": "",
        "SectorNameEng": "",
        "Isactive": "",
        "Documents": [
          {}
        ],
        "Districts": [
          {}
        ]
      },
      "Documents": [
        {}
      ]
    },
    "DocumentType": {
      "DocumentTypeId": 0,
      "DocumentTypeNameAr": "",
      "LastModifiedDate": "",
      "DocumentTypeEng": "",
      "Isactive": "",
      "Documents": [
        {}
      ]
    },
    "MainService": {
      "MainServiceId": 0,
      "MainServiceNameAr": "",
      "LastModifiedDate": "",
      "MainServiceEng": "",
      "Isactive": "",
      "Documents": [
        {}
      ],
      "SubServices": [
        {
          "SUB_SERVICE_ID": 0,
          "SubServiceNameAr": "",
          "LastModifiedDate": "",
          "SubServiceEng": "",
          "Isactive": "",
          "MainServiceId": 0,
          "Documents": [
            {}
          ],
          "MainService": {}
        }
      ]
    },
    "PublicationType": {
      "PublicationTypeId": 0,
      "PublicationTypeNameAr": "",
      "LastModifiedDate": "",
      "PublicationTypeEng": "",
      "Isactive": "",
      "Documents": [
        {}
      ]
    },
    "Sector": {},
    "ServiceType": {
      "ServiceTypeId": 0,
      "ServiceTypeNameAr": "",
      "LastModifiedDate": "",
      "ServiceTypeEng": "",
      "Isactive": "",
      "Documents": [
        {}
      ]
    },
    "SubService": {},
    "PUB_MENU_ITEMS": {
      "MENU_ITEM_ID": 0,
      "MENU_ITEM_NAME": "",
      "PARENT_MENU_ITEM_ID": 0,
      "ParentMenuItem": {},
      "ISACTIVE": false,
      "CREATED_DATE": "",
      "APPLICATION": "",
      "UNIT_ID": 0,
      "Children": [
        {}
      ],
      "Documents": [
        {}
      ]
    },
    "DOC_ATTACHMENTS": [
      {
        "ATTACHMENT_ID": 0,
        "DOC_ID": 0,
        "FILE_CONTENT": "",
        "FILE_NAME": "",
        "FILE_SIZE_BYTES": 0,
        "UPLOAD_DATE": "",
        "DESCRIPTION": "",
        "ISACTIVE": false,
        "Document": {}
      }
    ]
  },
  "Category": {
    "CategoryId": 0,
    "CategoryNameAr": "",
    "LastModifiedDate": "",
    "CategoryNameEng": "",
    "Isactive": ""
  },
  "MainService": {
    "MainServiceId": 0,
    "MainServiceNameAr": "",
    "LastModifiedDate": "",
    "MainServiceEng": "",
    "Isactive": "",
    "Documents": [
      {
        "DOCUMENT_ID": 0,
        "DOCUMENT_NUMBER": "",
        "LAST_MODIFIED_DATE": "",
        "ACTIVATION_DATE": "",
        "WORKING_START_DATE": "",
        "MINI_DOC": "",
        "SECTOR_ID": 0,
        "DISTRICT_ID": 0,
        "DOCUMENT_TYPE_ID": 0,
        "VAL": "",
        "FLAG": "",
        "ALL_TEXT_DOC": "",
        "REJECTREASON": "",
        "MAIN_SERVICE_ID": 0,
        "SUB_SERVICE_ID": 0,
        "SERVICE_TYPE_ID": 0,
        "PUBLICATION_TYPE_ID": 0,
        "MODIFIED_USER_ID": "",
        "CREATED_USER_ID": "",
        "MENUITEMID": 0,
        "CREATED_DATE": "",
        "DOCUMENT_PARENT_ID": "",
        "CATEGORY_ID": 0,
        "Category": {
          "CategoryId": 0,
          "CategoryNameAr": "",
          "LastModifiedDate": "",
          "CategoryNameEng": "",
          "Isactive": ""
        },
        "District": {
          "DistrictId": 0,
          "DistrictNameAr": "",
          "LastModifiedDate": "",
          "DistrictEng": "",
          "Isactive": "",
          "SECTOR_ID": 0,
          "Sector": {
            "SectorId": 0,
            "SectorNameAr": "",
            "LastModifiedDate": "",
            "SectorNameEng": "",
            "Isactive": "",
            "Documents": [
              {}
            ],
            "Districts": [
              {}
            ]
          },
          "Documents": [
            {}
          ]
        },
        "DocumentType": {
          "DocumentTypeId": 0,
          "DocumentTypeNameAr": "",
          "LastModifiedDate": "",
          "DocumentTypeEng": "",
          "Isactive": "",
          "Documents": [
            {}
          ]
        },
        "MainService": {},
        "PublicationType": {
          "PublicationTypeId": 0,
          "PublicationTypeNameAr": "",
          "LastModifiedDate": "",
          "PublicationTypeEng": "",
          "Isactive": "",
          "Documents": [
            {}
          ]
        },
        "Sector": {},
        "ServiceType": {
          "ServiceTypeId": 0,
          "ServiceTypeNameAr": "",
          "LastModifiedDate": "",
          "ServiceTypeEng": "",
          "Isactive": "",
          "Documents": [
            {}
          ]
        },
        "SubService": {
          "SUB_SERVICE_ID": 0,
          "SubServiceNameAr": "",
          "LastModifiedDate": "",
          "SubServiceEng": "",
          "Isactive": "",
          "MainServiceId": 0,
          "Documents": [
            {}
          ],
          "MainService": {}
        },
        "PUB_MENU_ITEMS": {
          "MENU_ITEM_ID": 0,
          "MENU_ITEM_NAME": "",
          "PARENT_MENU_ITEM_ID": 0,
          "ParentMenuItem": {},
          "ISACTIVE": false,
          "CREATED_DATE": "",
          "APPLICATION": "",
          "UNIT_ID": 0,
          "Children": [
            {}
          ],
          "Documents": [
            {}
          ]
        },
        "DOC_ATTACHMENTS": [
          {
            "ATTACHMENT_ID": 0,
            "DOC_ID": 0,
            "FILE_CONTENT": "",
            "FILE_NAME": "",
            "FILE_SIZE_BYTES": 0,
            "UPLOAD_DATE": "",
            "DESCRIPTION": "",
            "ISACTIVE": false,
            "Document": {}
          }
        ]
      }
    ],
    "SubServices": [
      {}
    ]
  },
  "ServiceType": {
    "ServiceTypeId": 0,
    "ServiceTypeNameAr": "",
    "LastModifiedDate": "",
    "ServiceTypeEng": "",
    "Isactive": "",
    "Documents": [
      {
        "DOCUMENT_ID": 0,
        "DOCUMENT_NUMBER": "",
        "LAST_MODIFIED_DATE": "",
        "ACTIVATION_DATE": "",
        "WORKING_START_DATE": "",
        "MINI_DOC": "",
        "SECTOR_ID": 0,
        "DISTRICT_ID": 0,
        "DOCUMENT_TYPE_ID": 0,
        "VAL": "",
        "FLAG": "",
        "ALL_TEXT_DOC": "",
        "REJECTREASON": "",
        "MAIN_SERVICE_ID": 0,
        "SUB_SERVICE_ID": 0,
        "SERVICE_TYPE_ID": 0,
        "PUBLICATION_TYPE_ID": 0,
        "MODIFIED_USER_ID": "",
        "CREATED_USER_ID": "",
        "MENUITEMID": 0,
        "CREATED_DATE": "",
        "DOCUMENT_PARENT_ID": "",
        "CATEGORY_ID": 0,
        "Category": {
          "CategoryId": 0,
          "CategoryNameAr": "",
          "LastModifiedDate": "",
          "CategoryNameEng": "",
          "Isactive": ""
        },
        "District": {
          "DistrictId": 0,
          "DistrictNameAr": "",
          "LastModifiedDate": "",
          "DistrictEng": "",
          "Isactive": "",
          "SECTOR_ID": 0,
          "Sector": {
            "SectorId": 0,
            "SectorNameAr": "",
            "LastModifiedDate": "",
            "SectorNameEng": "",
            "Isactive": "",
            "Documents": [
              {}
            ],
            "Districts": [
              {}
            ]
          },
          "Documents": [
            {}
          ]
        },
        "DocumentType": {
          "DocumentTypeId": 0,
          "DocumentTypeNameAr": "",
          "LastModifiedDate": "",
          "DocumentTypeEng": "",
          "Isactive": "",
          "Documents": [
            {}
          ]
        },
        "MainService": {
          "MainServiceId": 0,
          "MainServiceNameAr": "",
          "LastModifiedDate": "",
          "MainServiceEng": "",
          "Isactive": "",
          "Documents": [
            {}
          ],
          "SubServices": [
            {
              "SUB_SERVICE_ID": 0,
              "SubServiceNameAr": "",
              "LastModifiedDate": "",
              "SubServiceEng": "",
              "Isactive": "",
              "MainServiceId": 0,
              "Documents": [
                {}
              ],
              "MainService": {}
            }
          ]
        },
        "PublicationType": {
          "PublicationTypeId": 0,
          "PublicationTypeNameAr": "",
          "LastModifiedDate": "",
          "PublicationTypeEng": "",
          "Isactive": "",
          "Documents": [
            {}
          ]
        },
        "Sector": {},
        "ServiceType": {},
        "SubService": {},
        "PUB_MENU_ITEMS": {
          "MENU_ITEM_ID": 0,
          "MENU_ITEM_NAME": "",
          "PARENT_MENU_ITEM_ID": 0,
          "ParentMenuItem": {},
          "ISACTIVE": false,
          "CREATED_DATE": "",
          "APPLICATION": "",
          "UNIT_ID": 0,
          "Children": [
            {}
          ],
          "Documents": [
            {}
          ]
        },
        "DOC_ATTACHMENTS": [
          {
            "ATTACHMENT_ID": 0,
            "DOC_ID": 0,
            "FILE_CONTENT": "",
            "FILE_NAME": "",
            "FILE_SIZE_BYTES": 0,
            "UPLOAD_DATE": "",
            "DESCRIPTION": "",
            "ISACTIVE": false,
            "Document": {}
          }
        ]
      }
    ]
  },
  "SubService": {
    "SUB_SERVICE_ID": 0,
    "SubServiceNameAr": "",
    "LastModifiedDate": "",
    "SubServiceEng": "",
    "Isactive": "",
    "MainServiceId": 0,
    "Documents": [
      {
        "DOCUMENT_ID": 0,
        "DOCUMENT_NUMBER": "",
        "LAST_MODIFIED_DATE": "",
        "ACTIVATION_DATE": "",
        "WORKING_START_DATE": "",
        "MINI_DOC": "",
        "SECTOR_ID": 0,
        "DISTRICT_ID": 0,
        "DOCUMENT_TYPE_ID": 0,
        "VAL": "",
        "FLAG": "",
        "ALL_TEXT_DOC": "",
        "REJECTREASON": "",
        "MAIN_SERVICE_ID": 0,
        "SUB_SERVICE_ID": 0,
        "SERVICE_TYPE_ID": 0,
        "PUBLICATION_TYPE_ID": 0,
        "MODIFIED_USER_ID": "",
        "CREATED_USER_ID": "",
        "MENUITEMID": 0,
        "CREATED_DATE": "",
        "DOCUMENT_PARENT_ID": "",
        "CATEGORY_ID": 0,
        "Category": {
          "CategoryId": 0,
          "CategoryNameAr": "",
          "LastModifiedDate": "",
          "CategoryNameEng": "",
          "Isactive": ""
        },
        "District": {
          "DistrictId": 0,
          "DistrictNameAr": "",
          "LastModifiedDate": "",
          "DistrictEng": "",
          "Isactive": "",
          "SECTOR_ID": 0,
          "Sector": {
            "SectorId": 0,
            "SectorNameAr": "",
            "LastModifiedDate": "",
            "SectorNameEng": "",
            "Isactive": "",
            "Documents": [
              {}
            ],
            "Districts": [
              {}
            ]
          },
          "Documents": [
            {}
          ]
        },
        "DocumentType": {
          "DocumentTypeId": 0,
          "DocumentTypeNameAr": "",
          "LastModifiedDate": "",
          "DocumentTypeEng": "",
          "Isactive": "",
          "Documents": [
            {}
          ]
        },
        "MainService": {
          "MainServiceId": 0,
          "MainServiceNameAr": "",
          "LastModifiedDate": "",
          "MainServiceEng": "",
          "Isactive": "",
          "Documents": [
            {}
          ],
          "SubServices": [
            {}
          ]
        },
        "PublicationType": {
          "PublicationTypeId": 0,
          "PublicationTypeNameAr": "",
          "LastModifiedDate": "",
          "PublicationTypeEng": "",
          "Isactive": "",
          "Documents": [
            {}
          ]
        },
        "Sector": {},
        "ServiceType": {
          "ServiceTypeId": 0,
          "ServiceTypeNameAr": "",
          "LastModifiedDate": "",
          "ServiceTypeEng": "",
          "Isactive": "",
          "Documents": [
            {}
          ]
        },
        "SubService": {},
        "PUB_MENU_ITEMS": {
          "MENU_ITEM_ID": 0,
          "MENU_ITEM_NAME": "",
          "PARENT_MENU_ITEM_ID": 0,
          "ParentMenuItem": {},
          "ISACTIVE": false,
          "CREATED_DATE": "",
          "APPLICATION": "",
          "UNIT_ID": 0,
          "Children": [
            {}
          ],
          "Documents": [
            {}
          ]
        },
        "DOC_ATTACHMENTS": [
          {
            "ATTACHMENT_ID": 0,
            "DOC_ID": 0,
            "FILE_CONTENT": "",
            "FILE_NAME": "",
            "FILE_SIZE_BYTES": 0,
            "UPLOAD_DATE": "",
            "DESCRIPTION": "",
            "ISACTIVE": false,
            "Document": {}
          }
        ]
      }
    ],
    "MainService": {}
  },
  "DOC_ATTACHMENT": {
    "ATTACHMENT_ID": 0,
    "DOC_ID": 0,
    "FILE_CONTENT": "",
    "FILE_NAME": "",
    "FILE_SIZE_BYTES": 0,
    "UPLOAD_DATE": "",
    "DESCRIPTION": "",
    "ISACTIVE": false,
    "Document": {
      "DOCUMENT_ID": 0,
      "DOCUMENT_NUMBER": "",
      "LAST_MODIFIED_DATE": "",
      "ACTIVATION_DATE": "",
      "WORKING_START_DATE": "",
      "MINI_DOC": "",
      "SECTOR_ID": 0,
      "DISTRICT_ID": 0,
      "DOCUMENT_TYPE_ID": 0,
      "VAL": "",
      "FLAG": "",
      "ALL_TEXT_DOC": "",
      "REJECTREASON": "",
      "MAIN_SERVICE_ID": 0,
      "SUB_SERVICE_ID": 0,
      "SERVICE_TYPE_ID": 0,
      "PUBLICATION_TYPE_ID": 0,
      "MODIFIED_USER_ID": "",
      "CREATED_USER_ID": "",
      "MENUITEMID": 0,
      "CREATED_DATE": "",
      "DOCUMENT_PARENT_ID": "",
      "CATEGORY_ID": 0,
      "Category": {
        "CategoryId": 0,
        "CategoryNameAr": "",
        "LastModifiedDate": "",
        "CategoryNameEng": "",
        "Isactive": ""
      },
      "District": {
        "DistrictId": 0,
        "DistrictNameAr": "",
        "LastModifiedDate": "",
        "DistrictEng": "",
        "Isactive": "",
        "SECTOR_ID": 0,
        "Sector": {
          "SectorId": 0,
          "SectorNameAr": "",
          "LastModifiedDate": "",
          "SectorNameEng": "",
          "Isactive": "",
          "Documents": [
            {}
          ],
          "Districts": [
            {}
          ]
        },
        "Documents": [
          {}
        ]
      },
      "DocumentType": {
        "DocumentTypeId": 0,
        "DocumentTypeNameAr": "",
        "LastModifiedDate": "",
        "DocumentTypeEng": "",
        "Isactive": "",
        "Documents": [
          {}
        ]
      },
      "MainService": {
        "MainServiceId": 0,
        "MainServiceNameAr": "",
        "LastModifiedDate": "",
        "MainServiceEng": "",
        "Isactive": "",
        "Documents": [
          {}
        ],
        "SubServices": [
          {
            "SUB_SERVICE_ID": 0,
            "SubServiceNameAr": "",
            "LastModifiedDate": "",
            "SubServiceEng": "",
            "Isactive": "",
            "MainServiceId": 0,
            "Documents": [
              {}
            ],
            "MainService": {}
          }
        ]
      },
      "PublicationType": {
        "PublicationTypeId": 0,
        "PublicationTypeNameAr": "",
        "LastModifiedDate": "",
        "PublicationTypeEng": "",
        "Isactive": "",
        "Documents": [
          {}
        ]
      },
      "Sector": {},
      "ServiceType": {
        "ServiceTypeId": 0,
        "ServiceTypeNameAr": "",
        "LastModifiedDate": "",
        "ServiceTypeEng": "",
        "Isactive": "",
        "Documents": [
          {}
        ]
      },
      "SubService": {},
      "PUB_MENU_ITEMS": {
        "MENU_ITEM_ID": 0,
        "MENU_ITEM_NAME": "",
        "PARENT_MENU_ITEM_ID": 0,
        "ParentMenuItem": {},
        "ISACTIVE": false,
        "CREATED_DATE": "",
        "APPLICATION": "",
        "UNIT_ID": 0,
        "Children": [
          {}
        ],
        "Documents": [
          {}
        ]
      },
      "DOC_ATTACHMENTS": [
        {}
      ]
    }
  },
  "PublicationsSaveDocumentFormRequest": {
    "dOCUMENT_ID": 0,
    "wORKING_START_DATE": "",
    "mINI_DOC": "",
    "dISTRICT_ID": 0,
    "pUBLICATION_TYPE_ID": 0,
    "aLL_TEXT_DOC": "",
    "mENUITEMID": 0,
    "dOCUMENT_PARENT_ID": "",
    "rEJECTREASON": "",
    "attachmentLists": [
      {
        "ATTACHMENT_ID": 0,
        "FILE_NAME": "",
        "FILE_SIZE_BYTES": 0
      }
    ],
    "files": [
      {}
    ]
  },
  "PublicationsEditDocumentFormRequest": {
    "dOCUMENT_ID": 0,
    "wORKING_START_DATE": "",
    "mINI_DOC": "",
    "dISTRICT_ID": 0,
    "pUBLICATION_TYPE_ID": 0,
    "aLL_TEXT_DOC": "",
    "mENUITEMID": 0,
    "dOCUMENT_PARENT_ID": "",
    "rEJECTREASON": "",
    "attachmentLists": [
      {
        "ATTACHMENT_ID": 0,
        "FILE_NAME": "",
        "FILE_SIZE_BYTES": 0
      }
    ],
    "files": [
      {}
    ]
  },
  "ReplyCommonResponse": {
    "isSuccess": false,
    "errors": [
      {}
    ],
    "data": {
      "replyId": 0,
      "messageId": 0,
      "message": "",
      "authorId": "",
      "nextResponsibleSectorId": "",
      "createdDate": "",
      "ip": ""
    },
    "totalCount": 0,
    "pageNumber": 0,
    "pageSize": 0,
    "totalPages": 0
  },
  "ReplyDtoIEnumerableCommonResponse": {
    "isSuccess": false,
    "errors": [
      {}
    ],
    "data": [
      {
        "replyId": 0,
        "messageId": 0,
        "message": "",
        "authorId": "",
        "authorName": "",
        "nextResponsibleSectorId": "",
        "createdDate": "",
        "attchShipmentDtos": [
          {
            "id": 0,
            "attchId": 0,
            "attchNm": "",
            "applicationName": "",
            "attcExt": "",
            "attchSize": 0
          }
        ]
      }
    ],
    "totalCount": 0,
    "pageNumber": 0,
    "pageSize": 0,
    "totalPages": 0
  },
  "Reply": {
    "replyId": 0,
    "messageId": 0,
    "message": "",
    "authorId": "",
    "nextResponsibleSectorId": "",
    "createdDate": "",
    "ip": ""
  },
  "RepliesReplyWithAttchmentFormRequest": {
    "message": "",
    "messageId": 0,
    "nextResponsibleSectorID": "",
    "files": [
      {}
    ]
  }
};
export default DTO_SHAPES;
