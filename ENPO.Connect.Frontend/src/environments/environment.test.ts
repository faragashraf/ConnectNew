const BaseUrl: string = 'http://10.10.31.52' //==> Production
const MainDomain = 'https://test.egyptpost.gov.eg';


export const environment = {
  test: true,
  production: false,
  deploymentMode: 'test',
  theme: 'test',
  showDevRibbon: false,
  showTestRibbon: true,
  enableWatermark: true,
  enableDevWatermark: false,
  titleSuffix: ' (TEST)',
  favicon: 'assets/brand/favicon-test.ico',

  OTPApplicationName: 'CONNECT - TEST',

  ConnectApiURL: `${MainDomain}/Applications/Connect_API`,
  LandTransportationApiURL: `${MainDomain}/Applications/Connect_API`,
  DomainAuthURL: `${MainDomain}/Applications/Domain_Authorization`,
  SSoURL: `${MainDomain}/Applications/SSO`,
  PowerBi: `${MainDomain}/Applications/PowerBi`,
  SignalRHubServer: `${MainDomain}/Applications/GlobalHubSync`,
  PublicationsUrl: `http://10.10.31.52/publicationsApi`,
};