import { Component, OnDestroy, OnInit } from '@angular/core';
import { Subscription } from 'rxjs';
import { DynamicSubjectsController } from 'src/app/shared/services/BackendServices/DynamicSubjects/DynamicSubjects.service';
import { EnvelopeListQueryDto, EnvelopeSummaryDto } from 'src/app/shared/services/BackendServices/DynamicSubjects/DynamicSubjects.dto';
import { AppNotificationService } from 'src/app/shared/services/notifications/app-notification.service';
import { DynamicSubjectsRealtimeService } from '../../services/dynamic-subjects-realtime.service';

@Component({
  selector: 'app-dynamic-subject-envelope-list',
  templateUrl: './dynamic-subject-envelope-list.component.html',
  styleUrls: ['./dynamic-subject-envelope-list.component.scss']
})
export class DynamicSubjectEnvelopeListComponent implements OnInit, OnDestroy {
  envelopes: EnvelopeSummaryDto[] = [];
  totalCount = 0;
  loading = false;
  query: EnvelopeListQueryDto = {
    pageNumber: 1,
    pageSize: 20
  };

  private readonly subscriptions: Subscription[] = [];

  constructor(
    private readonly dynamicSubjectsController: DynamicSubjectsController,
    private readonly realtimeService: DynamicSubjectsRealtimeService,
    private readonly appNotification: AppNotificationService
  ) {}

  ngOnInit(): void {
    this.load();
    this.subscriptions.push(
      this.realtimeService.events$().subscribe(eventItem => {
        if (!eventItem.entityType || eventItem.entityType.toLowerCase() !== 'envelope') {
          return;
        }

        this.load();
      })
    );
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(subscription => subscription.unsubscribe());
  }

  load(): void {
    this.loading = true;
    this.dynamicSubjectsController.listEnvelopes(this.query).subscribe({
      next: response => {
        if (response?.errors?.length) {
          this.envelopes = [];
          this.totalCount = 0;
          this.appNotification.showApiErrors(response.errors, 'تعذر تحميل قائمة الأظرف الواردة.');
          return;
        }

        this.envelopes = response?.data?.items ?? [];
        this.totalCount = Number(response?.data?.totalCount ?? 0);
        this.envelopes.forEach(item => this.realtimeService.joinEnvelopeGroup(item.envelopeId));
      },
      error: () => {
        this.appNotification.error('حدث خطأ أثناء تحميل قائمة الأظرف الواردة.');
      },
      complete: () => {
        this.loading = false;
      }
    });
  }

  applySearch(searchText: string): void {
    this.query.searchText = searchText?.trim() || undefined;
    this.query.pageNumber = 1;
    this.load();
  }
}
