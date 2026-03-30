const MainDomain = 'https://10.10.31.52/';


// Ashraf faragalaah

export const environment = {
  production: false,
  development: true,
  deploymentMode: 'dev',
  theme: 'dev',
  showDevRibbon: true,
  showTestRibbon: false,
  enableWatermark: false, // General/Test watermark
  enableDevWatermark: true, // Dev specific watermark
  titleSuffix: ' (DEV)',
  favicon: 'assets/brand/favicon-dev.ico',
  
  OTPApplicationName: 'CONNECT - TEST',

  // ConnectApiURL: BaseUrl + "/Connect_API",
  // LandTransportationApiURL: BaseUrl + "/Connect_API",
  // DomainAuthURL: BaseUrl + "/Domain_Authorization",
  // SSoURL: BaseUrl + "/SSO",
  // PowerBi: BaseUrl + "/PowerBi",
  // PowerBi: "http://10.10.31.155/PowerBi",
  // SignalRHubServer: `http://10.10.31.52/GlobalHubSync`,
  PublicationsUrl: `http://10.10.31.52/publicationsApi`,
  // PublicationsUrl: `http://localhost:5269`,
  
  ConnectApiURL: `${MainDomain}/Applications/Connect_API`,
  LandTransportationApiURL: `${MainDomain}/Applications/Connect_API`,
  DomainAuthURL: `${MainDomain}/Applications/Domain_Authorization`,
  SSoURL: `${MainDomain}/Applications/SSO`,
  PowerBi: `${MainDomain}/Applications/PowerBi`,
  SignalRHubServer: `${MainDomain}/Applications/GlobalHubSync`,
  
// SignalRHubServer: `https://sync.webserver.local`,  // LandTransportationApiURL: `http://localhost:8888`,
//   ConnectApiURL: `https://connect.webserver.local`,
//   DomainAuthURL:  "https://auth.webserver.local",
//   // PowerBi: "http://localhost:8020",
  // PublicationsUrl: "http://localhost:5269",
  
  // Home
  
  // DomainAuthURL: 'http://localhost/Domain_Authorization',

  summerFeature: {
    seasonYear: 2026,
    dynamicApplicationId: 'SUM2026DYN',
    destinationCatalogKey: 'SUM2026_DestinationCatalog',
    pdfReferenceTitle: 'مواعيد الافواج موسم صيف 2026.pdf'
  }
};

