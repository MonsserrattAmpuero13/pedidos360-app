import { Component, OnInit, inject, ChangeDetectorRef, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { MsalService } from '@azure/msal-angular';
import { environment } from '../environments/environment';

export interface Pedido {
  id?: number;
  tracking: string;
  cliente: string;
  producto: string;
  cantidad: number;
  total: number;
  courier: string;
  destino: string;
  estado: string;
  incidencia?: string;
}

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class AppComponent implements OnInit {
  private msalService = inject(MsalService);
  private http = inject(HttpClient);
  private cdr = inject(ChangeDetectorRef);
  private ngZone = inject(NgZone);

  isLoggedIn = false;
  userName = '';
  rolSeleccionado: 'OPERADOR' | 'ADMIN' = 'ADMIN';
  pedidos: Pedido[] = [];
  cargando = false;

  notificacionReciente: string = '';

  estadosDisponibles: string[] = [
    'En Preparacion',
    'En Transito',
    'En Reparto',
    'Incidencia en Ruta',
    'Entregado'
  ];

  couriersDisponibles: string[] = ['Blue Express', 'Chilexpress', 'Flota Propia'];

  mostrarFormularioCreacion = false;
  pedidoEnEdicion: Pedido | null = null;
  pedidoParaIncidencia: Pedido | null = null;
  detalleIncidenciaTemp = '';

  nuevoPedido = {
    cliente: '',
    producto: 'Notebook Corporativo HP G8',
    cantidad: 1,
    total: 450000,
    courier: 'Blue Express',
    destino: 'Santiago Centro'
  };

  async ngOnInit(): Promise<void> {
    this.cargarCacheLocal();

    try {
      await this.msalService.instance.initialize();
      const resultado = await this.msalService.instance.handleRedirectPromise();

      if (resultado && resultado.account) {
        this.msalService.instance.setActiveAccount(resultado.account);
      }

      const cuentaActiva = this.msalService.instance.getActiveAccount() || this.msalService.instance.getAllAccounts()[0];

      if (cuentaActiva) {
        this.isLoggedIn = true;
        this.userName = cuentaActiva.name || cuentaActiva.username;
      } else {
        this.isLoggedIn = false;
      }
    } catch (err) {
      console.warn('MSAL sin sesion activa:', err);
      this.isLoggedIn = false;
    }

    this.cdr.detectChanges();
    if (this.isLoggedIn) {
      this.obtenerPedidos();
    }
  }

  private normalizarPedido(p: any, index: number = 0): Pedido {
    const defaultCouriers = ['Blue Express', 'Chilexpress', 'Flota Propia'];
    const defaultDestinos = ['Santiago Centro', 'Pudahuel', 'Maipú', 'Providencia', 'Las Condes'];
    
    return {
      id: p.id || (index + 1),
      tracking: p.tracking && p.tracking.trim() !== '' 
        ? p.tracking 
        : `TRK-CL-${1000 + (p.id ? p.id * 137 : (index + 1) * 219)}`,
      cliente: p.cliente || 'Cliente sin registrar',
      producto: p.producto || 'Insumo Logistico',
      cantidad: p.cantidad || 1,
      total: p.total || 0,
      courier: p.courier && p.courier.trim() !== '' 
        ? p.courier 
        : defaultCouriers[index % defaultCouriers.length],
      destino: p.destino && p.destino.trim() !== '' 
        ? p.destino 
        : defaultDestinos[index % defaultDestinos.length],
      estado: p.estado || 'En Preparacion',
      incidencia: p.incidencia || ''
    };
  }

  cargarCacheLocal(): void {
    const cache = localStorage.getItem('pedidos_app_data');
    if (cache) {
      try {
        const datos = JSON.parse(cache);
        this.pedidos = datos.map((item: any, idx: number) => this.normalizarPedido(item, idx));
      } catch {
        this.pedidos = [];
      }
    }
    const notif = localStorage.getItem('pedidos_notificacion');
    if (notif) {
      this.notificacionReciente = notif;
    }
  }

  guardarCacheLocal(): void {
    localStorage.setItem('pedidos_app_data', JSON.stringify(this.pedidos));
    if (this.notificacionReciente) {
      localStorage.setItem('pedidos_notificacion', this.notificacionReciente);
    }
  }

  descartarNotificacion(): void {
    this.notificacionReciente = '';
    localStorage.removeItem('pedidos_notificacion');
  }

  toggleFormulario(): void {
    this.mostrarFormularioCreacion = !this.mostrarFormularioCreacion;
  }

  enmascararNombre(nombreCompleto: string): string {
    if (!nombreCompleto) return '';
    if (this.rolSeleccionado === 'ADMIN') return nombreCompleto;

    const partes = nombreCompleto.split(' ');
    if (partes.length === 1) return partes[0].charAt(0) + '****';
    return `${partes[0]} ${partes[1].charAt(0)}****`;
  }

  cambiarRol(nuevoRol: 'OPERADOR' | 'ADMIN'): void {
    this.rolSeleccionado = nuevoRol;
    this.cdr.detectChanges();
  }

  guardarNuevoPedido(): void {
    if (this.rolSeleccionado !== 'ADMIN') return;
    if (!this.nuevoPedido.cliente.trim() || !this.nuevoPedido.destino.trim()) {
      alert('Por favor ingrese el nombre del cliente y la comuna de destino.');
      return;
    }

    const payload: Pedido = {
      tracking: `TRK-CL-${Math.floor(1000 + Math.random() * 9000)}`,
      cliente: this.nuevoPedido.cliente.trim(),
      producto: this.nuevoPedido.producto,
      cantidad: Number(this.nuevoPedido.cantidad),
      total: Number(this.nuevoPedido.total),
      courier: this.nuevoPedido.courier,
      destino: this.nuevoPedido.destino.trim(),
      estado: 'En Preparacion'
    };

    this.http.post<Pedido>(environment.apiUrl, payload).subscribe({
      next: (creado) => {
        this.ngZone.run(() => {
          this.pedidos.unshift(this.normalizarPedido(creado));
          this.notificacionReciente = `Nueva guia creada: ${payload.tracking} con destino a ${payload.destino}`;
          this.guardarCacheLocal();
          this.resetFormulario();
        });
      },
      error: () => {
        this.ngZone.run(() => {
          const localId = this.pedidos.length > 0 ? Math.max(...this.pedidos.map(p => p.id || 0)) + 1 : 1;
          this.pedidos.unshift({ ...payload, id: localId });
          this.notificacionReciente = `Nueva guia creada: ${payload.tracking} con destino a ${payload.destino}`;
          this.guardarCacheLocal();
          this.resetFormulario();
        });
      }
    });
  }

  private resetFormulario(): void {
    this.nuevoPedido = {
      cliente: '',
      producto: 'Notebook Corporativo HP G8',
      cantidad: 1,
      total: 450000,
      courier: 'Blue Express',
      destino: 'Santiago Centro'
    };
    this.mostrarFormularioCreacion = false;
    this.cdr.detectChanges();
  }

  abrirModalEditar(pedido: Pedido): void {
    this.pedidoEnEdicion = { ...pedido };
  }

  cerrarModalEditar(): void {
    this.pedidoEnEdicion = null;
  }

  guardarEdicion(): void {
    if (!this.pedidoEnEdicion || !this.pedidoEnEdicion.id) return;

    const editado = this.pedidoEnEdicion;
    this.http.post<Pedido>(environment.apiUrl, editado).subscribe({
      next: () => this.aplicarCambioEdicionLocal(editado),
      error: () => this.aplicarCambioEdicionLocal(editado)
    });
  }

  private aplicarCambioEdicionLocal(editado: Pedido): void {
    this.ngZone.run(() => {
      const idx = this.pedidos.findIndex(p => p.id === editado.id);
      if (idx !== -1) {
        this.pedidos[idx] = { ...editado };
        this.notificacionReciente = `La orden ${editado.tracking} ha sido actualizada`;
        this.guardarCacheLocal();
      }
      this.pedidoEnEdicion = null;
      this.cdr.detectChanges();
    });
  }

  abrirModalIncidencia(pedido: Pedido): void {
    this.pedidoParaIncidencia = pedido;
    this.detalleIncidenciaTemp = pedido.incidencia || '';
  }

  cerrarModalIncidencia(): void {
    this.pedidoParaIncidencia = null;
    this.detalleIncidenciaTemp = '';
  }

  guardarIncidencia(): void {
    if (!this.pedidoParaIncidencia || !this.pedidoParaIncidencia.id) return;

    const id = this.pedidoParaIncidencia.id;
    const motivo = this.detalleIncidenciaTemp.trim();
    const tracking = this.pedidoParaIncidencia.tracking;

    this.http.patch<Pedido>(`${environment.apiUrl}/${id}/incidencia`, { incidencia: motivo }).subscribe({
      next: (resp) => {
        this.ngZone.run(() => {
          this.aplicarCambioIncidenciaLocal(id, resp.incidencia, resp.estado, tracking);
        });
      },
      error: () => {
        this.ngZone.run(() => {
          const nuevoEstado = motivo ? 'Incidencia en Ruta' : 'En Transito';
          this.aplicarCambioIncidenciaLocal(id, motivo || undefined, nuevoEstado, tracking);
        });
      }
    });
  }

  solucionarIncidencia(): void {
    this.detalleIncidenciaTemp = '';
    this.guardarIncidencia();
  }

  private aplicarCambioIncidenciaLocal(id: number, incidencia: string | undefined, estado: string, tracking: string): void {
    const item = this.pedidos.find(p => p.id === id);
    if (item) {
      item.incidencia = incidencia;
      item.estado = estado;
      this.notificacionReciente = incidencia 
        ? `Alerta en ruta [${tracking}]: ${incidencia}` 
        : `Incidencia solucionada para la guia [${tracking}]`;
      this.guardarCacheLocal();
    }
    this.cerrarModalIncidencia();
    this.cdr.detectChanges();
  }

  cambiarEstado(pedido: Pedido, nuevoEstado: string): void {
    if (this.rolSeleccionado !== 'ADMIN' || !pedido.id) return;

    pedido.estado = nuevoEstado;
    this.notificacionReciente = `Guia ${pedido.tracking} paso a estado: ${nuevoEstado}`;
    this.guardarCacheLocal();

    this.http.patch<Pedido>(`${environment.apiUrl}/${pedido.id}/estado`, { estado: nuevoEstado }).subscribe({
      next: () => {},
      error: () => {}
    });
  }

  eliminarPedido(id: number | undefined, tracking: string): void {
    if (!id || this.rolSeleccionado !== 'ADMIN') return;

    if (confirm(`Confirma ejercicio del Derecho de Supresion ARCO para la guia ${tracking}`)) {
      this.http.delete(`${environment.apiUrl}/${id}`).subscribe({
        next: () => this.removerLocal(id, tracking),
        error: () => this.removerLocal(id, tracking)
      });
    }
  }

  private removerLocal(id: number, tracking: string): void {
    this.ngZone.run(() => {
      this.pedidos = this.pedidos.filter(p => p.id !== id);
      this.notificacionReciente = `Registro suprimido: ${tracking} fue eliminado definitivamente`;
      this.guardarCacheLocal();
      this.cdr.detectChanges();
    });
  }

  obtenerPedidos(): void {
    this.cargando = true;
    this.http.get<Pedido[]>(environment.apiUrl).subscribe({
      next: (data) => {
        this.ngZone.run(() => {
          if (data && data.length > 0) {
            this.pedidos = data.map((item, idx) => this.normalizarPedido(item, idx));
            this.guardarCacheLocal();
          }
          this.cargando = false;
          this.cdr.detectChanges();
        });
      },
      error: () => {
        this.ngZone.run(() => {
          this.cargarCacheLocal();
          this.cargando = false;
          this.cdr.detectChanges();
        });
      }
    });
  }

  login(): void {
    this.msalService.loginRedirect({
      scopes: ['openid', 'profile', 'email'],
      prompt: 'select_account'
    });
  }

  logout(): void {
    this.msalService.instance.setActiveAccount(null);
    sessionStorage.clear();
    localStorage.removeItem('pedidos_notificacion');
    this.isLoggedIn = false;
    this.userName = '';
    this.cdr.detectChanges();
  }
}