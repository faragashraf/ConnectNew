import { AllNotificationsComponent } from './all-notifications.component';
import { ConditionalDate } from '../../Pipe/Conditional-date.pipe';

describe('AllNotificationsComponent', () => {
  let component: AllNotificationsComponent;

  beforeEach(() => {
    component = new AllNotificationsComponent(new ConditionalDate());
  });

  it('sorts notifications by newest time first', () => {
    component.notifications = [
      { notification: 'old', time: '2026-03-30T09:00:00Z' },
      { notification: 'new', time: '2026-03-30T12:00:00Z' },
      { notification: 'mid', time: '2026-03-30T10:00:00Z' }
    ];

    const sorted = component.sortedNotifications;

    expect(sorted.map(item => item.notification)).toEqual(['new', 'mid', 'old']);
  });

  it('returns a new sorted array without mutating the source array order', () => {
    component.notifications = [
      { notification: 'first-in-source', time: '2026-03-30T09:00:00Z' },
      { notification: 'second-in-source', time: '2026-03-30T12:00:00Z' }
    ];

    const sorted = component.sortedNotifications;

    expect(sorted).not.toBe(component.notifications);
    expect(component.notifications.map(item => item.notification)).toEqual([
      'first-in-source',
      'second-in-source'
    ]);
  });

  it('emits false when close is called', () => {
    const emitted: boolean[] = [];
    component.display = true;
    component.displayChange.subscribe(value => emitted.push(value));

    component.close();

    expect(component.display).toBeFalse();
    expect(emitted).toEqual([false]);
  });
});
