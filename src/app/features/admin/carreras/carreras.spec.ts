import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Carreras } from './carreras';

describe('Carreras', () => {
  let component: Carreras;
  let fixture: ComponentFixture<Carreras>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Carreras],
    }).compileComponents();

    fixture = TestBed.createComponent(Carreras);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
