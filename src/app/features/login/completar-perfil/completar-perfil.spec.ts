import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CompletarPerfil } from './completar-perfil';

describe('CompletarPerfil', () => {
  let component: CompletarPerfil;
  let fixture: ComponentFixture<CompletarPerfil>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CompletarPerfil],
    }).compileComponents();

    fixture = TestBed.createComponent(CompletarPerfil);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
