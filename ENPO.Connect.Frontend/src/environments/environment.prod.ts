const MainDomain = 'https://connect.egyptpost.gov.eg';

export const environment = {
  production: true,
  deploymentMode: 'prod',
  theme: 'prod',
  showDevRibbon: false,
  showTestRibbon: false,
  enableWatermark: false,
  enableDevWatermark: false,
  titleSuffix: '',
  favicon: 'assets/brand/favicon.ico',

OTPApplicationName: 'CONNECT',

  ConnectApiURL: `${MainDomain}/Applications/Connect_API`,
  LandTransportationApiURL: `${MainDomain}/Applications/Connect_API`,
  DomainAuthURL: `${MainDomain}/Applications/Domain_Authorization`,
  SSoURL: `${MainDomain}/Applications/SSO`,
  PowerBi: `${MainDomain}/Applications/PowerBi`,
  SignalRHubServer: `${MainDomain}/Applications/GlobalHubSync`,
  PublicationsUrl: `${MainDomain}/Applications/publicationsApi`,

  summerFeature: {
    seasonYear: 2026,
    dynamicApplicationId: 'SUM2026DYN',
    destinationCatalogKey: 'SUM2026_DestinationCatalog',
    pdfReferenceTitle: 'مواعيد الافواج موسم صيف 2026.pdf'
  }
};
