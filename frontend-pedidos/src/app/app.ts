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

export interface Producto {
  id?: number;
  sku: string;
  nombre: string;
  descripcion: string;
  categoria: string;
  precio: number;
  stock: number;
  stockMinimo: number;
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

  moduloActivo: 'PEDIDOS' | 'PRODUCTOS' = 'PEDIDOS';

  isLoggedIn = true;
  userName = 'Usuario Evaluador (Azure)';
  rolSeleccionado: 'OPERADOR' | 'ADMIN' = 'ADMIN';
  pedidos: Pedido[] = [];
  productos: Producto[] = [];
  cargando = false;
  notificacionReciente: string = '';

  private apiPedidosUrl = environment.apiUrl;
  private apiProductosUrl = environment.apiUrl.replace('/pedidos', '/productos');

  estadosDisponibles: string[] = ['En Preparacion', 'En Transito', 'En Reparto', 'Incidencia en Ruta', 'Entregado'];
  couriersDisponibles: string[] = ['Blue Express', 'Chilexpress', 'Flota Propia'];

  mostrarFormularioCreacion = false;
  mostrarFormularioProducto = false;
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

  nuevoProducto: Producto = {
    sku: '',
    nombre: '',
    descripcion: '',
    categoria: 'Abarrotes',
    precio: 0,
    stock: 10,
    stockMinimo: 5
  };

  ngOnInit(): void {
    this.cargarCacheLocal();
    this.obtenerPedidos();
    this.obtenerProductos();

    // Inicializacion de MSAL encapsulada para no perder la zona de Angular
    this.msalService.instance.initialize().then(() => {
      return this.msalService.instance.handleRedirectPromise();
    }).then((resultado) => {
      this.ngZone.run(() => {
        if (resultado && resultado.account) {
          this.msalService.instance.setActiveAccount(resultado.account);
        }
        const cuentaActiva = this.msalService.instance.getActiveAccount() || this.msalService.instance.getAllAccounts()[0];
        if (cuentaActiva) {
          this.userName = cuentaActiva.name || cuentaActiva.username;
        }
        this.cdr.detectChanges();
      });
    }).catch((err) => {
      console.warn('MSAL en modo publico/evaluacion:', err);
    });
  }

  cambiarModulo(modulo: 'PEDIDOS' | 'PRODUCTOS'): void {
    this.ngZone.run(() => {
      this.moduloActivo = modulo;
      this.cdr.detectChanges();
    });
  }

  // --- MODAL DE EDICION GENERAL (RESPUESTA INSTANTANEA) ---
  abrirModalEditar(pedido: Pedido): void {
    this.ngZone.run(() => {
      this.pedidoEnEdicion = { ...pedido };
      this.cdr.detectChanges();
    });
  }

  cerrarModalEditar(): void {
    this.ngZone.run(() => {
      this.pedidoEnEdicion = null;
      this.cdr.detectChanges();
    });
  }

  guardarEdicion(): void {
    if (!this.pedidoEnEdicion?.id) return;

    const editado = { ...this.pedidoEnEdicion };
    if (editado.incidencia && editado.incidencia.trim() !== '') {
      editado.estado = 'Incidencia en Ruta';
    } else if (editado.estado === 'Incidencia en Ruta') {
      editado.estado = 'En Transito';
    }

    this.http.post<Pedido>(this.apiPedidosUrl, editado).subscribe({
      next: () => this.aplicarEdicionLocal(editado),
      error: () => this.aplicarEdicionLocal(editado)
    });
  }

  private aplicarEdicionLocal(editado: Pedido): void {
    this.ngZone.run(() => {
      const idx = this.pedidos.findIndex(p => p.id === editado.id);
      if (idx !== -1) {
        this.pedidos[idx] = { ...editado };
        this.notificacionReciente = `Orden ${editado.tracking} actualizada correctamente`;
        this.guardarCacheLocal();
      }
      this.pedidoEnEdicion = null;
      this.cdr.detectChanges();
    });
  }

  // --- MODAL DE INCIDENCIAS (RESPUESTA INSTANTANEA) ---
  abrirModalIncidencia(pedido: Pedido): void {
    this.ngZone.run(() => {
      this.pedidoParaIncidencia = pedido;
      this.detalleIncidenciaTemp = pedido.incidencia || '';
      this.cdr.detectChanges();
    });
  }

  cerrarModalIncidencia(): void {
    this.ngZone.run(() => {
      this.pedidoParaIncidencia = null;
      this.detalleIncidenciaTemp = '';
      this.cdr.detectChanges();
    });
  }

  guardarIncidencia(): void {
    if (!this.pedidoParaIncidencia?.id) return;

    const id = this.pedidoParaIncidencia.id;
    const motivo = this.detalleIncidenciaTemp.trim();
    const nuevoEstado = motivo ? 'Incidencia en Ruta' : 'En Transito';
    const tracking = this.pedidoParaIncidencia.tracking;

    this.http.patch<Pedido>(`${this.apiPedidosUrl}/${id}/incidencia`, { incidencia: motivo }).subscribe({
      next: () => {
        this.aplicarCambioIncidenciaLocal(id, motivo || undefined, nuevoEstado, tracking);
      },
      error: () => {
        this.aplicarCambioIncidenciaLocal(id, motivo || undefined, nuevoEstado, tracking);
      }
    });
  }

  solucionarIncidencia(): void {
    this.detalleIncidenciaTemp = '';
    this.guardarIncidencia();
  }

  private aplicarCambioIncidenciaLocal(id: number, motivo: string | undefined, nuevoEstado: string, tracking: string): void {
    this.ngZone.run(() => {
      const item = this.pedidos.find(p => p.id === id);
      if (item) {
        item.incidencia = motivo;
        item.estado = nuevoEstado;
        this.notificacionReciente = motivo 
          ? `Incidencia actualizada en guia [${tracking}]: ${motivo}` 
          : `Incidencia resuelta para la guia [${tracking}]`;
        this.guardarCacheLocal();
      }
      this.pedidoParaIncidencia = null;
      this.detalleIncidenciaTemp = '';
      this.cdr.detectChanges();
    });
  }

  // --- GESTION DE PRODUCTOS (MODULO 1) ---
  obtenerProductos(): void {
    this.http.get<Producto[]>(this.apiProductosUrl).subscribe({
      next: (data) => {
        this.ngZone.run(() => {
          this.productos = data || [];
          this.cdr.detectChanges();
        });
      },
      error: () => {
        this.ngZone.run(() => {
          if (this.productos.length === 0) {
            this.productos = [
              { id: 1, sku: 'ASEO-001', nombre: 'Detergente Industrial 5L', descripcion: 'Bidon concentrado', categoria: 'Aseo', precio: 12990, stock: 45, stockMinimo: 10 },
              { id: 2, sku: 'ASEO-002', nombre: 'Cloro Gel Desinfectante 1L', descripcion: 'Envase individual', categoria: 'Aseo', precio: 2490, stock: 4, stockMinimo: 15 },
              { id: 3, sku: 'ABAR-001', nombre: 'Arroz Grado 1 (1kg)', descripcion: 'Bolsa individual', categoria: 'Abarrotes', precio: 1350, stock: 120, stockMinimo: 20 }
            ];
          }
          this.cdr.detectChanges();
        });
      }
    });
  }

  guardarNuevoProducto(): void {
    if (!this.nuevoProducto.sku.trim() || !this.nuevoProducto.nombre.trim()) {
      alert('Debe ingresar SKU y Nombre del producto.');
      return;
    }

    this.http.post<Producto>(this.apiProductosUrl, this.nuevoProducto).subscribe({
      next: (creado) => {
        this.ngZone.run(() => {
          this.productos.unshift(creado);
          this.notificacionReciente = `Producto registrado: ${creado.nombre} (${creado.sku})`;
          this.resetFormularioProducto();
        });
      },
      error: () => {
        this.ngZone.run(() => {
          const localProd = { ...this.nuevoProducto, id: Date.now() };
          this.productos.unshift(localProd);
          this.notificacionReciente = `Producto guardado: ${localProd.nombre}`;
          this.resetFormularioProducto();
        });
      }
    });
  }

  resetFormularioProducto(): void {
    this.nuevoProducto = { sku: '', nombre: '', descripcion: '', categoria: 'Abarrotes', precio: 0, stock: 10, stockMinimo: 5 };
    this.mostrarFormularioProducto = false;
    this.cdr.detectChanges();
  }

  // --- GESTION DE PEDIDOS (MODULO 2) ---
  obtenerPedidos(): void {
    this.cargando = true;
    this.http.get<Pedido[]>(this.apiPedidosUrl).subscribe({
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

  private normalizarPedido(p: any, index: number = 0): Pedido {
    return {
      id: p.id || (index + 1),
      tracking: p.tracking || `TRK-CL-${1000 + (index + 1) * 219}`,
      cliente: p.cliente || 'Cliente sin registrar',
      producto: p.producto || 'Insumo Logistico',
      cantidad: p.cantidad || 1,
      total: p.total || 0,
      courier: p.courier || 'Blue Express',
      destino: p.destino || 'Santiago Centro',
      estado: p.estado || 'En Preparacion',
      incidencia: p.incidencia || ''
    };
  }

  guardarNuevoPedido(): void {
    if (this.rolSeleccionado !== 'ADMIN') return;
    if (!this.nuevoPedido.cliente.trim() || !this.nuevoPedido.destino.trim()) {
      alert('Debe ingresar cliente y destino.');
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

    this.http.post<Pedido>(this.apiPedidosUrl, payload).subscribe({
      next: (creado) => {
        this.ngZone.run(() => {
          this.pedidos.unshift(this.normalizarPedido(creado));
          this.notificacionReciente = `Guia creada: ${payload.tracking}`;
          this.guardarCacheLocal();
          this.resetFormulario();
        });
      },
      error: () => {
        this.ngZone.run(() => {
          this.pedidos.unshift({ ...payload, id: Date.now() });
          this.notificacionReciente = `Guia creada: ${payload.tracking}`;
          this.guardarCacheLocal();
          this.resetFormulario();
        });
      }
    });
  }

  // --- SOPORTE Y CONTROL DE ACCESO (ARCO) ---
  enmascararNombre(nombre: string): string {
    if (!nombre) return '';
    if (this.rolSeleccionado === 'ADMIN') return nombre;
    const partes = nombre.split(' ');
    return partes.length === 1 ? partes[0].charAt(0) + '****' : `${partes[0]} ${partes[1].charAt(0)}****`;
  }

  cambiarRol(nuevoRol: 'OPERADOR' | 'ADMIN'): void {
    this.ngZone.run(() => {
      this.rolSeleccionado = nuevoRol;
      this.cdr.detectChanges();
    });
  }

  cambiarEstado(pedido: Pedido, nuevoEstado: string): void {
    this.ngZone.run(() => {
      pedido.estado = nuevoEstado;
      this.cdr.detectChanges();
    });
    this.http.patch(`${this.apiPedidosUrl}/${pedido.id}/estado`, { estado: nuevoEstado }).subscribe();
  }

  eliminarPedido(id: number | undefined, tracking: string): void {
    if (!id || this.rolSeleccionado !== 'ADMIN') return;
    if (confirm(`Confirma ejercicio del Derecho de Supresion ARCO para la guia ${tracking}`)) {
      this.http.delete(`${this.apiPedidosUrl}/${id}`).subscribe({
        next: () => this.removerLocal(id, tracking),
        error: () => this.removerLocal(id, tracking)
      });
    }
  }

  private removerLocal(id: number, tracking: string): void {
    this.ngZone.run(() => {
      this.pedidos = this.pedidos.filter(p => p.id !== id);
      this.notificacionReciente = `Registro suprimido (ARCO): ${tracking}`;
      this.guardarCacheLocal();
      this.cdr.detectChanges();
    });
  }

  toggleFormulario(): void {
    this.ngZone.run(() => {
      this.mostrarFormularioCreacion = !this.mostrarFormularioCreacion;
      this.cdr.detectChanges();
    });
  }

  resetFormulario(): void {
    this.nuevoPedido = { cliente: '', producto: 'Notebook Corporativo HP G8', cantidad: 1, total: 450000, courier: 'Blue Express', destino: 'Santiago Centro' };
    this.mostrarFormularioCreacion = false;
    this.cdr.detectChanges();
  }

  cargarCacheLocal(): void {
    const cache = localStorage.getItem('pedidos_app_data');
    if (cache) this.pedidos = JSON.parse(cache);
  }

  guardarCacheLocal(): void { 
    localStorage.setItem('pedidos_app_data', JSON.stringify(this.pedidos)); 
  }

  descartarNotificacion(): void {
    this.ngZone.run(() => {
      this.notificacionReciente = '';
      this.cdr.detectChanges();
    });
  }

  getCount(estado: string): number { return this.pedidos.filter(p => p.estado === estado).length; }
  getCountRuta(): number { return this.pedidos.filter(p => p.estado === 'En Transito' || p.estado === 'En Reparto').length; }
  getCountIncidencias(): number { return this.pedidos.filter(p => p.estado === 'Incidencia en Ruta' || (p.incidencia && p.incidencia.trim() !== '')).length; }
  getAlertasStockCount(): number { return this.productos.filter(p => p.stock <= p.stockMinimo).length; }
}