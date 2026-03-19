import { Injectable } from '@angular/core';

// Define type for print styles
export type PrintStyles = {
  [selector: string]: {
    [property: string]: string
  }
};


@Injectable({
  providedIn: 'root'
})


export class PrintService {
  a4PortraitStyles: PrintStyles = {
    '@font-face': {
      'font-family': 'Khaled Art',
      'src': `url('assets/fonts/KhaledArt.ttf') format('truetype')`,
      'font-weight': 'normal',
      'font-style': 'normal',
    },
    '@page': {
      'size': 'A4 portrait',
      'margin': '.25cm'
    }, 'body': {
      'position': 'relative'
    },
    '.letter-container': {
      'text-align': 'center',
      'direction': 'rtl',
      'font-family': 'Khaled Art !important',
      'line-height': '2', // Increased line spacing for better readability
      'margin-right': '67px',
      'margin-left': '67px',
      'margin-top': '82px',
      'color': 'black'
    },
    '.header-section': {
      'text-align': 'right',
      // 'margin-bottom': '20px'
    },
    '.certificate': {
      'text-align': 'justify',
      // 'margin': '0 20px'
    },
    '.centered-title': {
      'text-align': 'center',
      'font-weight': 'bold',
      // 'margin': '20px 0',
      'font-size': '1.2rem' // Slightly larger font size for titles
    },
    '.requester-info': {
      'text-align': 'right',
      // 'margin-bottom': '10px'
    },
    '.indented-text': {
      'text-align': 'center',
      // 'margin-right': '6rem'
    },
    '.justified-text': {
      'text-align': 'justify',
      'font-family': 'Khaled Art !important',
      // 'margin': '0 15px', // Increased spacing between paragraphs
      'line-height': '2', // Increased line spacing for better readability
      'font-size': '1rem' // Slightly larger font size for body text
    },
    '.textarea-class': {
      'font-size': '1rem',
      'font-weight': 'bold',
      'font-family': 'Khaled Art !important',
      'border-color': 'transparent',
      'width': '100%',
      'resize': 'none'
    },
    '.footer-section': {
      'width': '100%',
      'text-align': 'center',
      // 'margin-top': '10px'
    }, '.justified-arabic-text': {
      'text-align': 'justify',
      'direction': 'rtl',
      'font-family': 'Khaled Art !important',
      'font-size': 'small',
      'line-height': '1.8',
      'white-space': 'pre-line'
    }
  };

  a5LandscapeStyles: PrintStyles = {
    '@page': {
      'size': 'A5 landscape',
      // 'margin': '0'
    }
  };
}
