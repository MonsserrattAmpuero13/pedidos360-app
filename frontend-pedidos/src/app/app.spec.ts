import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { AuthService } from '@auth0/auth0-angular';
import { of } from 'rxjs';
import { AppComponent } from './app';

describe('AppComponent', () => {
  const mockAuthService = {
    isAuthenticated$: of(false),
    user$: of(null),
    loginWithRedirect: () => {},
    logout: () => {}
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [
        provideHttpClient(),
        { provide: AuthService, useValue: mockAuthService }
      ]
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });
});