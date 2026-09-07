import { ApplicationConfig, provideZoneChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideAuth0, authHttpInterceptorFn } from '@auth0/auth0-angular';
import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes),
    provideHttpClient(
      withInterceptors([authHttpInterceptorFn])
    ),
    provideAuth0({
      domain: 'dev-ukv714fluyvpdwzv.us.auth0.com',
      clientId: 'Q8W8Bv8LC9PzxkMki1pZzo9JgmUCiPzB',
      authorizationParams: {
        redirect_uri: window.location.origin,
        audience: 'https://api-pedidos-360.azurewebsites.net'
      },
      httpInterceptor: {
        allowedList: [
          'https://pedidos360-apim.azure-api.net/*', // Agregado para que Auth0 inyecte el token al Gateway
          'https://*.azurewebsites.net/*',
          'http://localhost:8080/*'
        ]
      }
    })
  ]
};