const MainDomain = 'https://test.egyptpost.gov.eg';


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
  
  // ConnectApiURL: `${MainDomain}/Applications/Connect_API`,
  LandTransportationApiURL: `${MainDomain}/Applications/Connect_API`,
  DomainAuthURL: `${MainDomain}/Applications/Domain_Authorization`,
  SSoURL: `${MainDomain}/Applications/SSO`,
  PowerBi: `${MainDomain}/Applications/PowerBi`,
  SignalRHubServer: `${MainDomain}/Applications/GlobalHubSync`,

  // SignalRHubServer: `http://localhost:5005`,
  // LandTransportationApiURL: `http://localhost:8888`,
  ConnectApiURL: `http://localhost:8888`,
  // DomainAuthURL:  "https://localhost:8998",
  // PowerBi: "http://localhost:8020",
  // PublicationsUrl: "http://localhost:5269",
};

