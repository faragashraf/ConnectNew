import { Component, OnInit, OnDestroy } from '@angular/core';
import { FormBuilder } from '@angular/forms';
import { Subscription } from 'rxjs';
import { AuthorizationController } from 'src/app/Modules/auth/services/Authorization.service';
import { GenerateQueryService } from 'src/app/Modules/enpopower-bi/services/generate-query.service';
import { PowerBiController } from 'src/app/Modules/enpopower-bi/services/PowerBi.service';
import { MsgsService } from 'src/app/shared/services/helper/msgs.service';
import { NotificationDto, NotificationType, NotificationCategory, SignalRService, UserDataDto } from 'src/app/shared/services/SignalRServices/SignalR.service';
import { SpinnerService } from 'src/app/shared/services/helper/spinner.service';
import { assignSubscription } from 'src/app/shared/services/SignalRServices/AdminCerObjectHub.service';
import { MenuItem } from 'primeng/api';

@Component({
  selector: 'app-onlin-users',
  templateUrl: './onlin-users.component.html',
  styleUrls: ['./onlin-users.component.scss']
})
export class OnlinUsersComponent implements OnInit, OnDestroy {

  itemData: any[] = [];
  item_columns: string[] = [];
  contextMenuItems: MenuItem[] = [];

  // Dialog properties
  displayUserDetailsDialog: boolean = false;
  selectedUserDetails: UserDataDto = {} as UserDataDto;

  // Loading states
  isRefreshing: boolean = false;

  private onlineUsersSubscription!: Subscription;
  private connectionStateSubscription!: Subscription;

  constructor(private spinner: SpinnerService, private msg: MsgsService, public signalRService: SignalRService,
    public generateQueryService: GenerateQueryService) {
    this.generateQueryService.tableGenericData = []
    this.generateQueryService._columns = []
    this.generateQueryService.duration = 0;
  }

  ngOnInit(): void {
    this.initializeContextMenu();

    // Initial assignment with current users
    const initialFormattedUsers = this.signalRService.onlineUsers.map(user => ({
      ...user,
      lastSeen: user.lastSeen ? new Date(user.lastSeen).toLocaleString() : 'Never'
    }));
    this.itemData = initialFormattedUsers;
    if (this.itemData.length > 0) {
      this.item_columns = Object.keys(this.itemData[0]);
    }

    // Set up subscription using the helper function like in app component
    this.onlineUsersSubscription = assignSubscription(
      this.onlineUsersSubscription,
      this.signalRService.OnLineUsers$,
      (users: UserDataDto[]) => {
        if (users && users.length > 0) {
          const formattedUsers = users.map(user => ({
            ...user,
            lastSeen: user.lastSeen ? new Date(user.lastSeen).toLocaleString() : 'Never'
          }));
          this.item_columns = Object.keys(formattedUsers[0]);
          this.itemData = formattedUsers;
        } else {
          this.itemData = [];
          this.item_columns = [];
        }
      },
      (error) => {
        console.error('Error in OnLineUsers$ subscription:', error);
      }
    );
    this.signalRService.hubConnection.invoke('DisplayOnlineUsers')
      .catch(error => console.log(error));

    if (this.signalRService.hubConnection && this.signalRService.hubConnection.state !== 'Connected') {
      console.log('SignalR not connected, waiting for connection...');
      this.connectionStateSubscription = assignSubscription(
        this.connectionStateSubscription,
        this.signalRService.hubConnectionState$,
        (state: string) => {
          if (state === 'Online' || state === 'Connection Started') {
            if (this.itemData.length > 0) {
              this.item_columns = Object.keys(this.itemData[0]);
            }
            if (this.connectionStateSubscription) {
              this.connectionStateSubscription.unsubscribe();
              this.connectionStateSubscription = null as any;
            }
          }
        }
      );
    }
  }

  ngOnDestroy(): void {
    if (this.onlineUsersSubscription) {
      this.onlineUsersSubscription.unsubscribe();
    }
    if (this.connectionStateSubscription) {
      this.connectionStateSubscription.unsubscribe();
    }
  }

  onselectItemEvent(event: any) {
    console.log(event)
  }

  // Method to manually test the subscription
  testSubscription() {
    this.isRefreshing = true;
    console.log('=== Testing SignalR Subscription ===');
    console.log('hubConnection state:', this.signalRService.hubConnection?.state);
    console.log('hubConnectionState property:', this.signalRService.hubConnectionState);
    console.log('onlineUsers array:', this.signalRService.onlineUsers);
    console.log('OnLineUsers$ subject:', this.signalRService.OnLineUsers$);
    console.log('Current itemData:', this.itemData);

    // Force refresh from current array
    const refreshedUsers = this.signalRService.onlineUsers
  //    .filter(u => u.userId !== this.signalRService.userAuth)
      .map(user => ({
        ...user,
        lastSeen: user.lastSeen ? new Date(user.lastSeen).toLocaleString() : 'Never'
      }));
    this.itemData = [...refreshedUsers];
    console.log('After refresh, itemData:', this.itemData);

    // Manually trigger the subject to test if subscription is working
    console.log('Manually triggering OnLineUsers$ subject...' + this.signalRService.userAuth);
    const formattedUsers = this.signalRService.onlineUsers
    //  .filter(u => u.userId !== this.signalRService.userAuth)
      .map(user => ({
        ...user,
        lastSeen: user.lastSeen ? new Date(user.lastSeen).toLocaleString() : 'Never'
      }));
    this.signalRService.OnLineUsers$.next([...formattedUsers]);
    
    // Simulate loading delay
    setTimeout(() => {
      this.isRefreshing = false;
    }, 1500);
  }
  initializeContextMenu() {
    this.contextMenuItems = [
      {
        label: 'View User Details',
        icon: 'pi pi-user',
        command: (event) => this.viewUserDetails(event)
      },
      {
        label: 'Send Message',
        icon: 'pi pi-envelope',
        command: (event) => this.sendMessage(event)
      },
      {
        label: 'Send Notification',
        icon: 'pi pi-bell',
        command: (event) => this.sendNotification(event)
      },
      {
        label: 'Copy User ID',
        icon: 'pi pi-copy',
        command: (event) => this.copyUserId(event)
      },
      {
        separator: true
      },
      {
        label: 'Disconnect User',
        icon: 'pi pi-power-off',
        command: (event) => this.disconnectUser(event)
      }
    ];
  }

  viewUserDetails(event: any) {
    console.log('View user details:', this.generateQueryService.tableGenericSelectedRow);

    if (this.generateQueryService.tableGenericSelectedRow) {
      this.selectedUserDetails = { ...this.generateQueryService.tableGenericSelectedRow };
      this.displayUserDetailsDialog = true;
    } else {
      this.msg.msgError('No user selected', 'Please select a user first');
    }
  }

  sendMessage(event: any) {
    console.log('Send message to user:', this.generateQueryService.tableGenericSelectedRow);
    // Implement send message logic
  }

  sendNotification(event: any) {
    const selectedUser = this.generateQueryService.tableGenericSelectedRow;
    console.log('Send notification to user:', selectedUser);
    if (selectedUser && selectedUser.userId) {
      // You can customize the notification message here
      const notificationMessage: NotificationDto = {
        type: NotificationType.info,
        sender: this.signalRService.userAuth,
        title: 'رسالة - مدير التطبيق',
        notification: 'شكراً جزيلا وبأعتذر عن الإزعاج',
        category: NotificationCategory.system,
        time: new Date(),
        readStatus: false
      };
      // Use SignalR service to send notification to specific user
      this.signalRService.SendNotificationToUser(selectedUser.userId, notificationMessage)
        .then(() => {
          this.msg.msgSuccess(`Notification sent to ${selectedUser.userName || selectedUser.userId}`);
        })
        .catch((error) => {
          console.error('Error sending notification:', error);
          this.msg.msgError('Notification Error', 'Failed to send notification');
        });
    }
  }

  copyUserId(event: any) {
    const selectedUser = this.generateQueryService.tableGenericSelectedRow;
    if (selectedUser && selectedUser.userId) {
      navigator.clipboard.writeText(selectedUser.userId).then(() => {
        this.msg.msgSuccess('User ID copied to clipboard!');
      });
    }
  }

  disconnectUser(event: any) {
    console.log('Disconnect user:', this.generateQueryService.tableGenericSelectedRow);
    this.signalRService.LogOut(this.generateQueryService.tableGenericSelectedRow.userId);
  }

  ContextMenuSelect(ev: any) {
    console.log('Context menu item selected:', ev);
    // The context menu actions are now handled by individual command methods
  }

  closeUserDetailsDialog() {
    this.displayUserDetailsDialog = false;
    this.selectedUserDetails = {} as UserDataDto;
  }

  // Connection status methods
  getConnectionStatusClass(): string {
    const state = this.signalRService.hubConnectionState;
    if (state === 'Online' || state === 'Connection Started') {
      return 'status-online';
    } else if (state === 'Connecting') {
      return 'status-connecting';
    } else {
      return 'status-offline';
    }
  }

  getConnectionStatusText(): string {
    const state = this.signalRService.hubConnectionState;
    switch (state) {
      case 'Online':
      case 'Connection Started':
        return 'Connected : ' + this.signalRService.hubConnection?.connectionId;
      case 'Connecting':
        return 'Connecting...';
      case 'Disconnected':
        return 'Disconnected';
      default:
        return state || 'Unknown';
    }
  }

  // Export functionality
  exportUsers() {
    if (this.itemData && this.itemData.length > 0) {
      // You can implement Excel export here using xlsx library
      this.msg.msgSuccess('Export functionality will be implemented');
    } else {
      this.msg.msgError('No data to export', 'Please ensure there are users to export');
    }
  }

  // Broadcast message functionality
  sendBroadcastMessage() {
    // Implement broadcast message dialog
    this.msg.msgInfo('Broadcast message feature will be implemented');
  }

  // Dialog helper methods
  getFilteredColumns(): string[] {
    // Filter out internal or unwanted columns for display
    return this.item_columns.filter(col => 
      !['uniqId', 'connectionId'].includes(col)
    );
  }

  getFieldIcon(fieldName: string): string {
    const iconMap: { [key: string]: string } = {
      'userId': 'pi-id-card',
      'userName': 'pi-user',
      'isOnline': 'pi-wifi',
      'connectionTime': 'pi-clock',
      'lastActivity': 'pi-history',
      'lastSeen': 'pi-eye',
      'ipAddress': 'pi-globe',
      'userAgent': 'pi-desktop',
      'sessionId': 'pi-key',
      'email': 'pi-envelope',
      'role': 'pi-shield'
    };
    return iconMap[fieldName] || 'pi-info-circle';
  }

  getFieldLabel(fieldName: string): string {
    const labelMap: { [key: string]: string } = {
      'userId': 'User ID',
      'userName': 'User Name',
      'isOnline': 'Status',
      'connectionTime': 'Connected At',
      'lastActivity': 'Last Activity',
      'lastSeen': 'Last Seen',
      'ipAddress': 'IP Address',
      'userAgent': 'User Agent',
      'sessionId': 'Session ID',
      'email': 'Email',
      'role': 'Role'
    };
    return labelMap[fieldName] || fieldName.charAt(0).toUpperCase() + fieldName.slice(1);
  }

  getRelativeTime(date: any): string {
    if (!date) return '';
    
    const now = new Date();
    const past = new Date(date);
    const diffInMinutes = Math.floor((now.getTime() - past.getTime()) / (1000 * 60));
    
    if (diffInMinutes < 1) return 'Just now';
    if (diffInMinutes < 60) return `${diffInMinutes} minute(s) ago`;
    
    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) return `${diffInHours} hour(s) ago`;
    
    const diffInDays = Math.floor(diffInHours / 24);
    return `${diffInDays} day(s) ago`;
  }

  // Method to get current application counts
  getCurrentApplicationCounts(): { [key: string]: number } {
    const counts: { [key: string]: number } = {};
    
    this.itemData.forEach(user => {
      if (user.currentAplication) {
        counts[user.currentAplication] = (counts[user.currentAplication] || 0) + 1;
      }
    });
    
    return counts;
  }

  // Method to get the most common application
  getMostCommonApplication(): { name: string; count: number } {
    const counts = this.getCurrentApplicationCounts();
    let maxCount = 0;
    let mostCommonApp = 'N/A';
    
    Object.entries(counts).forEach(([app, count]) => {
      if (count > maxCount) {
        maxCount = count;
        mostCommonApp = app;
      }
    });
    
    return { name: mostCommonApp, count: maxCount };
  }

  // Method to get formatted application counts for display
  getFormattedApplicationCounts(): string {
    const counts = this.getCurrentApplicationCounts();
    const entries = Object.entries(counts);
    
    if (entries.length === 0) return 'No applications';
    if (entries.length === 1) return `${entries[0][1]} in ${entries[0][0]}`;
    
    return entries.map(([app, count]) => `${count} ${app}`).join(', ');
  }

  // Method to get unique applications count
  getUniqueApplicationsCount(): number {
    return Object.keys(this.getCurrentApplicationCounts()).length;
  }

  // Method to get detailed application breakdown tooltip
  getApplicationBreakdownTooltip(): string {
    const counts = this.getCurrentApplicationCounts();
    const entries = Object.entries(counts);
    
    if (entries.length === 0) return 'No active applications';
    
    return entries
      .sort(([,a], [,b]) => b - a) // Sort by count descending
      .map(([app, count]) => `${app}: ${count} users`)
      .join('\n');
  }
}
