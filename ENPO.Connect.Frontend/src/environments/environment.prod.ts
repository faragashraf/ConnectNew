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
  useLocalMockAuth: false,
  disableSignalRInLocalMock: false,
  localMockAuthPath: '/api/LocalAuth/DevLogin',
  localMockUserId: 'test',
  localMockPassword: 'test123',

  ConnectApiURL: `${MainDomain}/Applications/Connect_API`,
  LandTransportationApiURL: `${MainDomain}/Applications/Connect_API`,
  DomainAuthURL: `${MainDomain}/Applications/Domain_Authorization`,
  SSoURL: `${MainDomain}/Applications/SSO`,
  PowerBi: `${MainDomain}/Applications/PowerBi`,
  SignalRHubServer: `${MainDomain}/Applications/GlobalHubSync`,
  PublicationsUrl: `${MainDomain}/Applications/publicationsApi`,
};
