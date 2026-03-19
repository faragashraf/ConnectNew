import { Injectable } from '@angular/core';

export interface DbRecord {
  id: any,
  object: any,
}
@Injectable({
  providedIn: 'root'
})
export class IndexDbService {
  indexedDB = window.indexedDB || (window as any).mozIndexedDB || (window as any).webkitIndexedDB || (window as any).msIndexedDB;

  public db!: IDBDatabase;
  public dbName!: string
  public ObjectStoreName: string = ''

  constructor() { }

  public initIndexedDB(): Promise<void> {
    return new Promise((resolve, reject) => {
      // let ver: number = this.db.version
      const request = this.indexedDB.open(this.dbName, 1);

      request.onerror = (event) => {
        console.error("Error: ", event);
        reject();
      };

      request.onsuccess = (event) => {
        this.db = request.result as IDBDatabase; // Casting to IDBDatabase
        resolve();
        console.log("Success: ", this.db);
      };

      request.onupgradeneeded = (event) => {
        this.db = request.result as IDBDatabase; // Casting to IDBOpenDBRequest
        // if (this.db.objectStoreNames.contains(this.ObjectStoreName)) {
        //   this.db.deleteObjectStore(this.ObjectStoreName); // Delete the existing object store
        // }
        this.db.createObjectStore(this.ObjectStoreName, { keyPath: "id" })
      };
      resolve();
    });
  }
  public connectIndexedDB(): Promise<void> {
    return new Promise((resolve, reject) => {
      // let ver: number = this.db.version
      const request = this.indexedDB.open(this.dbName);

      request.onerror = (event) => {
        console.error("Error: ", event);
        reject();
      };

      request.onsuccess = (event) => {
        this.db = request.result as IDBDatabase; // Casting to IDBDatabase
        resolve();
      };
    });
  }

  read(id: any): Promise<any> {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.ObjectStoreName]);
      const objectStore = transaction.objectStore(this.ObjectStoreName);
      const request = objectStore.get(id);

      request.onerror = (event) => {
        reject("Unable to retrieve data from database!");
      };

      request.onsuccess = (event) => {
        const result = request.result;
        if (result) {
          resolve(result);
        } else {
          reject(`${id} couldn't be found in your database!`);
        }
      };
    });
  }

  readAll(): Promise<any[]> {           // Select All Record From Db Object "Table"
    return new Promise((resolve, reject) => {
      const objectStore = this.db.transaction(this.ObjectStoreName).objectStore(this.ObjectStoreName);
      const data: any[] = [];

      objectStore.openCursor().onsuccess = (event) => {
        const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
        if (cursor) {
          // Push cursor value to data array
          data.push(cursor.value);
          cursor.continue();
        } else {
          // Resolve the promise with the collected data array when cursor ends
          resolve(data);
        }
      };

      objectStore.openCursor().onerror = (event) => {
        // Reject the promise if there's an error
        reject(event);
      };
    });
  }

  add(object: DbRecord) {               // Select a Record From Db Object "Table" with ID
    console.log('addObject',object);
    const request = this.db.transaction([this.ObjectStoreName], "readwrite")
      .objectStore(this.ObjectStoreName)
      .add(object);

    request.onsuccess = (event) => {
      console.log(event);
      console.log("Item has been added to your database.");
    };

    request.onerror = (event) => {
      console.log(request);
      this.update(object)
      console.error("Unable to add data. ", "Item already exists in your database!");
    };
  }

  remove(id: string) {                  // Delete a Record From Db Object "Table" With ID
    const request = this.db.transaction([this.ObjectStoreName], "readwrite").objectStore(this.ObjectStoreName).delete(id);

    request.onsuccess = (event) => {
      console.log("Entry has been removed from your database.");
    };

    request.onerror = (event) => {
      console.error("Unable to remove entry from database");
    };
  }

  update(object: DbRecord) {            // Update a Record in Db Object "Table" With ID
    const request = this.db.transaction([this.ObjectStoreName], "readwrite")
      .objectStore(this.ObjectStoreName)
      .put(object);

    request.onsuccess = (event) => {
      console.log("Updated Successfully.");
    };

    request.onerror = (event) => {
      console.error("Unable to update data");
    };
  }

  deleteDatabase() {
    this.db.close(); // Close the database connection before deleting
    const request = window.indexedDB.deleteDatabase(this.dbName);

    request.onsuccess = (event) => {
      console.log("Object store deleted successfully", event);
    };

    request.onerror = (event) => {
      console.error("Error deleting object store", event);
    };

  }
  createObjectStore(ObjectStoreName: string) {
    let version: number = this.db.version;
    // this.db.close();
    const request = this.indexedDB.open(this.dbName, version + 1);

    request.onerror = (event) => {
      console.error("Error: ", event);
    };

    request.onsuccess = (event) => {
      this.db = request.result as IDBDatabase; // Casting to IDBDatabase
      console.log("Success: ", this.db);
    };

    request.onupgradeneeded = (event) => {
      this.db = request.result as IDBDatabase; // Casting to IDBOpenDBRequest
      // if (this.db.objectStoreNames.contains(this.ObjectStoreName)) {
      //   this.clearObjectStore(this.ObjectStoreName)
      //   this.db.deleteObjectStore(this.ObjectStoreName); // Delete the existing object store
      // }
      this.db.createObjectStore(ObjectStoreName, { keyPath: "id" });
    };
  }
  deleteObjectStore(objectName: string) {
    let version: number = this.db.version;
    this.db.close(); // Close the database connection before deleting
    const request = this.indexedDB.open(this.dbName, version + 1);

    request.onerror = (event) => {
      console.error("Error: ", event);
    };

    request.onsuccess = (event) => {
      this.db = request.result as IDBDatabase; // Casting to IDBDatabase
      console.log("Success: ", this.db);
    };

    request.onupgradeneeded = (event) => {
      this.db = request.result as IDBDatabase; // Casting to IDBOpenDBRequest
      if (this.db.objectStoreNames.contains(objectName)) {
        
        this.db.deleteObjectStore(objectName); // Delete the existing object store
      }
    };
  }
  clearObjectStore(objectName: string) {
    const request = this.db.transaction(objectName, 'readwrite')
      .objectStore(objectName);

    const request1 = request
      .clear();

      request1.onerror = (event) => {
      console.error(event);
    };

    request1.onsuccess = (event) => {
      const result = request1.result;
      console.log(event);
    }
  }
}
