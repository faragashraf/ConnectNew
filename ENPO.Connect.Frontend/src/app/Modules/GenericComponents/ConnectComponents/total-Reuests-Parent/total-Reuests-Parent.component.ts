import { Router } from '@angular/router';
import { Component, AfterViewInit } from '@angular/core';
import { MsgsService } from 'src/app/shared/services/helper/msgs.service';
import { GenericFormsService } from '../../GenericForms.service';
import { PowerBiController } from 'src/app/Modules/enpopower-bi/services/PowerBi.service';
import { SpinnerService } from 'src/app/shared/services/helper/spinner.service';
import { SignalRService } from 'src/app/shared/services/SignalRServices/SignalR.service';
import { ComponentConfig, getConfigByRoute, processRequestsAndPopulate, routeKey } from '../../../../shared/models/Component.Config.model';
import { TreeNode } from 'primeng/api';
import { ComponentConfigService } from '../../../admins/services/component-config.service';
import { AdministrativeCertificateController, DynamicFormController } from 'src/app/shared/services/BackendServices';
import { ListRequestModel, MessageDto, RequestedData, SearchKind } from 'src/app/shared/services/BackendServices/AdministrativeCertificate/AdministrativeCertificate.dto';
import { TourService } from 'src/app/shared/services/tour.service';
import { AuthObjectsService } from 'src/app/shared/services/helper/auth-objects.service';

@Component({
  selector: 'app-total-Reuests-Parent',
  templateUrl: './total-Reuests-Parent.component.html',
  styleUrls: ['./total-Reuests-Parent.component.scss']
})
export class TotalReuestsParentComponent implements AfterViewInit {
  loading: boolean = false;
  config: ComponentConfig = {} as ComponentConfig;
  unitTree: TreeNode[] = [];
  messageDtos: MessageDto[] = []

  userId: any = localStorage.getItem('UserId');
  userArName: any = localStorage.getItem('firstName');
  unitName: any = '';
  admCertDeptDtos: any[] = []

  constructor(private administrativeCertificateController: AdministrativeCertificateController, public router: Router, private spinner: SpinnerService,
    private msg: MsgsService, public genericFormService: GenericFormsService, private dynamicFormController: DynamicFormController,
    private powerBiController: PowerBiController, private chatService: SignalRService, public authService: AuthObjectsService,
    private appConfigService: ComponentConfigService,
    private tourService: TourService) {

    const _route = routeKey(this.router.url);
    this.appConfigService.getAll().subscribe(items => {
      const cfg = getConfigByRoute(_route, items || []);
      if (!cfg) return;
      this.config = cfg;
      this.setUnitName();
      this.genericFormService.applicationName = this.config.genericFormName as string;
      if (this.config.menuId == null || this.config.menuId == 0) {
        const userprofile = this.authService.getUserProfile();
        this.config.genericFormName = userprofile.vwOrgUnitsWithCounts[0].unitId.toString();
        this.config.menuId = userprofile.vwOrgUnitsWithCounts[0].unitId.toString();
        this.config.listRequestModel.type = userprofile.vwOrgUnitsWithCounts[0].unitId.toString();
        this.config.unitId.push(userprofile.vwOrgUnitsWithCounts[0].unitId.toString());
        this.config.unitId.forEach(id => {
          this.chatService.AddUserTogroup(id.toString());
        })
      }

      processRequestsAndPopulate(this, this.genericFormService, spinner).subscribe({
        next: () => {
        },
        complete: () => {
          if (!this.config.fieldsConfiguration.isCategoryTreeMode)
            this.genericFormService.cdcategoryDtos = this.genericFormService.cdcategoryDtos.filter(cd => cd.catParent == this.config.menuId);

          this.CompeletAdminCerObject();
        }
      });
    });
  }

  ngAfterViewInit() {
    // // Start specific tour for this component
    // setTimeout(() => {
    //   this.tourService.startRequestsTour();
    // }, 2500);
  }

  startTour() {
    this.tourService.forceStartRequestsTour();
  }

  setUnitName() {
    try {
      const unitsFromProfile = this.authService.getUserProfile().vwOrgUnitsWithCounts;
      unitsFromProfile.forEach((u: any, index: number) => {
        this.unitName += u.unitName;
        if (index < unitsFromProfile.length - 1) {
          this.unitName += ' & ';
        }
      });
    } catch (error) {
      console.error('Error setting unit name:', error);
    }
  }

  onRecievelistRequestModel(event: ListRequestModel) {
    this.config.listRequestModel = event;
    this.GetData();
  }
  GetData() {
    this.loading = true;
    if (this.config.listRequestModel.requestedData == RequestedData.MyRequest
      || (this.config.listRequestModel.search?.searchKind == SearchKind.NoSearch ||
        this.config.listRequestModel.search?.searchKind == SearchKind.LimitedSearch
        || this.config.listRequestModel.search?.searchKind == SearchKind.GlobalSearch)
    ) {
      const req = this.ensureAdminListRequestModel(this.config.listRequestModel);
      this.administrativeCertificateController.getAllRequests(req)
        .subscribe({
          next: (res) => {
            this.loading = false;
            if (res.isSuccess) {
              if (res.data != null) {
                this.messageDtos = (res.data as MessageDto[]).map(m => {
                  (m as any).categoryCd = this.config.tkCategoryCds.find(cd => cd.key === Number((m as any).categoryCd))?.value || (m as any).categoryCd;
                  return m;
                });
                this.genericFormService.filteredCdcategoryDtos = this.genericFormService.filterCategories(this.genericFormService.cdcategoryDtos, this.messageDtos as MessageDto[])
              }
              this.config.totalRecords = res.totalCount;

              this.CompeletAdminCerObject();
            }
            else {
              this.loading = false;
              let errors = "";
              res.errors?.forEach((e: any) => {
                errors += e.message + '\n';
              });
              this.msg.msgError('Error', '<h5>' + errors + '</h5>', true)
            }
          },
          error: (error) => {
            this.loading = false;
            this.msg.msgError('Error', '<h5>' + error + '</h5>', true)
          },
          complete: () => {
            this.loading = false;
          }
        })
    }
    else {
      this.messageDtos = [];
      this.config.listRequestModel.pageNumber = 1;
      const req = this.ensureAdminListRequestModel(this.config.listRequestModel);
      this.administrativeCertificateController.searsh(req)
        .subscribe({
          next: (res: any) => {
            if (res.isSuccess) {
              this.loading = false;
              if (res.data != null) {
                this.messageDtos = res.data
                this.genericFormService.filteredCdcategoryDtos = this.genericFormService.filterCategories(this.genericFormService.cdcategoryDtos, res.data as MessageDto[])
              }
              this.config.totalRecords = res.totalCount;
              this.CompeletAdminCerObject();
            }
            else {
              this.loading = false;
              let errors = "";
              res.errors.forEach((e: any) => {
                errors += e.message + '\n';
              });
              this.msg.msgError('Error', '<h5>' + errors + '</h5>', true)
            }
          },
          error: (error) => {
            this.loading = false;
            this.msg.msgError('Error', '<h5>' + error.message + '</h5>', true)
          },
          complete: () => {
            this.loading = false;
          }
        })
    }
  }

  private ensureAdminListRequestModel(src: any): ListRequestModel {
    if (!src) return src as ListRequestModel;
    const search = src.search ? { ...src.search } : undefined;
    // ensure required property isSearch exists on search
    if (search && (search.isSearch === undefined)) {
      // derive a sensible default: true when a searchKind is present and not NoSearch
      if (search.searchKind !== undefined) {
        search.isSearch = search.searchKind !== SearchKind.NoSearch;
      } else {
        search.isSearch = false;
      }
    }
    return { ...src, search } as ListRequestModel;
  }

  private CompeletAdminCerObject(source?: any[]) {
    // const src = source ?? this.config.requestsarray?.[0]?.arrValue ?? this.config.requestsarray?.[0]?.arrValue ?? [];
    // const sourceArray = Array.isArray(src) ? src.slice() : [];
    this.messageDtos.map(m => {
      (m as any).categoryCd = this.config.tkCategoryCds.find(cd => cd.key === Number((m as any).categoryCd))?.value || (m as any).categoryCd;
      return m;
    });

    if (!this.config) return;
    this.config.tableColumns.forEach(col => this.populateRequesterNames(col.key, col.value));
  }

  populateRequesterNames(fieldName: string, fieldValue: string) {
    this.messageDtos.forEach(message => {
      const requesterField = message.fields?.find(field => field.fildKind === fieldName);
      (message as any)[fieldValue] = requesterField?.fildTxt || '';
    });
  }
}
