import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { ControlCenterViewModel } from '../../facades/admin-control-center.facade';

@Component({
  selector: 'app-control-center-summary',
  templateUrl: './control-center-summary.component.html',
  styleUrls: ['./control-center-summary.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ControlCenterSummaryComponent {
  @Input() viewModel: ControlCenterViewModel | null = null;

  resolveStateLabel(state: ControlCenterViewModel['publishState'] | undefined): string {
    if (state === 'published') {
      return 'منشور';
    }
    if (state === 'ready') {
      return 'جاهز للنشر';
    }
    if (state === 'blocked') {
      return 'متوقف';
    }

    return 'مسودة';
  }

  resolveStateSeverity(state: ControlCenterViewModel['publishState'] | undefined): 'success' | 'warning' | 'danger' | 'info' {
    if (state === 'published') {
      return 'success';
    }
    if (state === 'ready') {
      return 'success';
    }
    if (state === 'blocked') {
      return 'danger';
    }

    return 'info';
  }
}
