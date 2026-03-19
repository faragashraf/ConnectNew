import { Injectable } from '@angular/core';
import { DomSanitizer, SafeUrl } from '@angular/platform-browser';

@Injectable({
  providedIn: 'root'
})

export class AttchedObjectService {

  constructor(private sanitizer: DomSanitizer) { }
  public createObjectURL(_array: string, fileNameWithExt: string) {
    let fille!: FileHandle
    fille = this.createFileTemplate(_array, fileNameWithExt)[0]
    const a = document.createElement('a');
    const fileURL = window.URL.createObjectURL(fille.file as File);
    a.href = fileURL;
    a.download = fileNameWithExt;


    const link = document.createElement('a');
    link.href = fileURL;
    link.download = fileNameWithExt;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    // Clean up the object URL after a short delay
    setTimeout(() => {
      URL.revokeObjectURL(fileURL);
    }, 1000);
  }
  private createFileTemplate(_array: string, fileNameWithExt: string): FileHandle[] {
    let splitCount = fileNameWithExt.split('.').length
    let ext = fileNameWithExt.split('.')[splitCount - 1]
    const productImagesToFileHandle: FileHandle[] = [];
    const imageBlob = this.dataURItoBlob(_array, ext);
    const imageFile = new File([imageBlob], _array, { type: ext });
    const finalfileHandle: FileHandle = {
      file: imageFile,
      url: this.sanitizer.bypassSecurityTrustUrl(window.URL.createObjectURL(imageFile))
    };
    productImagesToFileHandle.push(finalfileHandle);
    return productImagesToFileHandle;
  }

  private dataURItoBlob(picByte: any, imageType: any) {
    const byteString = window.atob(picByte);
    const arrayBuffer = new ArrayBuffer(byteString.length);
    const int8Array = new Uint8Array(arrayBuffer);
    for (let i = 0; i < byteString.length; i++) {
      int8Array[i] = byteString.charCodeAt(i);
    }
    const blob = new Blob([int8Array], { type: imageType });
    return blob;
  }
}
export interface FileHandle {
  file: File | undefined,
  url: SafeUrl | undefined
}
export class file {
  constructor(
    public arr: string,
    public name: string
  ) { }
}