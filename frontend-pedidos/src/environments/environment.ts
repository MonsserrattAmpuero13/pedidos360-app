export const environment = {
  production: false,
  apiUrl: 'https://api-pedidos-360-cjc8bmcbgmdjhxb2.westus3-01.azurewebsites.net/api/pedidos',
  azureConfig: {
    clientId: 'a47d79a3-f4c3-491d-a83c-033ef226f73d',
    authority: 'https://login.microsoftonline.com/common',
    redirectUri: window.location.origin,
    apiScope: 'api://8e91a4fd-0516-4b61-b0a8-91d05ec066c8/Pedidos.Read'
  }
};