export const environment = {
  production: true, // o false según el archivo
  apiUrl: 'https://pedidos360-apim.azure-api.net/api/pedidos',
  azureConfig: {
    clientId: 'a47d79a3-f4c3-491d-a83c-033ef226f73d',
    authority: 'https://login.microsoftonline.com/common',
    redirectUri: window.location.origin,
    apiScope: 'api://8e91a4fd-0516-4b61-b0a8-91d05ec066c8/Pedidos.Read'
  }
};