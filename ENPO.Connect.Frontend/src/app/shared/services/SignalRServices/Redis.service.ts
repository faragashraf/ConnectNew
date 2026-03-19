import { Injectable } from "@angular/core";
import { SignalRService } from "./SignalR.service";
import { Subject } from "rxjs";
import { ConditionalDate } from "../../Pipe/Conditional-date.pipe";
import * as signalR from "@microsoft/signalr";
import { MsgsService } from "../helper/msgs.service";



export class HubException extends Error {
    constructor(message: string) {
        super(message);
        this.name = "HubException";
    }
}

@Injectable({
    providedIn: 'root'
})
export class RedisHubService {
    HeldObject$ = new Subject<any>();

    constructor(private signalRService: SignalRService, private conditionalDate: ConditionalDate, private msg: MsgsService) {
        // this.onReciveObject();
    }


    onReciveObject() {
        // if (this.signalRService.hubConnection.state == signalR.HubConnectionState.Connected) {
        //     this.signalRService.hubConnection.on('ReciveObject', (object: any) => {
        //         console.log('object', object);
        //     });
        // } else {
        //     console.error('hubConnection is not initialized or does not have an "on" method.');
        // }
    }
    public addListedAppPattern(listKey: string, appPattern: string): Promise<boolean> {
        return this.signalRService.hubConnection.invoke<boolean>('AddListedAppPattern', listKey, appPattern)
            .then(result => {
                if (result)
                    console.log('App pattern added successfully:', result);
                else
                    console.log('App pattern Not added successfully:', result);

                return result;
            })
            .catch(err => {
                // Wrap the error in HubException
                this.msg.msgError('HubServer Error', err.message)
                throw new HubException(typeof err === 'string' ? err : (err?.message || 'Unknown Hub error'));
            });
    }
    public RemoveListedAppPatternAsync(listKey: string, appPattern: string): Promise<boolean> {
        return this.signalRService.hubConnection.invoke<boolean>('RemoveListedAppPattern', listKey, appPattern)
            .then(result => {
                if (result)
                    console.log('App pattern Removed successfully:', result);
                else
                    console.log('App pattern Not Removed successfully:', result);


                return result;
            })
            .catch(err => {
                this.msg.msgError('HubServer Error', err.message)
                throw err;
            });
    }
}